import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { UsageKind } from "@/types/db";

/**
 * Siklus kredit: reserve -> commit / refund. docs/11-QUOTA-DAN-BILLING.md §11.4
 *
 * Pola ini mencegah dua bug yang selalu muncul di sistem berkuota:
 * kuota terpakai padahal kerja gagal, dan kerja berjalan padahal kuota habis.
 *
 * CATATAN FASE: yang diterapkan di sini adalah PENCATATAN dan pergerakan
 * penghitung. PENEGAKAN batas (menolak saat kuota habis) masuk di Fase 6 pada
 * titik yang ditandai di bawah — lihat docs/13. Tanpa penegakan, pembatalan
 * build tetap mengembalikan kredit dengan benar, yang dibutuhkan Fase 3.
 */

export interface ReserveInput {
  userId: string;
  kind: UsageKind;
  credits: number;
  projectId?: string | undefined;
  buildJobId?: string | undefined;
  model?: string | undefined;
}

/**
 * Memotong kredit di muka dan mencatat UsageEvent(RESERVED).
 *
 * Seluruhnya dalam satu transaksi. Tanpa transaksi, dua permintaan bersamaan
 * bisa sama-sama lolos pemeriksaan lalu melewati batas — kondisi balapan klasik
 * (docs/12 ancaman A12).
 */
export async function reserve(input: ReserveInput): Promise<string> {
  return db.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: {
        creditsUsed: true,
        creditsOverride: true,
        plan: { select: { monthlyCredits: true } },
      },
    });

    const limit = user.creditsOverride ?? user.plan.monthlyCredits;

    // --- PENEGAKAN BATAS (Fase 6) ---
    // if (user.creditsUsed + input.credits > limit) {
    //   throw new AppError("QUOTA_EXCEEDED", ERROR_MESSAGES.QUOTA_EXCEEDED, {
    //     action: { label: "Lihat Paket", href: "/akun/paket" },
    //   });
    // }

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

    logger.info("usage.reserved", {
      usageEventId: event.id,
      kind: input.kind,
      credits: input.credits,
      creditsUsedAfter: user.creditsUsed + input.credits,
      limit,
    });

    return event.id;
  });
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
