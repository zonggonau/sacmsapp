import {
  SUBSCRIPTION_GRACE_DAYS,
  SUBSCRIPTION_REMINDER_DAYS,
  TOPUP_PAGE,
} from "@/config/billing";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { tanggal } from "@/lib/format";
import { logger } from "@/lib/logger";
import type { AuditTrail } from "@/services/audit.service";
import type { SubscriptionStatus } from "@/types/db";

/**
 * Paket Project — langganan tahunan per website (ADR-012).
 *
 * Satu baris per project; perpanjangan memajukan `endsAt`, dan riwayatnya ada
 * di audit log. Pembayaran masih manual: Super Admin mengaktifkan setelah
 * transfer diterima (Midtrans menyusul di v1.1, ADR-010).
 *
 * Siklusnya: AKTIF → (lewat `endsAt`) GRACE 30 hari, situs masih tayang →
 * KEDALUWARSA, situs diturunkan.
 *
 * `sweep()` sengaja TIDAK memanggil deploy.service: tahap berikutnya membuat
 * deploy.service memeriksa langganan, dan saling-impor antar keduanya akan
 * menjadi lingkaran. Fungsi ini mengembalikan daftar project yang harus
 * diturunkan, dan pemanggilnya (cron) yang menurunkannya.
 */

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const DAY_MS = 24 * 60 * 60_000;

function planActionError(message: string) {
  return new AppError("QUOTA_EXCEEDED", message, {
    action: { label: "Lihat Paket", href: TOPUP_PAGE },
  });
}

function daysBetween(from: Date, to: Date): number {
  return Math.ceil((to.getTime() - from.getTime()) / DAY_MS);
}

/* ============================================================
 *  BACA
 * ============================================================ */

export interface SubscriptionView {
  status: SubscriptionStatus;
  planName: string;
  planSlug: string;
  startsAt: Date;
  endsAt: Date;
  /** Sisa hari sampai `endsAt`; negatif berarti sudah lewat. */
  daysLeft: number;
  inGrace: boolean;
  /** Tanggal situs diturunkan bila tidak diperpanjang. */
  takedownAt: Date;
  paymentRef: string | null;
}

export async function getForProject(
  projectId: string,
  userId: string,
  now: Date = new Date(),
): Promise<SubscriptionView | null> {
  // Kepemilikan ada DI DALAM query (docs/06 §6.7).
  const row = await db.websiteSubscription.findFirst({
    where: { projectId, project: { userId, deletedAt: null } },
    select: {
      status: true,
      startsAt: true,
      endsAt: true,
      paymentRef: true,
      plan: { select: { name: true, slug: true } },
    },
  });
  if (!row) return null;

  return {
    status: row.status,
    planName: row.plan.name,
    planSlug: row.plan.slug,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    daysLeft: daysBetween(now, row.endsAt),
    inGrace: row.status === "GRACE",
    takedownAt: new Date(row.endsAt.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS),
    paymentRef: row.paymentRef,
  };
}

/**
 * Penerbitan dan custom domain hanya untuk project dengan paket aktif.
 *
 * Masa tenggang tetap dianggap aktif: pelanggan yang terlambat bayar tidak
 * kehilangan kendali atas situsnya yang masih tayang.
 */
export async function assertActiveForProject(
  client: Tx | typeof db,
  projectId: string,
  now: Date = new Date(),
): Promise<void> {
  const row = await client.websiteSubscription.findUnique({
    where: { projectId },
    select: { status: true, endsAt: true },
  });

  if (!row || row.status === "EXPIRED" || row.status === "CANCELLED") {
    throw planActionError(
      "Website ini belum punya Paket Project aktif. Aktifkan paketnya untuk menerbitkan dan memakai custom domain.",
    );
  }

  const graceEnd = new Date(row.endsAt.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS);
  if (graceEnd <= now) {
    throw planActionError(
      `Paket Project website ini berakhir pada ${tanggal(row.endsAt)} dan masa tenggangnya sudah lewat. Perpanjang untuk menerbitkan lagi.`,
    );
  }
}

export async function listExpiringSoon(days = 30, now: Date = new Date()) {
  return db.websiteSubscription.findMany({
    where: {
      status: { in: ["ACTIVE", "GRACE"] },
      endsAt: { lte: new Date(now.getTime() + days * DAY_MS) },
    },
    orderBy: { endsAt: "asc" },
    select: {
      id: true,
      status: true,
      endsAt: true,
      project: { select: { id: true, name: true, user: { select: { email: true } } } },
      plan: { select: { name: true } },
    },
  });
}

/* ============================================================
 *  TULIS — dijalankan Super Admin setelah pembayaran manual
 * ============================================================ */

export interface ActivateInput {
  projectId: string;
  planId: string;
  months?: number;
  paymentRef?: string | undefined;
  actorId: string;
}

/**
 * Mengaktifkan atau memperpanjang Paket Project.
 *
 * Perpanjangan dihitung dari `endsAt` yang masih berjalan, bukan dari hari ini:
 * pelanggan yang memperpanjang lebih awal tidak kehilangan sisa masa aktifnya.
 */
export async function activate(
  input: ActivateInput,
  now: Date = new Date(),
): Promise<AuditTrail & { endsAt: Date }> {
  const months = input.months ?? 12;
  if (!Number.isInteger(months) || months < 1 || months > 60) {
    throw new AppError("VALIDATION", "Masa aktif harus 1–60 bulan.");
  }

  const project = await db.project.findFirst({
    where: { id: input.projectId, deletedAt: null },
    select: { id: true, name: true, userId: true },
  });
  if (!project) throw new AppError("NOT_FOUND", "Project tidak ditemukan.");

  const plan = await db.plan.findUnique({
    where: { id: input.planId },
    select: { id: true, name: true },
  });
  if (!plan) throw new AppError("NOT_FOUND", "Paket tidak ditemukan.");

  const existing = await db.websiteSubscription.findUnique({
    where: { projectId: project.id },
    select: { status: true, endsAt: true, plan: { select: { name: true } } },
  });

  const base =
    existing && existing.endsAt > now && existing.status !== "CANCELLED"
      ? existing.endsAt
      : now;
  const endsAt = new Date(base);
  endsAt.setMonth(endsAt.getMonth() + months);

  await db.websiteSubscription.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      planId: plan.id,
      status: "ACTIVE",
      startsAt: now,
      endsAt,
      activatedById: input.actorId,
      paymentRef: input.paymentRef ?? null,
    },
    update: {
      planId: plan.id,
      status: "ACTIVE",
      endsAt,
      activatedById: input.actorId,
      paymentRef: input.paymentRef ?? null,
      remindedAt: null,
    },
  });

  await db.notification.create({
    data: {
      userId: project.userId,
      type: "subscription.activated",
      title: `Paket ${plan.name} aktif untuk ${project.name}`,
      body: `Website ini aktif sampai ${tanggal(endsAt)}.`,
      href: `/projects/${project.id}`,
    },
  });

  logger.info("subscription.activated", {
    projectId: project.id,
    planId: plan.id,
    months,
    endsAt,
  });

  return {
    targetType: "Project",
    targetId: project.id,
    before: existing
      ? { status: existing.status, endsAt: existing.endsAt, paket: existing.plan.name }
      : { status: "tidak ada" },
    after: { status: "ACTIVE", endsAt, paket: plan.name, bulan: months },
    endsAt,
  };
}

/** Membatalkan langganan: situs tetap tayang sampai `endsAt` berakhir. */
export async function cancel(input: {
  projectId: string;
  actorId: string;
}): Promise<AuditTrail> {
  const row = await db.websiteSubscription.findUnique({
    where: { projectId: input.projectId },
    select: { status: true, endsAt: true },
  });
  if (!row) throw new AppError("NOT_FOUND", "Langganan tidak ditemukan.");
  if (row.status === "CANCELLED") {
    throw new AppError("CONFLICT", "Langganan ini sudah dibatalkan.");
  }

  await db.websiteSubscription.update({
    where: { projectId: input.projectId },
    data: { status: "CANCELLED" },
  });

  logger.warn("subscription.cancelled", { projectId: input.projectId });

  return {
    targetType: "Project",
    targetId: input.projectId,
    before: { status: row.status, endsAt: row.endsAt },
    after: { status: "CANCELLED" },
  };
}

/* ============================================================
 *  CRON — siklus langganan
 * ============================================================ */

export interface SweepResult {
  reminded: number;
  graced: number;
  expired: number;
  /** Project yang situsnya harus diturunkan oleh pemanggil. */
  takeDown: string[];
}

export async function sweep(now: Date = new Date()): Promise<SweepResult> {
  const result: SweepResult = { reminded: 0, graced: 0, expired: 0, takeDown: [] };

  // 1. Pengingat H-30 dan H-7, sekali per ambang.
  for (const days of SUBSCRIPTION_REMINDER_DAYS) {
    const until = new Date(now.getTime() + days * DAY_MS);
    const due = await db.websiteSubscription.findMany({
      where: {
        status: "ACTIVE",
        endsAt: { gt: now, lte: until },
        OR: [
          { remindedAt: null },
          { remindedAt: { lt: new Date(now.getTime() - DAY_MS) } },
        ],
      },
      select: {
        id: true,
        endsAt: true,
        remindedAt: true,
        project: { select: { id: true, name: true, userId: true } },
      },
    });

    for (const row of due) {
      const sisa = daysBetween(now, row.endsAt);
      const already = await db.notification.findFirst({
        where: {
          userId: row.project.userId,
          type: `subscription.reminder:${row.id}:${days}`,
        },
        select: { id: true },
      });
      if (already) continue;

      await db.notification.create({
        data: {
          userId: row.project.userId,
          type: `subscription.reminder:${row.id}:${days}`,
          title: `Paket ${row.project.name} berakhir ${sisa} hari lagi`,
          body: `Perpanjang sebelum ${tanggal(row.endsAt)} agar website tetap tayang.`,
          href: `/projects/${row.project.id}`,
        },
      });
      await db.websiteSubscription.update({
        where: { id: row.id },
        data: { remindedAt: now },
      });
      result.reminded += 1;
    }
  }

  // 2. Lewat endsAt → masa tenggang; situs masih tayang.
  const lapsed = await db.websiteSubscription.findMany({
    where: { status: "ACTIVE", endsAt: { lte: now } },
    select: {
      id: true,
      endsAt: true,
      project: { select: { id: true, name: true, userId: true } },
    },
  });

  for (const row of lapsed) {
    await db.websiteSubscription.update({
      where: { id: row.id },
      data: { status: "GRACE" },
    });
    await db.notification.create({
      data: {
        userId: row.project.userId,
        type: "subscription.grace",
        title: `Paket ${row.project.name} sudah berakhir`,
        body: `Website masih tayang selama ${SUBSCRIPTION_GRACE_DAYS} hari. Perpanjang sebelum ${tanggal(new Date(row.endsAt.getTime() + SUBSCRIPTION_GRACE_DAYS * DAY_MS))} agar tidak diturunkan.`,
        href: `/projects/${row.project.id}`,
      },
    });
    result.graced += 1;
  }

  // 3. Masa tenggang habis → kedaluwarsa; situs diturunkan pemanggil.
  const graceCutoff = new Date(now.getTime() - SUBSCRIPTION_GRACE_DAYS * DAY_MS);
  const done = await db.websiteSubscription.findMany({
    where: { status: { in: ["GRACE", "CANCELLED"] }, endsAt: { lte: graceCutoff } },
    select: {
      id: true,
      project: { select: { id: true, name: true, userId: true } },
    },
  });

  for (const row of done) {
    await db.websiteSubscription.update({
      where: { id: row.id },
      data: { status: "EXPIRED" },
    });
    await db.notification.create({
      data: {
        userId: row.project.userId,
        type: "subscription.expired",
        title: `Website ${row.project.name} diturunkan`,
        body: "Paket Project-nya sudah kedaluwarsa. Project dan seluruh versinya masih tersimpan; perpanjang paket untuk menerbitkannya lagi.",
        href: `/projects/${row.project.id}`,
      },
    });
    result.takeDown.push(row.project.id);
    result.expired += 1;
  }

  if (result.reminded + result.graced + result.expired > 0) {
    logger.info("subscription.swept", {
      reminded: result.reminded,
      graced: result.graced,
      expired: result.expired,
      diturunkan: result.takeDown.length,
    });
  }

  return result;
}
