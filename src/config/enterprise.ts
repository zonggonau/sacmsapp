/**
 * Paket Enterprise hanya dijual di SaCMS Developer — ADR-015 §7, RENCANA-FRONTEND.md §7.
 * Aplikasi ini hanya menaut keluar: tidak ada pembayaran Enterprise di sini.
 *
 * NEXT_PUBLIC_SACMS_DEVELOPER_URL memungkinkan tautan diarahkan ke alamat SaCMS saat ini
 * selama developer.sacms.cloud belum aktif (urutan cutover RENCANA-PEMISAHAN-PLATFORM §2b).
 */
const base = (
  process.env.NEXT_PUBLIC_SACMS_DEVELOPER_URL?.trim() || "https://developer.sacms.cloud"
).replace(/\/+$/, "");

export const SACMS_DEVELOPER = {
  name: "SaCMS Developer",
  host: base.replace(/^https?:\/\//, ""),
  // Server SaCMS mengabaikan `plan` dari klien saat mendaftar; parameter ini hanya
  // penanda asal kunjungan, bukan cara mendapatkan paket.
  registerHref: `${base}/register?plan=enterprise`,
  docsHref: `${base}/docs`,
} as const;
