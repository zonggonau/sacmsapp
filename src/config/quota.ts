/**
 * Konstanta kuota yang dipakai server DAN klien — docs/11.
 */

/**
 * Kalimat penutup setiap pesan batas kuota. Klien mengenali pesan kuota dari
 * kalimat ini dan menambahkan tombol "Lihat Paket" pada notifikasinya
 * (docs/11 §11.6: batas tercapai -> penjelasan + tombol Lihat Paket).
 */
export const UPGRADE_HINT = "Lihat halaman Paket untuk meningkatkan paket Anda.";

export const PLAN_PAGE = "/akun/paket";

/** Ambang peringatan sisa kredit — docs/11 §11.6. */
export const LOW_CREDIT_RATIO = 0.2;
export const CRITICAL_CREDIT_RATIO = 0.05;
