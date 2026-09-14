import crypto from "node:crypto";

/**
 * Verifikasi tanda tangan webhook Vercel — docs/12 ancaman A7.
 *
 * Vercel menandatangani badan permintaan mentah dengan HMAC-SHA1 memakai secret
 * webhook, dikirim di header `x-vercel-signature` (heksadesimal).
 *
 * Berkas terpisah dari client.ts agar bisa diuji tanpa memuat environment.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string | undefined,
): boolean {
  // GAGAL TERTUTUP. Tanpa secret tidak ada tanda tangan yang bisa diperiksa,
  // jadi tidak ada webhook yang boleh dipercaya — di lingkungan apa pun.
  // Versi sebelumnya menerima signature APA SAJA di luar production.
  if (!secret || !signature) return false;

  const expected = crypto.createHmac("sha1", secret).update(rawBody).digest("hex");
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expected);

  // timingSafeEqual melempar bila panjangnya berbeda.
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
}
