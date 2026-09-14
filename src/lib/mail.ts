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
const from =
  process.env.EMAIL_FROM ??
  process.env.RESEND_FROM ??
  (process.env.NODE_ENV === "development"
    ? "SaCMS <onboarding@resend.dev>"
    : "SaCMS <noreply@sacms.id>");
const resend = apiKey ? new Resend(apiKey) : null;

const isSandboxSender = from.includes("onboarding@resend.dev");
const devOwnerEmail =
  process.env.SEED_SUPERADMIN_EMAIL ?? "cristoperzonggonau@gmail.com";

interface SendArgs {
  to: string;
  subject: string;
  html: string;
  /** Ditampilkan di log saat mode tiruan atau saat gagal, supaya tautan bisa disalin manual. */
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

  // Di mode development dengan Resend Sandbox (onboarding@resend.dev), Resend hanya
  // mengizinkan pengiriman ke email pemilik akun. Jika dikirim ke email lain, teruskan
  // ke email pemilik pengembang agar tidak terkena error 403 dan email tetap terkirim.
  let actualRecipient = to;
  let actualSubject = subject;
  if (
    process.env.NODE_ENV === "development" &&
    isSandboxSender &&
    to.toLowerCase() !== devOwnerEmail.toLowerCase()
  ) {
    actualRecipient = devOwnerEmail;
    actualSubject = `[DEV untuk: ${to}] ${subject}`;
    logger.info("mail.dev_sandbox_forward", {
      originalRecipient: to,
      forwardedTo: devOwnerEmail,
      note: "Sandbox Resend hanya mengizinkan pengiriman ke email akun terdaftar. Email diteruskan ke email pengembang.",
    });
  }

  try {
    const { error } = await resend.emails.send({
      from,
      to: actualRecipient,
      subject: actualSubject,
      html,
    });
    if (error) {
      logger.error("mail.send_failed", { subject, reason: error.message });
      if (devHint) {
        logger.info("mail.dev_link", {
          to,
          hint: "Salin tautan ini untuk verifikasi atau reset sandi:",
          url: devHint,
        });
      }
      return;
    }
    logger.info("mail.sent", { subject: actualSubject, to: actualRecipient });
  } catch (error) {
    logger.error("mail.send_threw", {
      subject,
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    if (devHint) {
      logger.info("mail.dev_link", {
        to,
        hint: "Salin tautan ini untuk verifikasi atau reset sandi:",
        url: devHint,
      });
    }
  }
}

/* ============================================================
 *  Template — hitam bold + oranye, sesuai docs/04-DESIGN-SYSTEM.md
 *  Email memakai gaya inline karena klien email mengabaikan <style>.
 * ============================================================ */

/** Nama project berasal dari input pengguna dan masuk ke badan HTML email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

/**
 * Dikirim setelah build berhasil — docs/09-AI-BUILDER-PIPELINE.md §9.9.
 *
 * Inilah yang membuat kalimat "Anda boleh menutup halaman ini" di layar progres
 * menjadi janji yang ditepati, bukan sekadar penenang.
 */
export async function sendWebsiteReadyEmail(args: {
  to: string;
  name: string;
  projectName: string;
  url: string;
}) {
  const firstName = args.name.split(" ")[0] ?? args.name;

  await send({
    to: args.to,
    subject: `"${args.projectName}" sudah siap — SaCMS`,
    devHint: args.url,
    html: layout({
      heading: `${firstName}, website Anda sudah siap`,
      body: `"${escapeHtml(args.projectName)}" selesai dibangun. Buka pratinjaunya, lanjutkan menyempurnakannya lewat prompt, atau terbitkan ke internet.`,
      ctaLabel: "Lihat Website Saya",
      ctaUrl: args.url,
      footer:
        "Anda menerima email ini karena membuat website di SaCMS. Pengaturan notifikasi ada di halaman akun Anda.",
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
