import { headers } from "next/headers";
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { z } from "zod";

import { getSession, type UserRole } from "@/lib/auth-guard";
import { AppError, ERROR_MESSAGES, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { checkRateLimit, type RateLimitKey } from "@/lib/ratelimit";
import * as auditService from "@/services/audit.service";
import * as systemService from "@/services/system.service";

/**
 * Klien Server Action — docs/08-SERVER-ACTIONS.md §8.3.
 *
 * Seluruh rangkaian pemeriksaan hidup di SATU berkas ini, sehingga action baru
 * mewarisinya otomatis dan lupa memasang pemeriksaan menjadi hampir mustahil.
 *
 * Urutannya mengikat:
 *   1 autentikasi -> 2 peran -> 3 impersonasi -> 4 maintenance -> 5 rate limit
 *   -> 6 jalankan -> 7 audit
 *
 * Kuota dipasang di Fase 6 pada titik yang ditandai di bawah — lihat
 * docs/11-QUOTA-DAN-BILLING.md §11.4.
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

const ADMIN_ROLES: readonly UserRole[] = ["ADMIN", "SUPER_ADMIN"];

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

/**
 * Mengambil jejak audit dari hasil action lalu MEMBUANGNYA dari respons.
 * Nilai before/after bisa memuat data yang tidak perlu sampai ke peramban.
 */
function takeAuditTrail(data: unknown): auditService.AuditTrail | null {
  if (typeof data !== "object" || data === null || !("audit" in data)) return null;
  const record = data as Record<string, unknown>;
  const trail = record.audit;
  delete record.audit;
  return auditService.isAuditTrail(trail) ? trail : null;
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

  const role = session.user.role as UserRole;
  const impersonatedBy = session.session.impersonatedBy ?? null;
  const request = await requestContext();

  // --- 2. PERAN ---
  if (metadata.requireRole) {
    // Action admin tanpa audit adalah bug (docs/10 §10.9 aturan 2). Gagal
    // tertutup: lebih baik action itu tidak berjalan sama sekali daripada
    // berjalan tanpa jejak.
    if (metadata.audit !== true) {
      logger.error("action.admin_without_audit", { action: metadata.actionName });
      throw new AppError("INTERNAL", ERROR_MESSAGES.INTERNAL);
    }

    const allowed: readonly UserRole[] =
      metadata.requireRole === "SUPER_ADMIN" ? ["SUPER_ADMIN"] : ADMIN_ROLES;

    if (!allowed.includes(role)) {
      // Percobaan memanggil action admin tanpa hak adalah sinyal serangan.
      await auditService.record({
        action: "admin.access_denied",
        actorId: session.user.id,
        actorRole: role,
        targetType: "Action",
        targetId: metadata.actionName,
        ipAddress: request.ip,
        userAgent: request.userAgent,
      });
      throw new AppError("FORBIDDEN", ERROR_MESSAGES.FORBIDDEN);
    }
  }

  // --- 3. IMPERSONASI: blokir aksi destruktif ---
  if (impersonatedBy && DESTRUCTIVE_ACTION.test(metadata.actionName)) {
    throw new AppError(
      "FORBIDDEN",
      "Tindakan ini tidak tersedia saat menyamar sebagai pengguna.",
    );
  }

  // --- 4. MAINTENANCE ---
  // Admin tetap bekerja, termasuk saat sedang menyamar untuk melihat masalah.
  if (
    !ADMIN_ROLES.includes(role) &&
    !impersonatedBy &&
    (await systemService.isMaintenanceMode())
  ) {
    throw new AppError("MAINTENANCE", ERROR_MESSAGES.MAINTENANCE);
  }

  const ctx = {
    ...request,
    user: session.user,
    session: session.session,
    isImpersonating: Boolean(impersonatedBy),
  };

  // --- 5. RATE LIMIT ---
  if (metadata.rateLimit) {
    const subject = (metadata.rateLimit.by ?? "user") === "ip" ? ctx.ip : ctx.user.id;
    const result = await checkRateLimit(metadata.rateLimit.key, subject);
    if (!result.success) {
      throw new AppError("RATE_LIMITED", ERROR_MESSAGES.RATE_LIMITED);
    }
  }

  // --- KUOTA --- (Fase 6: quotaService.reserve() dipasang di sini,
  // dengan commit saat sukses dan refund saat gagal. docs/11 §11.4)

  // --- 6. JALANKAN + 7. AUDIT ---
  const result = await next({ ctx });

  if (metadata.audit) {
    const trail = takeAuditTrail(result.data);
    const after = {
      ...(trail?.after !== undefined
        ? typeof trail.after === "object" && trail.after !== null
          ? trail.after
          : { nilai: trail.after }
        : {}),
      ...(result.success ? {} : { gagal: result.serverError ?? "validasi ditolak" }),
      // Aksi saat menyamar dicatat atas nama ADMIN, dengan akun yang dipakai.
      ...(impersonatedBy ? { sebagaiPengguna: ctx.user.id } : {}),
    };

    await auditService.record({
      action: metadata.actionName,
      actorId: impersonatedBy ?? ctx.user.id,
      // Impersonasi hanya bisa dilakukan SUPER_ADMIN (lib/auth.ts).
      actorRole: impersonatedBy ? "SUPER_ADMIN" : role,
      targetType: trail?.targetType ?? null,
      targetId: trail?.targetId ?? null,
      before: trail?.before,
      after: Object.keys(after).length > 0 ? after : undefined,
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
