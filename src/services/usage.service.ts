import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import * as quotaService from "@/services/quota.service";
import type { ReserveInput } from "@/services/quota.service";
import type { UsageKind, UsageState } from "@/types/db";

/**
 * Siklus kredit: reserve -> commit / refund. docs/11-QUOTA-DAN-BILLING.md §11.4
 *
 * Pola ini mencegah dua bug yang selalu muncul di sistem berkuota:
 * kuota terpakai padahal kerja gagal, dan kerja berjalan padahal kuota habis.
 *
 * Penegakan batas (menolak saat kuota habis) dan penguncian baris ada di
 * quota.service. Berkas ini mengurus pergerakan status reservasi.
 */

export type { ReserveInput };

/**
 * Memotong kredit di muka dan mencatat UsageEvent(RESERVED), MENOLAK bila
 * kuota habis. Penguncian & penegakan ada di quota.service (docs/11 §11.4);
 * fungsi ini membungkusnya dalam transaksi sendiri untuk pemanggil di luar
 * transaksi. Pembuatan job memakai reserveCreditsInTx langsung.
 */
export async function reserve(input: ReserveInput): Promise<string> {
  return db.$transaction((tx) => quotaService.reserveCreditsInTx(tx, input));
}

/**
 * Mencatat pemakaian yang langsung final, tanpa reservasi.
 *
 * Dipakai deploy (docs/11: 0 kredit, dibatasi `maxDeploysPerDay`). Deploy dicatat
 * saat BERHASIL saja: tidak ada kredit yang perlu ditahan, dan menghitung
 * percobaan gagal ke batas harian akan menghukum pengguna atas kegagalan vendor.
 */
export async function record(input: Omit<ReserveInput, "buildJobId">): Promise<void> {
  await db.$transaction(async (tx) => {
    if (input.credits > 0) {
      await tx.user.update({
        where: { id: input.userId },
        data: { creditsUsed: { increment: input.credits } },
      });
    }

    await tx.usageEvent.create({
      data: {
        kind: input.kind,
        state: "COMMITTED",
        credits: input.credits,
        userId: input.userId,
        projectId: input.projectId ?? null,
        model: input.model ?? null,
      },
    });
  });

  logger.info("usage.recorded", { kind: input.kind, credits: input.credits });
}

/** Kerja berhasil: reservasi menjadi final, penghitung tetap. */
export async function commit(usageEventId: string): Promise<void> {
  const result = await db.usageEvent.updateMany({
    where: { id: usageEventId, state: "RESERVED" },
    data: { state: "COMMITTED" },
  });

  if (result.count === 0) {
    logger.warn("usage.commit_noop", { usageEventId });
    return;
  }

  logger.info("usage.committed", { usageEventId });
}

/**
 * Kerja gagal atau dibatalkan: kredit dikembalikan.
 *
 * IDEMPOTEN. Memanggilnya dua kali tidak mengembalikan dua kali, karena klausa
 * `state: "RESERVED"` hanya cocok sekali. Itu penting: refund dipicu dari
 * beberapa jalur (kegagalan, pembatalan, cron penyapu) yang bisa bertabrakan.
 */
export async function refund(usageEventId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await tx.usageEvent.findUnique({
      where: { id: usageEventId },
      select: { id: true, state: true, credits: true, userId: true },
    });

    if (!event || event.state !== "RESERVED") {
      logger.warn("usage.refund_noop", { usageEventId, state: event?.state });
      return;
    }

    await tx.usageEvent.update({
      where: { id: usageEventId },
      data: { state: "REFUNDED" },
    });

    if (event.userId) {
      // Tidak pernah di bawah nol. Penghitung bisa sudah direset (periode baru,
      // Super Admin mereset pemakaian) sejak reservasi ini dibuat; mengurangi
      // begitu saja akan menghasilkan kredit negatif, yang berarti pengguna
      // mendapat kuota lebih dari paketnya.
      const user = await tx.user.findUnique({
        where: { id: event.userId },
        select: { creditsUsed: true },
      });

      if (user) {
        await tx.user.update({
          where: { id: event.userId },
          data: { creditsUsed: Math.max(0, user.creditsUsed - event.credits) },
        });
      }
    }

    logger.info("usage.refunded", { usageEventId, credits: event.credits });
  });
}

/**
 * Jaring pengaman: mengembalikan reservasi yang tertinggal terlalu lama.
 *
 * Dipanggil cron. Reservasi yang masih RESERVED padahal job-nya sudah selesai
 * atau proses pembuatnya mati mendadak akan menahan kredit pengguna selamanya.
 */
export async function refundStale(olderThanMinutes = 30): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);

  const stale = await db.usageEvent.findMany({
    where: {
      state: "RESERVED",
      createdAt: { lt: cutoff },
      OR: [
        { buildJob: { status: { in: ["SUCCEEDED", "FAILED", "CANCELLED"] } } },
        // Yatim: job-nya sudah terhapus (project dihapus permanen). Relasinya
        // menjadi null, sehingga refund per-job tidak akan pernah menemukannya
        // dan kredit pengguna tertahan selamanya.
        { buildJobId: null },
      ],
    },
    select: { id: true },
  });

  for (const event of stale) {
    await refund(event.id);
  }

  if (stale.length > 0) {
    logger.warn("usage.refunded_stale", { count: stale.length });
  }

  return stale.length;
}

/* ============================================================
 *  BACA — riwayat untuk pengguna (docs/11 §11.6)
 * ============================================================ */

export interface UsageHistoryItem {
  id: string;
  kind: UsageKind;
  state: UsageState;
  credits: number;
  projectId: string | null;
  /** null bila project sudah dihapus — catatan pemakaiannya tetap ada. */
  projectName: string | null;
  model: string | null;
  createdAt: Date;
}

/**
 * Riwayat pemakaian kredit milik satu pengguna.
 *
 * `UsageEvent.projectId` sengaja TANPA relasi (docs/06): catatan pemakaian
 * harus selamat ketika project dihapus. Karena itu nama project diambil lewat
 * query kedua yang tetap menyertakan `userId` (docs/06 §6.7), dan project yang
 * sudah hilang tampil tanpa nama alih-alih menghilangkan barisnya.
 */
export async function listHistory(
  userId: string,
  limit = 30,
): Promise<UsageHistoryItem[]> {
  const events = await db.usageEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      kind: true,
      state: true,
      credits: true,
      projectId: true,
      model: true,
      createdAt: true,
    },
  });

  const ids = [...new Set(events.flatMap((e) => (e.projectId ? [e.projectId] : [])))];
  const projects = ids.length
    ? await db.project.findMany({
        where: { id: { in: ids }, userId },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(projects.map((p) => [p.id, p.name]));

  return events.map((e) => ({
    ...e,
    projectName: e.projectId ? (nameById.get(e.projectId) ?? null) : null,
  }));
}
