"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { authActionClient, publicActionClient } from "@/lib/safe-action";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  updateProfileSchema,
} from "@/schemas/auth.schema";
import * as auditService from "@/services/audit.service";

/**
 * Aksi autentikasi — docs/07-AUTH-DAN-RBAC.md §7.5.
 *
 * Kenapa lewat Server Action dan bukan klien Better Auth: supaya rate limit dan
 * audit log terpasang di satu tempat untuk SEMUA percobaan masuk, termasuk yang
 * gagal. Klien Better Auth hanya dipakai untuk OAuth Google dan keluar, yang
 * memang memerlukan pengalihan browser.
 */

/** Hanya untuk aman dari tautan terbuka (open redirect). */
function safeRedirectPath(value: string | undefined): string {
  if (!value) return "/dashboard";
  if (!value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  return value;
}

// ============================================================
//  DAFTAR
// ============================================================

export const signUp = publicActionClient
  .metadata({
    actionName: "auth.signup",
    rateLimit: { key: "daftar", by: "ip" },
  })
  .inputSchema(signUpSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { name, email, password } = parsedInput;

    try {
      await auth.api.signUpEmail({
        body: { name, email, password },
        headers: await headers(),
      });
    } catch (error) {
      // Better Auth melempar APIError dengan pesan berbahasa Inggris.
      // Jangan diteruskan mentah ke pengguna.
      const message = error instanceof Error ? error.message : "";

      if (/already exists|USER_ALREADY_EXISTS/i.test(message)) {
        throw new AppError(
          "CONFLICT",
          "Email ini sudah terdaftar. Silakan masuk atau gunakan email lain.",
          { action: { label: "Masuk", href: "/masuk" } },
        );
      }

      logger.error("auth.signup.failed", { reason: message });
      throw new AppError(
        "INTERNAL",
        "Pendaftaran gagal. Coba lagi beberapa saat lagi.",
      );
    }

    await auditService.record({
      action: auditService.AUTH_ACTIONS.signUp,
      targetType: "User",
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    redirect(`/verifikasi-email?email=${encodeURIComponent(email)}`);
  });

// ============================================================
//  MASUK
// ============================================================

export const signIn = publicActionClient
  .metadata({
    actionName: "auth.signin",
    rateLimit: { key: "masuk", by: "ip" },
  })
  .inputSchema(signInSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { email, password, lanjut } = parsedInput;

    try {
      await auth.api.signInEmail({
        body: { email, password },
        headers: await headers(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      await auditService.record({
        action: auditService.AUTH_ACTIONS.signInFailed,
        targetType: "User",
        ipAddress: ctx.ip,
        userAgent: ctx.userAgent,
      });

      if (/not verified|EMAIL_NOT_VERIFIED/i.test(message)) {
        throw new AppError(
          "FORBIDDEN",
          "Email Anda belum dikonfirmasi. Cek kotak masuk Anda.",
          {
            action: {
              label: "Kirim ulang",
              href: `/verifikasi-email?email=${encodeURIComponent(email)}`,
            },
          },
        );
      }

      // Pesan SERAGAM untuk email tidak ada maupun sandi salah.
      // Membedakan keduanya akan membocorkan daftar email terdaftar.
      // docs/07 §7.5, docs/12 ancaman A9.
      throw new AppError("UNAUTHORIZED", "Email atau kata sandi salah.");
    }

    await auditService.record({
      action: auditService.AUTH_ACTIONS.signIn,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    redirect(safeRedirectPath(lanjut));
  });

// ============================================================
//  LUPA & ATUR ULANG KATA SANDI
// ============================================================

export const forgotPassword = publicActionClient
  .metadata({
    actionName: "auth.password.reset_requested",
    rateLimit: { key: "lupaSandi", by: "ip" },
  })
  .inputSchema(forgotPasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      await auth.api.requestPasswordReset({
        body: { email: parsedInput.email, redirectTo: "/atur-sandi" },
        headers: await headers(),
      });
    } catch (error) {
      // Kegagalan dicatat, TIDAK dilaporkan ke pengguna — jawaban harus sama
      // apakah email terdaftar atau tidak.
      logger.error("auth.forgot_password.failed", {
        reason: error instanceof Error ? error.message : "tidak diketahui",
      });
    }

    await auditService.record({
      action: auditService.AUTH_ACTIONS.passwordResetRequested,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Selalu berhasil dari sudut pandang pengguna.
    return { sent: true };
  });

export const resetPassword = publicActionClient
  .metadata({ actionName: "auth.password.reset" })
  .inputSchema(resetPasswordSchema)
  .action(async ({ parsedInput, ctx }) => {
    try {
      await auth.api.resetPassword({
        body: { newPassword: parsedInput.password, token: parsedInput.token },
        headers: await headers(),
      });
    } catch (error) {
      logger.error("auth.reset_password.failed", {
        reason: error instanceof Error ? error.message : "tidak diketahui",
      });
      throw new AppError(
        "VALIDATION",
        "Tautan atur ulang sudah tidak berlaku. Minta tautan baru.",
        { action: { label: "Minta tautan baru", href: "/lupa-sandi" } },
      );
    }

    await auditService.record({
      action: auditService.AUTH_ACTIONS.passwordReset,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    redirect("/masuk?sandi=berhasil");
  });

export const resendVerification = publicActionClient
  .metadata({
    actionName: "auth.email.resend",
    rateLimit: { key: "kirimUlang", by: "ip" },
  })
  .inputSchema(resendVerificationSchema)
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.sendVerificationEmail({
        body: { email: parsedInput.email },
        headers: await headers(),
      });
    } catch (error) {
      logger.error("auth.resend_verification.failed", {
        reason: error instanceof Error ? error.message : "tidak diketahui",
      });
    }

    return { sent: true };
  });

// ============================================================
//  AKUN (butuh sesi)
// ============================================================

export const updateProfile = authActionClient
  .metadata({ actionName: "account.profile.updated", audit: true })
  .inputSchema(updateProfileSchema)
  .action(async ({ parsedInput }) => {
    await auth.api.updateUser({
      body: { name: parsedInput.name },
      headers: await headers(),
    });

    revalidatePath("/akun/profil");
    revalidatePath("/dashboard");
    return { updated: true };
  });

export const changePassword = authActionClient
  .metadata({ actionName: "auth.password.changed", audit: true })
  .inputSchema(changePasswordSchema)
  .action(async ({ parsedInput }) => {
    try {
      await auth.api.changePassword({
        body: {
          currentPassword: parsedInput.currentPassword,
          newPassword: parsedInput.newPassword,
          // Ganti sandi mencabut SEMUA sesi lain — docs/07 §7.6
          revokeOtherSessions: true,
        },
        headers: await headers(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";

      if (/invalid|incorrect|password/i.test(message)) {
        throw new AppError("VALIDATION", "Kata sandi saat ini salah.");
      }

      logger.error("auth.change_password.failed", { reason: message });
      throw new AppError("INTERNAL", "Gagal mengubah kata sandi. Coba lagi.");
    }

    return { changed: true };
  });
