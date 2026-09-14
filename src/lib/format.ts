import { formatDistanceToNow, format as formatDate } from "date-fns";
import { id } from "date-fns/locale";

/**
 * Semua format tanggal dan angka lewat berkas ini — docs/05 §5.10 aturan 2.
 *
 * Alasannya bukan kerapian: memanggil toLocaleDateString() langsung di komponen
 * membuat migrasi i18n di v1.2 berarti menyisir seluruh basis kode.
 */

/** "14 September 2026" */
export function tanggal(value: Date | string): string {
  return formatDate(new Date(value), "d MMMM yyyy", { locale: id });
}

/** "14 Sep 2026, 20.15" */
export function tanggalWaktu(value: Date | string): string {
  return formatDate(new Date(value), "d MMM yyyy, HH.mm", { locale: id });
}

/** "3 hari lalu" */
export function sejak(value: Date | string): string {
  return formatDistanceToNow(new Date(value), { addSuffix: true, locale: id });
}

/** "1.500" — pemisah ribuan titik sesuai kaidah Indonesia */
export function angka(value: number): string {
  return new Intl.NumberFormat("id-ID").format(value);
}

/** "Rp 149.000" */
export function rupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

/** "1 mnt 12 dtk", "850 md" — durasi build dan langkah. */
export function durasi(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)} md`;
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes} mnt ${seconds} dtk` : `${seconds} dtk`;
}

/** Membuang skema dan garis miring akhir agar URL enak dibaca di kartu. */
export function urlRingkas(value: string): string {
  return value.replace(/^https?:\/\//, "").replace(/\/$/, "");
}
