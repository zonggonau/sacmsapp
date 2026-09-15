/**
 * Kanal dukungan — docs/14 §14.9 "Kanal dukungan aktif dan tercantum".
 *
 * Nilai dari env publik agar pemilik bisa menggantinya tanpa mengubah kode.
 * Dipakai juga sebagai jalur upgrade paket manual (docs/11 §11.7).
 */
const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || null;
const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP?.trim() || null;

export const SUPPORT = {
  email,
  whatsapp,
  emailHref: email ? `mailto:${email}` : null,
  whatsappHref: whatsapp ? `https://wa.me/${whatsapp}` : null,
  available: Boolean(email || whatsapp),
} as const;

/** Tautan WhatsApp dengan pesan awal, mis. untuk permintaan upgrade paket. */
export function whatsappWithText(text: string): string | null {
  return whatsapp ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}` : null;
}
