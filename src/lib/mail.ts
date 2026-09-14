import { Resend } from "resend";

import { logger } from "@/lib/logger";

/**
 * Email transaksional lewat Resend.
 *
 * Tanpa RESEND_API_KEY, email TIDAK dikirim melainkan dicatat ke log — supaya
 * Fase 1 bisa dikembangkan dan diuji tanpa akun Resend. Di production, kunci
 * yang hilang adalah kesalahan konfigurasi: email gagal kirim dicatat sebagai
 * error, bukan didiamkan.
 */

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? "SaCMS <noreply@sacms.id>";
const resend = apiKey ? new Resend(apiKey) : null;

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /** Ditampilkan di log saat mode tiruan, supaya tautan bisa disalin manual. */
  devHint?: string;
}

async function send({ to, subject, html, devHint }: SendArgs) {
  if (!resend) {
    logger.warn("mail.mock", {
      hint: "RESEND_API_KEY kosong — email tidak dikirim.",
      subject,
      devHint,
    });
    return;
  }

  try {
    const { error } = await resend.emails.send({ from, to, subject, html });
    if (error) {
      logger.error("mail.send_failed", { subject, reason: error.message });
      return;
    }
    logger.info("mail.sent", { subject });
  } catch (error) {
    logger.error("mail.send_threw", {
      subject,
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
  }
}

/* ============================================================
 *  Template — hitam bold + oranye, sesuai docs/04-DESIGN-SYSTEM.md
 *  Email memakai gaya inline karena klien email mengabaikan <style>.
 * ============================================================ */

function layout(opts: {
  heading: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
  footer: string;
}) {
  return `
<!doctype html>
<html lang="id">
<body style="margin:0;padding:0;background:#000000;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0A0A0A;border:1px solid #262626;border-radius:10px;">
        <tr><td style="padding:28px 28px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="background:#FF6B00;border-radius:6px;width:28px;height:28px;text-align:center;color:#000000;font-weight:800;font-size:14px;line-height:28px;">S</td>
            <td style="padding-left:10px;color:#FFFFFF;font-weight:700;font-size:17px;">SaCMS</td>
          </tr></table>
        </td></tr>

        <tr><td style="padding:24px 28px 0;">
          <h1 style="margin:0;color:#FFFFFF;font-size:21px;font-weight:700;line-height:1.3;">${opts.heading}</h1>
          <p style="margin:12px 0 0;color:#A1A1A1;font-size:14px;line-height:1.65;">${opts.body}</p>
        </td></tr>

        <tr><td style="padding:24px 28px 0;">
          <a href="${opts.ctaUrl}" style="display:inline-block;background:#FF6B00;color:#000000;font-weight:600;font-size:14px;text-decoration:none;padding:11px 20px;border-radius:8px;">${opts.ctaLabel}</a>
        </td></tr>

        <tr><td style="padding:20px 28px 0;">
          <p style="margin:0;color:#6E6E6E;font-size:12px;line-height:1.6;">Kalau tombol di atas tidak bisa diklik, salin tautan ini ke browser Anda:</p>
          <p style="margin:6px 0 0;color:#FFA274;font-size:12px;word-break:break-all;">${opts.ctaUrl}</p>
        </td></tr>

        <tr><td style="padding:24px 28px 28px;">
          <div style="border-top:1px solid #262626;padding-top:16px;">
            <p style="margin:0;color:#6E6E6E;font-size:12px;line-height:1.6;">${opts.footer}</p>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();
}

export async function sendVerificationEmail(args: {
  to: string;
  name: string;
  url: string;
}) {
  await send({
    to: args.to,
    subject: "Konfirmasi email Anda — SaCMS",
    devHint: args.url,
    html: layout({
      heading: `Halo ${args.name}, satu langkah lagi`,
      body: "Konfirmasi alamat email Anda untuk mulai membuat website dengan SaCMS.",
      ctaLabel: "Konfirmasi Email",
      ctaUrl: args.url,
      footer:
        "Tautan ini berlaku 1 jam. Kalau Anda tidak mendaftar di SaCMS, abaikan saja email ini.",
    }),
  });
}

export async function sendResetPasswordEmail(args: {
  to: string;
  name: string;
  url: string;
}) {
  await send({
    to: args.to,
    subject: "Atur ulang kata sandi — SaCMS",
    devHint: args.url,
    html: layout({
      heading: `Halo ${args.name}, atur ulang kata sandi Anda`,
      body: "Kami menerima permintaan untuk mengatur ulang kata sandi akun SaCMS Anda.",
      ctaLabel: "Atur Kata Sandi Baru",
      ctaUrl: args.url,
      footer:
        "Tautan ini berlaku 1 jam dan hanya bisa dipakai sekali. Kalau Anda tidak meminta ini, abaikan email ini — kata sandi Anda tidak berubah.",
    }),
  });
}
