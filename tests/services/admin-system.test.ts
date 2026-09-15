import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as adminBuild from "@/services/admin-build.service";
import * as adminOverview from "@/services/admin-overview.service";
import * as adminProject from "@/services/admin-project.service";
import * as adminUser from "@/services/admin-user.service";
import * as audit from "@/services/audit.service";
import * as integration from "@/services/integration.service";
import * as plan from "@/services/plan.service";
import * as system from "@/services/system.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** docs/10 — Super Admin: pengguna, paket, pengaturan sistem, audit. */

const tag = makeTag("admin");
const f = fixtures(tag);

let settingsBefore: Array<{ key: string; value: unknown }> = [];
const createdPlanSlugs: string[] = [];

beforeAll(async () => {
  settingsBefore = await db.systemSetting.findMany({
    where: {
      key: {
        in: [
          "ai.killSwitch",
          "system.maintenance",
          "auth.signupEnabled",
          "ai.defaultModel",
          "ai.systemPromptRules",
        ],
      },
    },
    select: { key: true, value: true },
  });
});

afterAll(async () => {
  const keys = [
    "ai.killSwitch",
    "system.maintenance",
    "auth.signupEnabled",
    "ai.defaultModel",
    "ai.systemPromptRules",
  ];
  for (const key of keys) {
    const before = settingsBefore.find((s) => s.key === key);
    if (before) {
      await db.systemSetting.update({
        where: { key },
        data: { value: before.value as never },
      });
    } else {
      await db.systemSetting.deleteMany({ where: { key } });
    }
  }
  await db.auditLog.deleteMany({ where: { action: { startsWith: `${tag}.` } } });
  await f.cleanup();
  await db.plan.deleteMany({ where: { slug: { in: createdPlanSlugs } } });
});

describe("pengelolaan pengguna", () => {
  it("menangguhkan, mencabut sesi, lalu mengaktifkan kembali", async () => {
    const admin = await f.user("sa", { role: "SUPER_ADMIN" });
    const target = await f.user("target");
    await db.session.create({
      data: {
        userId: target.id,
        token: `${tag}-token`,
        expiresAt: new Date(Date.now() + 60 * 60_000),
      },
    });

    const trail = await adminUser.suspend({
      actorId: admin.id,
      userId: target.id,
      reason: "Uji",
    });
    expect(trail).toMatchObject({ targetType: "User", targetId: target.id });
    const suspended = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    expect(suspended.status).toBe("SUSPENDED");
    expect(suspended.banned).toBe(true);
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0);

    await expectAppError(
      () => adminUser.suspend({ actorId: admin.id, userId: target.id, reason: "Lagi" }),
      "CONFLICT",
      /sudah ditangguhkan/,
    );

    await adminUser.reactivate({ userId: target.id });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "ACTIVE",
    );
    await expectAppError(() => adminUser.reactivate({ userId: target.id }), "CONFLICT");
  });

  it("menolak admin menangguhkan atau menghapus dirinya sendiri", async () => {
    const admin = await f.user("diri", { role: "SUPER_ADMIN" });
    await expectAppError(
      () => adminUser.suspend({ actorId: admin.id, userId: admin.id, reason: "x" }),
      "CONFLICT",
    );
    await expectAppError(
      () =>
        adminUser.hardDelete({
          actorId: admin.id,
          userId: admin.id,
          confirmEmail: admin.email,
        }),
      "CONFLICT",
    );
  });

  it("mengubah peran, paket, dan pemakaian", async () => {
    const admin = await f.user("peran-sa", { role: "SUPER_ADMIN" });
    const target = await f.user("peran", { creditsUsed: 9 });
    const pro = await f.plan("pro");

    await adminUser.changeRole({ actorId: admin.id, userId: target.id, role: "ADMIN" });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).role).toBe(
      "ADMIN",
    );
    await expectAppError(
      () =>
        adminUser.changeRole({ actorId: admin.id, userId: target.id, role: "ADMIN" }),
      "CONFLICT",
    );

    await adminUser.changePlan({ userId: target.id, planId: pro.id });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).planId).toBe(
      pro.id,
    );
    await expectAppError(
      () => adminUser.changePlan({ userId: target.id, planId: pro.id }),
      "CONFLICT",
    );
    await expectAppError(
      () => adminUser.changePlan({ userId: target.id, planId: "tidak-ada" }),
      "NOT_FOUND",
    );

    await adminUser.resetUsage({ userId: target.id });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: target.id } })).creditsUsed,
    ).toBe(0);
    await expectAppError(
      () => adminUser.resetUsage({ userId: "tidak-ada" }),
      "NOT_FOUND",
    );
  });

  it("hapus permanen mewajibkan konfirmasi email yang cocok", async () => {
    const admin = await f.user("hapus-sa", { role: "SUPER_ADMIN" });
    const target = await f.user("hapus");

    await expectAppError(
      () =>
        adminUser.hardDelete({
          actorId: admin.id,
          userId: target.id,
          confirmEmail: "salah@contoh.test",
        }),
      "VALIDATION",
    );
    await adminUser.hardDelete({
      actorId: admin.id,
      userId: target.id,
      confirmEmail: target.email,
    });
    expect(await db.user.findUnique({ where: { id: target.id } })).toBeNull();
  });

  it("tidak bisa menyamar sebagai diri sendiri atau sesama admin", async () => {
    const admin = await f.user("samar-sa", { role: "SUPER_ADMIN" });
    const other = await f.user("samar-admin", { role: "ADMIN" });
    const normal = await f.user("samar-user");

    await expectAppError(
      () => adminUser.assertImpersonatable({ actorId: admin.id, userId: admin.id }),
      "CONFLICT",
    );
    await expectAppError(
      () => adminUser.assertImpersonatable({ actorId: admin.id, userId: other.id }),
      "FORBIDDEN",
    );
    await expect(
      adminUser.assertImpersonatable({ actorId: admin.id, userId: normal.id }),
    ).resolves.not.toThrow();
  });

  it("daftar dan detail pengguna memuat data yang benar", async () => {
    const u = await f.user("cari", { planSlug: "pro" });
    const { items } = await adminUser.list({ q: `${tag}-cari` });
    expect(items.map((i) => i.id)).toContain(u.id);
    expect(items.find((i) => i.id === u.id)?.planName).toBeTruthy();

    const filtered = await adminUser.list({
      q: tag,
      plan: "pro",
      status: "ACTIVE",
      role: "USER",
    });
    expect(filtered.items.every((i) => i.role === "USER")).toBe(true);

    const detail = await adminUser.getDetail(u.id);
    expect(detail?.user.email).toBe(u.email);
    expect(detail?.plans.length).toBeGreaterThanOrEqual(3);
    expect(await adminUser.getDetail("tidak-ada")).toBeNull();
  });
});

describe("paket", () => {
  it("membuat, mengubah, dan menolak perubahan slug atau model tidak valid", async () => {
    const slug = `${tag}-paket`.slice(0, 40);
    createdPlanSlugs.push(slug);
    const base = {
      slug,
      name: "Paket Uji",
      description: null,
      priceMonthly: 10_000,
      isPublic: false,
      sortOrder: 99,
      maxProjects: 2,
      monthlyCredits: 10,
      maxCustomDomains: 0,
      maxDeploysPerDay: 3,
      allowedModels: ["v0-mini"],
    };

    const { planId } = await plan.upsert(base);
    const updated = await plan.upsert({ ...base, id: planId, monthlyCredits: 50 });
    expect(updated.after).toMatchObject({ monthlyCredits: 50 });

    await expectAppError(
      () => plan.upsert({ ...base, id: planId, slug: "lain" }),
      "VALIDATION",
    );
    await expectAppError(
      () => plan.upsert({ ...base, allowedModels: ["model-palsu"] }),
      "VALIDATION",
    );
    await expectAppError(() => plan.upsert({ ...base }), "CONFLICT");
    await expectAppError(() => plan.upsert({ ...base, id: "tidak-ada" }), "NOT_FOUND");

    const plans = await plan.list();
    expect(plans.find((p) => p.id === planId)?.monthlyCredits).toBe(50);
  });
});

describe("pengaturan sistem", () => {
  it("toggle dan model bawaan tersimpan tanpa deploy", async () => {
    const admin = await f.user("sistem-sa", { role: "SUPER_ADMIN" });

    const trail = await system.setToggle({
      key: "system.maintenance",
      value: true,
      actorId: admin.id,
    });
    expect(trail.after).toEqual({ value: true });
    expect(await system.isMaintenanceMode()).toBe(true);
    await system.setToggle({
      key: "system.maintenance",
      value: false,
      actorId: admin.id,
    });

    await system.setDefaultModel({ model: "v0-mini", actorId: admin.id });
    expect(await system.getDefaultModel()).toBe("v0-mini");
    await expectAppError(
      () =>
        system.setDefaultModel({ model: "model-palsu" as never, actorId: admin.id }),
      "VALIDATION",
    );

    const snapshot = await system.getSettings();
    expect(snapshot).toMatchObject({ maintenance: false, defaultModel: "v0-mini" });
    expect(typeof (await system.isSignupEnabled())).toBe("boolean");
  });

  it("aturan system prompt berversi, divalidasi, dan bisa dikembalikan", async () => {
    const admin = await f.user("aturan-sa", { role: "SUPER_ADMIN" });
    const before = await system.getRuleVersions();
    const text = `Aturan uji ${tag}: selalu gunakan bahasa Indonesia yang sopan dan jelas.`;

    await expectAppError(
      () => system.saveRules({ text: "pendek", actorId: admin.id }),
      "VALIDATION",
    );
    await expectAppError(
      () => system.saveRules({ text: "x".repeat(8001), actorId: admin.id }),
      "VALIDATION",
    );

    await system.saveRules({ text, actorId: admin.id });
    expect(await system.getSystemPromptRules()).toBe(text);
    await expectAppError(
      () => system.saveRules({ text, actorId: admin.id }),
      "CONFLICT",
    );

    const firstVersion = before[0]!.version;
    await system.restoreRules({ version: firstVersion, actorId: admin.id });
    const after = await system.getRuleVersions();
    expect(after[after.length - 1]?.restoredFrom).toBe(firstVersion);
    await expectAppError(
      () => system.restoreRules({ version: 99_999, actorId: admin.id }),
      "NOT_FOUND",
    );
  });
});

describe("audit", () => {
  it("mencatat, menyaring, dan mengekspor CSV aman dari injeksi rumus", async () => {
    const actor = await f.user("audit-sa", { role: "SUPER_ADMIN" });
    await audit.record({
      action: `${tag}.uji`,
      actorId: actor.id,
      actorRole: "SUPER_ADMIN",
      targetType: "User",
      targetId: actor.id,
      before: { nama: '=HYPERLINK("x")' },
      after: { nama: "aman" },
    });

    const { items } = await audit.list({ action: `${tag}.uji`, actor: actor.email });
    expect(items).toHaveLength(1);
    expect(items[0]?.actorEmail).toBe(actor.email);

    // Tanggal LOKAL, sama dengan cara service membaca filter (bukan UTC) — bila
    // tidak, uji gagal di sekitar tengah malam ketika tanggal UTC berbeda.
    const today = new Date().toLocaleDateString("sv-SE");
    const ranged = await audit.list({
      targetType: "User",
      targetId: actor.id,
      from: today,
      to: today,
    });
    expect(ranged.items.length).toBeGreaterThanOrEqual(1);

    const csv = await audit.exportCsv({ action: `${tag}.uji` });
    expect(csv.split("\n")[0]).toContain("aksi");
    expect(csv).toContain(`${tag}.uji`);
    expect(audit.isAuditTrail({ targetType: "User", targetId: "x" })).toBe(true);
    expect(audit.isAuditTrail(null)).toBe(false);
  });

  it("kegagalan menulis audit tidak menggagalkan pemanggil", async () => {
    await expect(
      audit.record({ action: `${tag}.gagal`, actorId: "bukan-id-pengguna-yang-ada" }),
    ).resolves.toBeUndefined();
  });
});

describe("ringkasan & daftar admin", () => {
  it("overview, daftar project, build, dan integrasi dapat dibaca", async () => {
    const u = await f.user("ringkasan");
    const p = await f.project(u.id, "ringkasan");

    const overview = await adminOverview.getOverview();
    expect(overview).toBeTruthy();

    const projects = await adminProject.list({ q: `Uji ringkasan` });
    expect(projects.items.map((i) => i.id)).toContain(p.id);
    expect(await adminProject.getDetail(p.id)).not.toBeNull();
    expect(await adminProject.getDetail("tidak-ada")).toBeNull();

    const builds = await adminBuild.list({ status: "FAILED" });
    expect(Array.isArray(builds.items)).toBe(true);
    expect(await adminBuild.getDetail("tidak-ada")).toBeNull();

    const status = integration.getIntegrationStatus();
    expect(status).toBeTruthy();
  });
});
