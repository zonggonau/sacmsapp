import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as adminUser from "@/services/admin-user.service";
import * as notification from "@/services/notification.service";
import * as project from "@/services/project.service";

import { fixtures, makeTag } from "../helpers";

/**
 * Butir yang tertunda dari fase sebelumnya dan wajib sebelum go-live:
 * hapus menurunkan website, audit akhir impersonasi, dan notifikasi.
 */

const tag = makeTag("sisa");
const f = fixtures(tag);

afterAll(() => f.cleanup());

async function publishedProject(userId: string, name: string) {
  const p = await f.project(userId, name, {
    status: "LIVE",
    productionUrl: `https://${tag}-${name}.tiruan.invalid`,
    vercelProjectId: `prj_mock_${tag}_${name}`,
  });
  await db.domain.create({
    data: { projectId: p.id, name: `${tag}-${name}.com`, status: "ACTIVE" },
  });
  return p;
}

describe("hapus menurunkan website yang tayang", () => {
  it("hapus project melepas domain dan mengosongkan alamat live", async () => {
    const u = await f.user("hapus-project", { planSlug: "business" });
    const p = await publishedProject(u.id, "tayang");

    await project.softDelete({
      projectId: p.id,
      userId: u.id,
      confirmName: p.name,
      confirmPhrase: "delete my project",
    });

    const after = await db.project.findUniqueOrThrow({ where: { id: p.id } });
    expect(after.deletedAt).not.toBeNull();
    expect(after.productionUrl).toBeNull();
    expect(after.vercelProjectId).toBeNull();
    expect(await db.domain.count({ where: { projectId: p.id } })).toBe(0);
  });

  it("hapus pengguna menurunkan seluruh website miliknya", async () => {
    const admin = await f.user("hapus-sa", { role: "SUPER_ADMIN" });
    const target = await f.user("hapus-pemilik", {
      planSlug: "business",
      maxProjectsOverride: 5,
    });
    await publishedProject(target.id, "satu");
    await publishedProject(target.id, "dua");

    await adminUser.hardDelete({
      actorId: admin.id,
      userId: target.id,
      confirmEmail: target.email,
    });

    expect(await db.user.findUnique({ where: { id: target.id } })).toBeNull();
    expect(
      await db.domain.count({ where: { name: { startsWith: `${tag}-satu` } } }),
    ).toBe(0);
  });
});

describe("audit akhir impersonasi", () => {
  it("sesi impersonasi kedaluwarsa dicatat sekali lalu dihapus", async () => {
    const admin = await f.user("samar-sa", { role: "SUPER_ADMIN" });
    const target = await f.user("samar-target");
    const session = await db.session.create({
      data: {
        userId: target.id,
        token: `${tag}-imp`,
        impersonatedBy: admin.id,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    expect(await adminUser.closeExpiredImpersonations()).toBeGreaterThanOrEqual(1);
    expect(await db.session.findUnique({ where: { id: session.id } })).toBeNull();
    expect(
      await db.auditLog.count({
        where: {
          action: "user.impersonate.expired",
          actorId: admin.id,
          targetId: target.id,
        },
      }),
    ).toBe(1);

    await adminUser.closeExpiredImpersonations();
    expect(
      await db.auditLog.count({
        where: {
          action: "user.impersonate.expired",
          actorId: admin.id,
          targetId: target.id,
        },
      }),
    ).toBe(1);
  });
});

describe("notifikasi", () => {
  it("menghitung, menampilkan, dan menandai dibaca hanya milik pengguna", async () => {
    const u = await f.user("notif");
    const other = await f.user("notif-lain");
    await db.notification.createMany({
      data: [
        { userId: u.id, type: "quota.low", title: "Kredit menipis" },
        { userId: u.id, type: "build.ready", title: "Website siap", href: "/projects" },
        { userId: other.id, type: "quota.low", title: "Milik orang lain" },
      ],
    });

    expect(await notification.countUnread(u.id)).toBe(2);
    expect((await notification.listForUser(u.id)).map((n) => n.title)).not.toContain(
      "Milik orang lain",
    );
    expect(await notification.markAllRead(u.id)).toBe(2);
    expect(await notification.countUnread(u.id)).toBe(0);
    expect(await notification.countUnread(other.id)).toBe(1);
  });
});
