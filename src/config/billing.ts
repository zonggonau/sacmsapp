/**
 * Angka komersial ADR-012 — Paket Project tahunan + dompet kredit AI per akun.
 *
 * Harga paket sendiri TIDAK di sini: harga tinggal di tabel `Plan` supaya Super
 * Admin bisa mengubahnya tanpa deploy (docs/10 §10.6). Yang di sini adalah
 * aturan yang melekat pada mekanismenya.
 */

/** Kredit sambutan sekali seumur akun, untuk mencoba Builder. */
export const WELCOME_CREDITS = 5;

/**
 * Ambang peringatan sisa kredit dompet. Model lama memperingatkan pada 20%
 * dari kuota bulanan; dompet tidak punya "kuota", jadi ambangnya angka tetap.
 */
export const LOW_WALLET_CREDITS = 3;

/** Umur satu lot kredit sejak dibeli — selaras dengan kredit v0 (1 tahun). */
export const CREDIT_LOT_MONTHS = 12;

/** Paket top-up yang ditawarkan. Pembayaran manual dulu (Midtrans v1.1). */
export const TOPUP_PACKS = [
  { credits: 10, priceIdr: 150_000 },
  { credits: 50, priceIdr: 650_000 },
  { credits: 100, priceIdr: 1_250_000 },
] as const;

/** Masa tenggang setelah langganan berakhir; situs masih tayang. */
export const SUBSCRIPTION_GRACE_DAYS = 30;

/** Hari ke berapa sebelum berakhir pengingat dikirim. */
export const SUBSCRIPTION_REMINDER_DAYS = [30, 7] as const;

/** Project & versinya disimpan sekian hari setelah kedaluwarsa. */
export const PROJECT_RETENTION_DAYS = 90;

/**
 * Batas draf tanpa Paket Project. Project tetap bisa dibangun di Builder
 * (memakai kredit), tetapi tidak bisa diterbitkan sebelum paketnya aktif.
 */
export const DRAFT_PROJECT_LIMIT = 10;

export const TOPUP_PAGE = "/akun/paket";
