import { LOW_CREDIT_RATIO, PLAN_PAGE, UPGRADE_HINT } from "@/config/quota";
import * as creditService from "@/services/credit.service";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { tanggal } from "@/lib/format";
import { logger } from "@/lib/logger";
import { nextPeriodStart, periodEndsAt, startOfDayWib } from "@/lib/period";
import type { UsageKind } from "@/types/db";

/**
 * Penegakan kuota — docs/11-QUOTA-DAN-BILLING.md §11.3–11.5.
 *
 * Empat pemeriksaan, semuanya membaca batas dari tabel Plan SAAT ITU JUGA
 * (tidak pernah disalin ke kolom pengguna), sehingga perubahan paket atau
 * kuota manual oleh Super Admin berlaku tanpa deploy:
 *
 *   kredit bulanan   reserveCreditsInTx
 *   jumlah project   assertCanCreateProject
 *   jumlah domain    assertCanAddDomain
 *   deploy harian    assertCanDeploy
 *
 * ATURAN PENGUNCIAN: setiap pemeriksaan mengunci baris USER lebih dulu
 * (SELECT … FOR UPDATE), sebelum baris lain apa pun. Urutan yang seragam inilah
 * yang mencegah deadlock antara build dan deploy pada project yang sama, dan
 * penguncian itulah yang membuat dua permintaan bersamaan pada kredit terakhir
 * hanya meloloskan satu (docs/12 ancaman A12).
 *
 * Menurunkan batas tidak memutus apa pun yang sudah ada — pemeriksaan hanya
 * dilakukan saat MEMBUAT sesuatu yang baru (docs/10 §10.6).
 */

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

const PLAN_ACTION = { label: "Lihat Paket", href: PLAN_PAGE };

function quotaError(message: string) {
  return new AppError("QUOTA_EXCEEDED", `${message} ${UPGRADE_HINT}`, {
    action: PLAN_ACTION,
  });
}

/** Kunci baris pengguna. WAJIB dipanggil pertama di transaksi yang memeriksa kuota. */
export async function lockUserInTx(tx: Tx, userId: string): Promise<void> {
  await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`;
}

async function loadLimits(tx: Tx | typeof db, userId: string) {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: {
      creditsUsed: true,
      creditsOverride: true,
      maxProjectsOverride: true,
      periodStartedAt: true,
      plan: {
        select: {
          name: true,
          monthlyCredits: true,
          maxProjects: true,
          maxCustomDomains: true,
          maxDeploysPerDay: true,
        },
      },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "Pengguna tidak ditemukan.");

  return {
    planName: user.plan.name,
    creditsUsed: user.creditsUsed,
    creditLimit: user.creditsOverride ?? user.plan.monthlyCredits,
    projectLimit: user.maxProjectsOverride ?? user.plan.maxProjects,
    domainLimit: user.plan.maxCustomDomains,
    deployLimit: user.plan.maxDeploysPerDay,
    periodStartedAt: user.periodStartedAt,
  };
}

/* ============================================================
 *  KREDIT
 * ============================================================ */

function creditsExhausted(l: Awaited<ReturnType<typeof loadLimits>>) {
  return quotaError(
    `Kredit bulan ini sudah habis (${l.creditsUsed} dari ${l.creditLimit} kredit paket ${l.planName}). Kredit terisi kembali pada ${tanggal(periodEndsAt(l.periodStartedAt))}.`,
  );
}

/**
 * Pemeriksaan awal tanpa kunci — hanya untuk menolak lebih dini sebelum
 * membuat sesuatu (mis. project baru sebelum job pertamanya). Keputusan final
 * tetap di reserveCreditsInTx.
 */
export async function assertCreditsAvailable(
  userId: string,
  credits: number,
): Promise<void> {
  const limits = await loadLimits(db, userId);
  if (limits.creditsUsed + credits > limits.creditLimit) throw creditsExhausted(limits);
}

export interface ReserveInput {
  userId: string;
  kind: UsageKind;
  credits: number;
  projectId?: string | undefined;
  buildJobId?: string | undefined;
  model?: string | undefined;
}

/**
 * Memotong kredit di muka dan mencatat UsageEvent(RESERVED) — docs/11 §11.4.
 * Harus berjalan di dalam transaksi pemanggil.
 */
export async function reserveCreditsInTx(tx: Tx, input: ReserveInput): Promise<string> {
  await lockUserInTx(tx, input.userId);
  const limits = await loadLimits(tx, input.userId);

  if (limits.creditsUsed + input.credits > limits.creditLimit) {
    throw creditsExhausted(limits);
  }

  await tx.user.update({
    where: { id: input.userId },
    data: { creditsUsed: { increment: input.credits } },
  });

  const event = await tx.usageEvent.create({
    data: {
      kind: input.kind,
      state: "RESERVED",
      credits: input.credits,
      userId: input.userId,
      projectId: input.projectId ?? null,
      buildJobId: input.buildJobId ?? null,
      model: input.model ?? null,
    },
    select: { id: true },
  });

  const usedAfter = limits.creditsUsed + input.credits;
  const remaining = limits.creditLimit - usedAfter;

  // Peringatan kredit menipis: SEKALI per periode, bukan setiap generate.
  if (limits.creditLimit > 0 && remaining <= limits.creditLimit * LOW_CREDIT_RATIO) {
    const alreadyWarned = await tx.notification.findFirst({
      where: {
        userId: input.userId,
        type: "quota.low",
        createdAt: { gte: limits.periodStartedAt },
      },
      select: { id: true },
    });

    if (!alreadyWarned) {
      await tx.notification.create({
        data: {
          userId: input.userId,
          type: "quota.low",
          title: "Kredit Anda tinggal sedikit",
          body: `Sisa ${remaining} dari ${limits.creditLimit} kredit bulan ini. Kredit terisi kembali pada ${tanggal(periodEndsAt(limits.periodStartedAt))}.`,
          href: PLAN_PAGE,
        },
      });
    }
  }

  logger.info("usage.reserved", {
    usageEventId: event.id,
    kind: input.kind,
    credits: input.credits,
    creditsUsedAfter: usedAfter,
    limit: limits.creditLimit,
  });

  return event.id;
}

/* ============================================================
 *  BATAS JUMLAH & HARIAN
 * ============================================================ */

export async function assertCanCreateProject(tx: Tx, userId: string): Promise<void> {
  await lockUserInTx(tx, userId);
  const limits = await loadLimits(tx, userId);
  const count = await tx.project.count({ where: { userId, deletedAt: null } });

  if (count >= limits.projectLimit) {
    throw quotaError(
      `Paket ${limits.planName} maksimal ${limits.projectLimit} website. Hapus project yang tidak dipakai atau tingkatkan paket.`,
    );
  }
}

export async function assertCanAddDomain(tx: Tx, userId: string): Promise<void> {
  await lockUserInTx(tx, userId);
  const limits = await loadLimits(tx, userId);

  if (limits.domainLimit === 0) {
    throw quotaError(`Paket ${limits.planName} belum mendukung custom domain.`);
  }

  const count = await tx.domain.count({
    where: { project: { userId, deletedAt: null } },
  });

  if (count >= limits.domainLimit) {
    throw quotaError(
      `Paket ${limits.planName} maksimal ${limits.domainLimit} custom domain. Lepas domain yang tidak dipakai atau tingkatkan paket.`,
    );
  }
}

/**
 * Deploy yang dihitung: yang BERHASIL hari ini (WIB) ditambah yang sedang
 * berjalan. Deploy gagal tidak dihitung — kegagalan vendor tidak boleh memakan
 * jatah pengguna — tetapi yang berjalan dihitung, supaya tidak ada yang bisa
 * menembakkan puluhan deploy bersamaan untuk melewati batas.
 */
export async function assertCanDeploy(tx: Tx, userId: string): Promise<void> {
  await lockUserInTx(tx, userId);
  const limits = await loadLimits(tx, userId);

  const [succeeded, running] = await Promise.all([
    tx.usageEvent.count({
      where: {
        userId,
        kind: "DEPLOY",
        state: "COMMITTED",
        createdAt: { gte: startOfDayWib() },
      },
    }),
    tx.deployment.count({
      where: { status: { in: ["QUEUED", "BUILDING"] }, project: { userId } },
    }),
  ]);

  if (succeeded + running >= limits.deployLimit) {
    throw quotaError(
      `Batas penerbitan harian tercapai (${limits.deployLimit} per hari untuk paket ${limits.planName}). Coba lagi besok.`,
    );
  }
}

/* ============================================================
 *  BACA
 * ============================================================ */

export interface QuotaSnapshot {
  planName: string;
  planSlug: string;
  creditsUsed: number;
  creditLimit: number;
  creditsOverridden: boolean;
  projectCount: number;
  projectLimit: number;
  projectsOverridden: boolean;
  domainCount: number;
  domainLimit: number;
  deploysToday: number;
  deployLimit: number;
  periodStartedAt: Date;
  periodEndsAt: Date;
}

/** Batas yang BERLAKU saat ini, dibaca dari paket di database setiap kali. */
export async function getQuota(userId: string): Promise<QuotaSnapshot | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      creditsUsed: true,
      creditsOverride: true,
      maxProjectsOverride: true,
      periodStartedAt: true,
      plan: {
        select: {
          name: true,
          slug: true,
          monthlyCredits: true,
          maxProjects: true,
          maxCustomDomains: true,
          maxDeploysPerDay: true,
        },
      },
    },
  });
  if (!user) return null;

  const [projectCount, domainCount, deploysToday] = await Promise.all([
    db.project.count({ where: { userId, deletedAt: null } }),
    db.domain.count({ where: { project: { userId, deletedAt: null } } }),
    db.usageEvent.count({
      where: {
        userId,
        kind: "DEPLOY",
        state: "COMMITTED",
        createdAt: { gte: startOfDayWib() },
      },
    }),
  ]);

  return {
    planName: user.plan.name,
    planSlug: user.plan.slug,
    creditsUsed: user.creditsUsed,
    creditLimit: user.creditsOverride ?? user.plan.monthlyCredits,
    creditsOverridden: user.creditsOverride !== null,
    projectCount,
    projectLimit: user.maxProjectsOverride ?? user.plan.maxProjects,
    projectsOverridden: user.maxProjectsOverride !== null,
    domainCount,
    domainLimit: user.plan.maxCustomDomains,
    deploysToday,
    deployLimit: user.plan.maxDeploysPerDay,
    periodStartedAt: user.periodStartedAt,
    periodEndsAt: periodEndsAt(user.periodStartedAt),
  };
}

/** Versi ringan untuk topbar — satu query, dipanggil di setiap halaman. */
export async function getCreditSummary(
  userId: string,
): Promise<{ used: number; limit: number } | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      creditsUsed: true,
      creditsOverride: true,
      plan: { select: { monthlyCredits: true } },
    },
  });
  if (!user) return null;
  return {
    used: user.creditsUsed,
    limit: user.creditsOverride ?? user.plan.monthlyCredits,
  };
}

/* ============================================================
 *  CRON
 * ============================================================ */

/**
 * Reset periode yang sudah berakhir — docs/11 §11.5. Dipanggil cron harian.
 *
 * Pembaruan bersyarat pada `periodStartedAt` lama: dua eksekusi cron yang
 * bertabrakan tidak bisa mereset pengguna yang sama dua kali.
 */
export async function resetExpiredPeriods(now: Date = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
  const due = await db.user.findMany({
    where: { periodStartedAt: { lte: cutoff } },
    select: { id: true, periodStartedAt: true, creditsUsed: true },
    take: 1000,
  });

  let reset = 0;
  for (const user of due) {
    const next = nextPeriodStart(user.periodStartedAt, now);
    if (!next) continue;

    const res = await db.user.updateMany({
      where: { id: user.id, periodStartedAt: user.periodStartedAt },
      data: { creditsUsed: 0, periodStartedAt: next },
    });
    reset += res.count;
  }

  if (reset > 0) logger.info("quota.periods_reset", { count: reset });
  return reset;
}

/* ============================================================
 *  PENGHALANG AKSI UNTUK UI — docs/11 §11.6
 * ============================================================ */

export interface ActionBlockers {
  /** Sisa kredit di dompet akun (ADR-012). */
  walletCredits: number;
  /** Kredit yang akan hangus dalam 30 hari. */
  walletExpiringSoon: number;
  creditsLeft: number;
  creditLimit: number;
  /** Alasan generate/edit tidak bisa dijalankan; null bila bisa. */
  credit: string | null;
  /** Alasan project baru tidak bisa dibuat; null bila bisa. */
  project: string | null;
  /** Alasan penerbitan tidak bisa dijalankan hari ini; null bila bisa. */
  deploy: string | null;
}

/**
 * Alasan tombol dinonaktifkan SEBELUM diklik — docs/11 §11.6: "saat kuota habis,
 * tombol tetap terlihat tetapi nonaktif dengan tooltip yang menjelaskan".
 *
 * Hanya untuk tampilan. Penegakan sebenarnya tetap di assert* di dalam transaksi,
 * karena keadaan bisa berubah di antara render dan klik.
 */
export async function getActionBlockers(
  userId: string,
): Promise<ActionBlockers | null> {
  const [q, wallet] = await Promise.all([
    getQuota(userId),
    creditService.getBalance(userId),
  ]);
  if (!q) return null;

  const creditsLeft = Math.max(0, q.creditLimit - q.creditsUsed);

  return {
    walletCredits: wallet.total,
    walletExpiringSoon: wallet.expiringSoon,
    creditsLeft,
    creditLimit: q.creditLimit,
    // ADR-012: kredit berasal dari dompet akun, bukan kuota bulanan paket.
    credit:
      wallet.total <= 0
        ? "Kredit AI Anda habis. Isi ulang kredit untuk membuat atau mengubah website."
        : null,
    project:
      q.projectCount >= q.projectLimit
        ? `Paket ${q.planName} maksimal ${q.projectLimit} website. Hapus project lama atau lihat halaman Paket.`
        : null,
    deploy:
      q.deploysToday >= q.deployLimit
        ? `Batas penerbitan harian (${q.deployLimit}× sehari) tercapai. Coba lagi setelah pukul 00.00 WIB.`
        : null,
  };
}
