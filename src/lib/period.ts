/**
 * Waktu kuota — docs/11 §11.5. Berkas murni tanpa I/O.
 *
 * - Periode kredit BERGULIR per pengguna, 30 hari sejak `periodStartedAt`.
 * - "Hari ini" untuk batas deploy harian memakai WIB (UTC+7, tanpa DST), bukan
 *   zona waktu server: server Vercel berjalan di UTC, sehingga tanpa ini batas
 *   harian pengguna Indonesia terputus pukul 07.00 pagi.
 */

export const PERIOD_DAYS = 30;
const DAY_MS = 24 * 60 * 60_000;
const WIB_OFFSET_MS = 7 * 60 * 60_000;

export function periodEndsAt(periodStartedAt: Date): Date {
  return new Date(periodStartedAt.getTime() + PERIOD_DAYS * DAY_MS);
}

/** Awal hari kalender WIB yang memuat `now`. */
export function startOfDayWib(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + WIB_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - WIB_OFFSET_MS);
}

/**
 * Awal periode baru bagi periode yang sudah lewat. Maju per kelipatan 30 hari
 * dari awal lama — BUKAN "sekarang" — supaya tanggal reset pengguna tetap
 * sama setiap bulan meski cron sempat terlambat.
 *
 * @returns null bila periode belum berakhir.
 */
export function nextPeriodStart(
  periodStartedAt: Date,
  now: Date = new Date(),
): Date | null {
  const elapsed = now.getTime() - periodStartedAt.getTime();
  const periods = Math.floor(elapsed / (PERIOD_DAYS * DAY_MS));
  if (periods < 1) return null;
  return new Date(periodStartedAt.getTime() + periods * PERIOD_DAYS * DAY_MS);
}
