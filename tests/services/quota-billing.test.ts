import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as period from "@/lib/period";
import * as adminUser from "@/services/admin-user.service";
import * as build from "@/services/build.service";
import * as cost from "@/services/cost.service";
import * as deploy from "@/services/deploy.service";
import * as domain from "@/services/domain.service";
import * as project from "@/services/project.service";
import * as quota from "@/services/quota.service";
import * as usage from "@/services/usage.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** docs/11 — kuota, reservasi kredit, refund, dan biaya vendor. */

const tag = makeTag("kuota");
const f = fixtures(tag);
const DAY = 24 * 60 * 60_000;

let killBefore: unknown;
let thresholdBefore: unknown;

beforeAll(async () => {
  killBefore = (await db.systemSetting.findUnique({ where: { key: "ai.killSwitch" } }))
    ?.value;
  thresholdBefore = (
    await db.systemSetting.findUnique({ where: { key: "ai.dailyCostThresholdIdr" } })
  )?.value;
});

afterAll(async () => {
  await db.systemSetting.upsert({
    where: { key: "ai.killSwitch" },
    update: { value: (killBefore ?? false) as boolean },
    create: { key: "ai.killSwitch", value: (killBefore ?? false) as boolean },
  });
  await db.systemSetting.upsert({
    where: { key: "ai.dailyCostThresholdIdr" },
    update: { value: (thresholdBefore ?? 400_000) as number },
    create: {
      key: "ai.dailyCostThresholdIdr",
      value: (thresholdBefore ?? 400_000) as number,
    },
  });
  await f.cleanup();
});

const createInput = (name: string) =>
  ({
    websiteType: "CUSTOM",
    prompt: `Website ${name} untuk uji kuota`,
    name,
  }) as Parameters<typeof project.create>[0]["input"];

describe("kredit AI", () => {
  it("menolak generate saat kredit habis tanpa menyimpan job", async () => {
    const u = await f.user("habis");
    await f.drainedWelcome(u.id);
    const p = await f.project(u.id, "habis");

    const error = await expectAppError(
      () =>
        build.createJob({
          projectId: p.id,
          userId: u.id,
          kind: "INITIAL_GENERATE",
          prompt: "x",
        }),
      "QUOTA_EXCEEDED",
      /Kredit AI Anda tidak cukup/,
    );
    expect(error.userMessage).toContain("Isi ulang kredit");
    expect(await db.buildJob.count({ where: { projectId: p.id } })).toBe(0);
    expect((await db.project.findUniqueOrThrow({ where: { id: p.id } })).status).toBe(
      "DRAFT",
    );

    await expectAppError(
      () =>
        project.createWithInitialBuild({ userId: u.id, input: createInput("Baru") }),
      "QUOTA_EXCEEDED",
    );
  });

  it("mengembalikan kredit saat build gagal", async () => {
    const u = await f.user("gagal");
    const lot = await f.credits(u.id, 5);
    const p = await f.project(u.id, "gagal");
    // Pemicu kegagalan tiruan hanya diteruskan oleh build EDIT.
    const { jobId } = await build.createJob({
      projectId: p.id,
      userId: u.id,
      kind: "EDIT_GENERATE",
      prompt: "SIMULASI_GAGAL_KONFIG",
    });
    expect(
      (await db.creditLot.findUniqueOrThrow({ where: { id: lot.id } })).remaining,
    ).toBe(4);

    await build.run(jobId);

    expect((await db.buildJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe(
      "FAILED",
    );
    // Kredit kembali ke lot asalnya, bukan ke penghitung bulanan.
    expect(
      (await db.creditLot.findUniqueOrThrow({ where: { id: lot.id } })).remaining,
    ).toBe(5);
    expect(
      (await db.usageEvent.findFirstOrThrow({ where: { buildJobId: jobId } })).state,
    ).toBe("REFUNDED");
  });

  it("hanya satu dari tiga permintaan bersamaan yang mendapat kredit terakhir", async () => {
    const u = await f.user("rebutan", { maxProjectsOverride: 5 });
    await f.drainedWelcome(u.id);
    await f.credits(u.id, 1);
    const projects = await Promise.all(
      ["r1", "r2", "r3"].map((n) => f.project(u.id, n)),
    );

    const results = await Promise.allSettled(
      projects.map((p) =>
        build.createJob({
          projectId: p.id,
          userId: u.id,
          kind: "INITIAL_GENERATE",
          prompt: "x",
        }),
      ),
    );

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);

    // Kredit terakhir benar-benar terpakai sekali: lot kosong, satu reservasi.
    const lots = await db.creditLot.findMany({ where: { userId: u.id } });
    expect(lots.reduce((sum, l) => sum + l.remaining, 0)).toBe(0);
    expect(
      await db.usageEvent.count({ where: { userId: u.id, state: "RESERVED" } }),
    ).toBe(1);
  });

  it("refund idempoten dan tidak pernah membuat kredit negatif", async () => {
    const u = await f.user("refund");
    const eventId = await usage.reserve({
      userId: u.id,
      kind: "AI_GENERATE",
      credits: 2,
    });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).creditsUsed).toBe(
      2,
    );

    // Pemakaian direset admin sebelum refund terjadi.
    await adminUser.resetUsage({ userId: u.id });
    await usage.refund(eventId);
    await usage.refund(eventId);

    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).creditsUsed).toBe(
      0,
    );
    expect(
      (await db.usageEvent.findUniqueOrThrow({ where: { id: eventId } })).state,
    ).toBe("REFUNDED");
  });

  it("commit menjadikan reservasi final; record mencatat pemakaian langsung", async () => {
    const u = await f.user("commit");
    const eventId = await usage.reserve({
      userId: u.id,
      kind: "AI_GENERATE",
      credits: 1,
    });
    await usage.commit(eventId);
    await usage.commit(eventId);
    expect(
      (await db.usageEvent.findUniqueOrThrow({ where: { id: eventId } })).state,
    ).toBe("COMMITTED");

    await usage.record({ userId: u.id, kind: "AI_GENERATE", credits: 3 });
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).creditsUsed).toBe(
      4,
    );
  });

  it("refundStale mengembalikan reservasi yatim yang tertinggal", async () => {
    const u = await f.user("yatim");
    const eventId = await usage.reserve({
      userId: u.id,
      kind: "AI_GENERATE",
      credits: 1,
    });
    await db.usageEvent.update({
      where: { id: eventId },
      data: { createdAt: new Date(Date.now() - 2 * 60 * 60_000) },
    });

    expect(await usage.refundStale(30)).toBeGreaterThanOrEqual(1);
    expect(
      (await db.usageEvent.findUniqueOrThrow({ where: { id: eventId } })).state,
    ).toBe("REFUNDED");
  });

  it("kredit yang ditambahkan admin langsung membuka generate", async () => {
    const u = await f.user("naik");
    await f.drainedWelcome(u.id);
    const p = await f.project(u.id, "naik");

    await expectAppError(
      () =>
        build.createJob({
          projectId: p.id,
          userId: u.id,
          kind: "INITIAL_GENERATE",
          prompt: "x",
        }),
      "QUOTA_EXCEEDED",
    );

    await f.credits(u.id, 20);
    const { jobId } = await build.createJob({
      projectId: p.id,
      userId: u.id,
      kind: "INITIAL_GENERATE",
      prompt: "x",
    });
    expect(jobId).toBeTruthy();
    await build.cancel({ jobId, userId: u.id });
  });

  it("memberi peringatan kredit menipis sekali, bukan setiap generate", async () => {
    const u = await f.user("menipis", { maxProjectsOverride: 5 });
    await f.drainedWelcome(u.id);
    // Ambang LOW_WALLET_CREDITS = 3: peringatan muncul saat sisa <= 3.
    // Job TIDAK dibatalkan di tengah, karena membatalkan mengembalikan
    // kreditnya dan saldo tidak akan pernah turun.
    await f.credits(u.id, 4);
    const jobIds: string[] = [];
    for (const n of ["m1", "m2"]) {
      const p = await f.project(u.id, n);
      const { jobId } = await build.createJob({
        projectId: p.id,
        userId: u.id,
        kind: "INITIAL_GENERATE",
        prompt: "x",
      });
      jobIds.push(jobId);
    }

    expect(
      await db.notification.count({ where: { userId: u.id, type: "quota.low" } }),
    ).toBe(1);

    for (const jobId of jobIds) await build.cancel({ jobId, userId: u.id });
  });

  it("getCreditSummary menampilkan pemakaian terhadap batas", async () => {
    const free = await f.plan("free");
    const u = await f.user("ringkas", { creditsUsed: 3 });
    const summary = await quota.getCreditSummary(u.id);
    expect(summary).toMatchObject({ used: 3, limit: free.monthlyCredits });
  });
});

describe("batas project, deploy, dan domain", () => {
  it("menolak project kedua dan duplikasi di paket Free", async () => {
    const u = await f.user("project");
    await project.create({ userId: u.id, input: createInput("Pertama") });

    await expectAppError(
      () => project.create({ userId: u.id, input: createInput("Kedua") }),
      "QUOTA_EXCEEDED",
      /maksimal 1 website/,
    );
    const first = await db.project.findFirstOrThrow({ where: { userId: u.id } });
    await expectAppError(
      () => project.duplicate({ projectId: first.id, userId: u.id }),
      "QUOTA_EXCEEDED",
    );
  });

  it("pembuatan project bersamaan tidak menembus batas", async () => {
    const u = await f.user("projectrace");
    const results = await Promise.allSettled(
      [1, 2, 3].map((i) =>
        project.create({ userId: u.id, input: createInput(`R${i}`) }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.project.count({ where: { userId: u.id } })).toBe(1);
  });

  it("menolak deploy melewati batas harian dan domain di paket Free", async () => {
    const free = await f.plan("free");
    const u = await f.user("deploy");
    const p = await f.deployableProject(u.id, "deploy");
    await db.project.update({
      where: { id: p.id },
      data: {
        productionUrl: "https://x.tiruan.invalid",
        vercelProjectId: `prj_mock_${tag}`,
      },
    });
    await db.usageEvent.createMany({
      data: Array.from({ length: free.maxDeploysPerDay }, () => ({
        kind: "DEPLOY" as const,
        state: "COMMITTED" as const,
        credits: 0,
        userId: u.id,
        projectId: p.id,
      })),
    });

    await expectAppError(
      () => deploy.request({ projectId: p.id, userId: u.id }),
      "QUOTA_EXCEEDED",
      /Batas penerbitan harian/,
    );
    await expectAppError(
      () => domain.add({ projectId: p.id, userId: u.id, domain: `${tag}.com` }),
      "QUOTA_EXCEEDED",
      /belum mendukung custom domain/,
    );

    const snapshot = await quota.getQuota(u.id);
    expect(snapshot?.deploysToday).toBe(free.maxDeploysPerDay);
    expect(snapshot?.domainLimit).toBe(free.maxCustomDomains);
  });
});

describe("periode kuota", () => {
  it("reset periode memajukan tanggal tepat dan tidak mengulang", async () => {
    const oldStart = new Date(Date.now() - 31 * DAY);
    const u = await f.user("reset", { creditsUsed: 17, periodStartedAt: oldStart });

    await quota.resetExpiredPeriods();
    const after = await db.user.findUniqueOrThrow({ where: { id: u.id } });
    expect(after.creditsUsed).toBe(0);
    expect(after.periodStartedAt.getTime()).toBe(oldStart.getTime() + 30 * DAY);

    await quota.resetExpiredPeriods();
    expect(
      (
        await db.user.findUniqueOrThrow({ where: { id: u.id } })
      ).periodStartedAt.getTime(),
    ).toBe(after.periodStartedAt.getTime());
  });

  it("menghitung hari WIB dan periode yang terlambat", () => {
    const veryOld = new Date(Date.now() - 65 * DAY);
    expect(period.nextPeriodStart(veryOld)?.getTime()).toBe(
      veryOld.getTime() + 60 * DAY,
    );
    expect(period.startOfDayWib(new Date("2026-09-15T16:59:00Z")).toISOString()).toBe(
      "2026-09-14T17:00:00.000Z",
    );
    expect(period.startOfDayWib(new Date("2026-09-15T17:00:00Z")).toISOString()).toBe(
      "2026-09-15T17:00:00.000Z",
    );
  });
});

describe("biaya vendor", () => {
  it("memasangkan biaya ke generate di chat yang sama", () => {
    const t0 = new Date("2026-09-14T03:00:00Z");
    const matched = cost.matchCosts(
      [
        {
          id: "v1",
          chatId: "chatA",
          costUsd: 0.1,
          createdAt: new Date(t0.getTime() + 30_000),
        },
        {
          id: "v2",
          chatId: "chatA",
          costUsd: 0.2,
          createdAt: new Date(t0.getTime() + 3_600_000),
        },
        { id: "v3", chatId: null, costUsd: 5, createdAt: t0 },
        { id: "v4", chatId: "chatX", costUsd: 1, createdAt: t0 },
      ],
      [
        { usageEventId: "u1", chatId: "chatA", createdAt: t0 },
        {
          usageEventId: "u2",
          chatId: "chatA",
          createdAt: new Date(t0.getTime() + 3_000_000),
        },
      ],
    );
    expect(matched.get("u1")?.map((x) => x.recordId)).toEqual(["v1"]);
    expect(matched.get("u2")?.map((x) => x.recordId)).toEqual(["v2"]);
    expect(
      [...matched.values()]
        .flat()
        .some((x) => x.recordId === "v3" || x.recordId === "v4"),
    ).toBe(false);
  });

  it("rekonsiliasi dilewati pada mesin tiruan", async () => {
    expect((await cost.reconcileRange(new Date(), new Date())).skipped).not.toBeNull();
    expect((await cost.reconcileYesterday()).skipped).not.toBeNull();
  });

  it("metrik biaya menghitung rata-rata per website jadi", async () => {
    const before = await cost.getCostMetrics(30);
    const u = await f.user("biaya");
    const p = await f.project(u.id, "biaya");
    await db.usageEvent.create({
      data: {
        kind: "AI_GENERATE",
        state: "COMMITTED",
        credits: 1,
        userId: u.id,
        projectId: p.id,
        vendorCostIdr: 9_000,
      },
    });
    await db.deployment.create({
      data: {
        projectId: p.id,
        status: "READY",
        target: "PRODUCTION",
        readyAt: new Date(),
      },
    });

    const after = await cost.getCostMetrics(30);
    expect(after.totalCostIdr - before.totalCostIdr).toBe(9_000);
    expect(after.newLiveWebsites - before.newLiveWebsites).toBe(1);
    expect(after.avgCostPerWebsiteIdr).toBe(
      Math.round(after.totalCostIdr / after.newLiveWebsites),
    );
  });

  it("kill switch otomatis menyala sekali saat biaya melewati ambang", async () => {
    await db.systemSetting.upsert({
      where: { key: "ai.killSwitch" },
      update: { value: false },
      create: { key: "ai.killSwitch", value: false },
    });
    await db.systemSetting.upsert({
      where: { key: "ai.dailyCostThresholdIdr" },
      update: { value: 100 },
      create: { key: "ai.dailyCostThresholdIdr", value: 100 },
    });

    expect(await cost.enforceDailyCostThreshold(50, new Date())).toBe(false);
    expect(await cost.enforceDailyCostThreshold(500, new Date())).toBe(true);
    expect(await cost.enforceDailyCostThreshold(500, new Date())).toBe(false);

    // Saat kill switch menyala, generate baru ditolak.
    const u = await f.user("killswitch");
    const p = await f.project(u.id, "killswitch");
    await expectAppError(
      () =>
        build.createJob({
          projectId: p.id,
          userId: u.id,
          kind: "INITIAL_GENERATE",
          prompt: "x",
        }),
      "KILL_SWITCH",
    );

    await db.notification.deleteMany({
      where: {
        type: "cost.threshold",
        createdAt: { gte: new Date(Date.now() - 10 * 60_000) },
      },
    });
  });
});
