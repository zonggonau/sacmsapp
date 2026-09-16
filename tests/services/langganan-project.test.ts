import { afterAll, describe, expect, it } from "vitest";

import { SUBSCRIPTION_GRACE_DAYS } from "@/config/billing";
import { db } from "@/lib/db";
import * as subscription from "@/services/subscription.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** ADR-012 — Paket Project: aktivasi manual, masa tenggang, penurunan situs. */

const tag = makeTag("langganan");
const f = fixtures(tag);

afterAll(() => f.cleanup());

const DAY = 24 * 60 * 60_000;
const hari = (n: number) => new Date(Date.now() + n * DAY);

async function project(label: string) {
  const owner = await f.user(`pemilik-${label}`);
  const admin = await f.user(`admin-${label}`, { role: "SUPER_ADMIN" });
  const plan = await f.plan("pro");
  const p = await f.project(owner.id, label);
  return { owner, admin, plan, p };
}

describe("aktivasi", () => {
  it("membuat langganan setahun dan memberi tahu pemiliknya", async () => {
    const { admin, plan, p, owner } = await project("aktif");

    const hasil = await subscription.activate({
      projectId: p.id,
      planId: plan.id,
      actorId: admin.id,
      paymentRef: "TRF-001",
    });

    const bulan = (hasil.endsAt.getTime() - Date.now()) / (30 * DAY);
    expect(bulan).toBeGreaterThan(11);
    expect(bulan).toBeLessThan(13);

    const view = await subscription.getForProject(p.id, owner.id);
    expect(view?.status).toBe("ACTIVE");
    expect(view?.planSlug).toBe("pro");
    expect(view?.paymentRef).toBe("TRF-001");
    expect(view?.daysLeft).toBeGreaterThan(300);

    const notif = await db.notification.count({
      where: { userId: owner.id, type: "subscription.activated" },
    });
    expect(notif).toBe(1);
  });

  it("perpanjangan dihitung dari masa aktif yang tersisa, bukan dari hari ini", async () => {
    const { admin, plan, p } = await project("perpanjang");

    const pertama = await subscription.activate({
      projectId: p.id,
      planId: plan.id,
      actorId: admin.id,
    });
    const kedua = await subscription.activate({
      projectId: p.id,
      planId: plan.id,
      actorId: admin.id,
    });

    const selisihBulan =
      (kedua.endsAt.getTime() - pertama.endsAt.getTime()) / (30 * DAY);
    expect(selisihBulan).toBeGreaterThan(11);
    expect(selisihBulan).toBeLessThan(13);
  });

  it("menolak masa aktif di luar batas dan project yang tidak ada", async () => {
    const { admin, plan, p } = await project("tolak");

    await expectAppError(
      () =>
        subscription.activate({
          projectId: p.id,
          planId: plan.id,
          actorId: admin.id,
          months: 0,
        }),
      "VALIDATION",
    );
    await expectAppError(
      () =>
        subscription.activate({
          projectId: "tidak-ada",
          planId: plan.id,
          actorId: admin.id,
        }),
      "NOT_FOUND",
    );
  });
});

describe("penegakan sebelum terbit", () => {
  it("menolak project tanpa paket, menerima yang aktif maupun dalam tenggang", async () => {
    const { admin, plan, p } = await project("tegak");

    await expectAppError(
      () => subscription.assertActiveForProject(db, p.id),
      "QUOTA_EXCEEDED",
      /belum punya Paket Project aktif/,
    );

    await subscription.activate({
      projectId: p.id,
      planId: plan.id,
      actorId: admin.id,
    });
    await subscription.assertActiveForProject(db, p.id);

    // Masa tenggang: sudah lewat endsAt, tetapi situs masih dikuasai pemiliknya.
    await db.websiteSubscription.update({
      where: { projectId: p.id },
      data: { status: "GRACE", endsAt: hari(-5) },
    });
    await subscription.assertActiveForProject(db, p.id);

    // Tenggang habis.
    await db.websiteSubscription.update({
      where: { projectId: p.id },
      data: { endsAt: hari(-(SUBSCRIPTION_GRACE_DAYS + 2)) },
    });
    await expectAppError(
      () => subscription.assertActiveForProject(db, p.id),
      "QUOTA_EXCEEDED",
      /masa tenggangnya sudah lewat/,
    );
  });
});

describe("pembatalan", () => {
  it("menandai CANCELLED dan menolak pembatalan kedua", async () => {
    const { admin, plan, p } = await project("batal");
    await subscription.activate({
      projectId: p.id,
      planId: plan.id,
      actorId: admin.id,
    });

    await subscription.cancel({ projectId: p.id, actorId: admin.id });
    expect(
      (await db.websiteSubscription.findUniqueOrThrow({ where: { projectId: p.id } }))
        .status,
    ).toBe("CANCELLED");

    await expectAppError(
      () => subscription.cancel({ projectId: p.id, actorId: admin.id }),
      "CONFLICT",
    );
  });
});

describe("siklus otomatis", () => {
  it("mengingatkan, memberi tenggang, lalu meminta situs diturunkan", async () => {
    const { admin, plan, p, owner } = await project("siklus");
    await subscription.activate({
      projectId: p.id,
      planId: plan.id,
      actorId: admin.id,
    });

    // H-7: pengingat terkirim sekali.
    await db.websiteSubscription.update({
      where: { projectId: p.id },
      data: { endsAt: hari(6), remindedAt: null },
    });
    expect((await subscription.sweep()).reminded).toBeGreaterThanOrEqual(1);
    const ulang = await subscription.sweep();
    expect(ulang.reminded).toBe(0);

    // Lewat endsAt → masa tenggang, situs belum diturunkan.
    await db.websiteSubscription.update({
      where: { projectId: p.id },
      data: { endsAt: hari(-1) },
    });
    const tenggang = await subscription.sweep();
    expect(tenggang.graced).toBeGreaterThanOrEqual(1);
    expect(tenggang.takeDown).not.toContain(p.id);
    expect(
      (await db.websiteSubscription.findUniqueOrThrow({ where: { projectId: p.id } }))
        .status,
    ).toBe("GRACE");

    // Tenggang habis → kedaluwarsa dan diminta turun.
    await db.websiteSubscription.update({
      where: { projectId: p.id },
      data: { endsAt: hari(-(SUBSCRIPTION_GRACE_DAYS + 1)) },
    });
    const habis = await subscription.sweep();
    expect(habis.takeDown).toContain(p.id);
    expect(
      (await db.websiteSubscription.findUniqueOrThrow({ where: { projectId: p.id } }))
        .status,
    ).toBe("EXPIRED");

    const jenis = await db.notification.findMany({
      where: { userId: owner.id },
      select: { type: true },
    });
    const semua = jenis.map((n) => n.type);
    expect(semua).toContain("subscription.grace");
    expect(semua).toContain("subscription.expired");
  });

  it("daftar yang akan berakhir memuat project dan pemiliknya", async () => {
    const { admin, plan, p } = await project("akan-berakhir");
    await subscription.activate({
      projectId: p.id,
      planId: plan.id,
      actorId: admin.id,
    });
    await db.websiteSubscription.update({
      where: { projectId: p.id },
      data: { endsAt: hari(10) },
    });

    const rows = await subscription.listExpiringSoon(30);
    const mine = rows.find((r) => r.project.id === p.id);
    expect(mine).toBeTruthy();
    expect(mine?.project.user.email).toContain(tag);
  });
});
