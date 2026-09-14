import { headers } from "next/headers";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { z } from "zod";

import { getSession, type UserRole } from "@/lib/auth-guard";
import { AppError, ERROR_MESSAGES, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { checkRateLimit, type RateLimitKey } from "@/lib/ratelimit";
import * as auditService from "@/services/audit.service";

/**
 * Klien Server Action — docs/08-SERVER-ACTIONS.md §8.3.
 *
 * Seluruh rangkaian pemeriksaan hidup di SATU berkas ini, sehingga action baru
 * mewarisinya otomatis dan lupa memasang pemeriksaan menjadi hampir mustahil.
 *
 * Urutannya mengikat:
 *   1 autentikasi -> 2 peran -> 3 impersonasi -> 4 rate limit -> 5 jalankan -> 6 audit
 *
 * Kuota (langkah 5 di dokumen) dipasang di Fase 6 pada titik yang ditandai
 * di bawah — lihat docs/11-QUOTA-DAN-BILLING.md §11.4.
 */

const metadataSchema = z.object({
  /** Format: "domain.verb", mis. "project.create". Dipakai audit & log. */
  actionName: z.string().min(1),
  rateLimit: z
    .object({
      key: z.custom<RateLimitKey>(),
      /** Dibatasi per apa: pengguna atau alamat IP. Default: pengguna. */
      by: z.enum(["user", "ip"]).optional(),
    })
    .optional(),
  requireRole: z.enum(["ADMIN", "SUPER_ADMIN"]).optional(),
  audit: z.boolean().optional(),
});

// Catatan: memakai .optional() dan BUKAN .default() di sini disengaja.
// next-safe-action mengetik argumen .metadata() dengan tipe KELUARAN skema,
// sehingga .default() justru membuat field tersebut wajib diisi di setiap
// pemanggilan — kebalikan dari yang diinginkan.

/** Aksi yang tidak boleh dijalankan saat Super Admin sedang menyamar. */
const DESTRUCTIVE_ACTION = /\.(delete|destroy|suspend|purge|reset|role)$/;

export const actionClient = createSafeActionClient({
  defineMetadataSchema: () => metadataSchema,

  /** Satu-satunya tempat error berubah menjadi teks yang dilihat pengguna. */
  handleServerError(error, { metadata }) {
    if (isAppError(error)) return error.userMessage;

    logger.error("action.unhandled", {
      action: metadata?.actionName,
      reason: error.message,
      stack: error.stack,
    });

    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
});

/** Konteks permintaan yang selalu tersedia di setiap action. */
async function requestContext() {
  const h = await headers();
  return {
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
    userAgent: h.get("user-agent") ?? "unknown",
    correlationId: crypto.randomUUID(),
  };
}

/* ============================================================
 *  PUBLIC — untuk aksi tanpa sesi (masuk, daftar, lupa sandi)
 * ============================================================ */

export const publicActionClient = actionClient.use(async ({ next, metadata }) => {
  const ctx = await requestContext();

  if (metadata.rateLimit) {
    const result = await checkRateLimit(metadata.rateLimit.key, ctx.ip);
    if (!result.success) {
      throw new AppError("RATE_LIMITED", ERROR_MESSAGES.RATE_LIMITED);
    }
  }

  return next({ ctx });
});

/* ============================================================
 *  AUTH — untuk aksi yang mensyaratkan sesi
 * ============================================================ */

export const authActionClient = actionClient.use(async ({ next, metadata }) => {
  // --- 1. AUTENTIKASI ---
  const session = await getSession();
  if (!session) throw new AppError("UNAUTHORIZED", ERROR_MESSAGES.UNAUTHORIZED);
  if (session.user.status === "SUSPENDED") {
    throw new AppError("SUSPENDED", ERROR_MESSAGES.SUSPENDED);
  }

  // --- 2. PERAN ---
  if (metadata.requireRole) {
    const allowed: UserRole[] =
      metadata.requireRole === "SUPER_ADMIN"
        ? ["SUPER_ADMIN"]
        : ["ADMIN", "SUPER_ADMIN"];

    if (!allowed.includes(session.user.role as UserRole)) {
      throw new AppError("FORBIDDEN", ERROR_MESSAGES.FORBIDDEN);
    }
  }

  // --- 3. IMPERSONASI: blokir aksi destruktif ---
  if (session.session.impersonatedBy && DESTRUCTIVE_ACTION.test(metadata.actionName)) {
    throw new AppError(
      "FORBIDDEN",
      "Tindakan ini tidak tersedia saat menyamar sebagai pengguna.",
    );
  }

  const request = await requestContext();
  const ctx = {
    ...request,
    user: session.user,
    session: session.session,
    isImpersonating: Boolean(session.session.impersonatedBy),
  };

  // --- 4. RATE LIMIT ---
  if (metadata.rateLimit) {
    const subject = (metadata.rateLimit.by ?? "user") === "ip" ? ctx.ip : ctx.user.id;
    const result = await checkRateLimit(metadata.rateLimit.key, subject);
    if (!result.success) {
      throw new AppError("RATE_LIMITED", ERROR_MESSAGES.RATE_LIMITED);
    }
  }

  // --- 5. KUOTA --- (Fase 6: quotaService.reserve() dipasang di sini,
  // dengan commit saat sukses dan refund saat gagal. docs/11 §11.4)

  // --- 6. JALANKAN + 7. AUDIT ---
  const result = await next({ ctx });

  if (metadata.audit) {
    await auditService.record({
      action: metadata.actionName,
      actorId: ctx.user.id,
      actorRole: ctx.user.role as UserRole,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }

  return result;
});

/* ============================================================
 *  ADMIN — peran wajib diisi di metadata masing-masing action
 * ============================================================ */

export const adminActionClient = authActionClient;
