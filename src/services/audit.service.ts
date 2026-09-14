import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Jejak audit — docs/10-SUPER-ADMIN.md §10.8.
 *
 * Bersifat APPEND-ONLY. Tidak ada fungsi hapus atau ubah di berkas ini, dan
 * tidak boleh ada. Catatan tetap bertahan meski pengguna dihapus (actorId
 * menjadi null lewat onDelete: SetNull).
 */

export interface AuditInput {
  action: string;
  actorId?: string | null;
  actorRole?: "USER" | "ADMIN" | "SUPER_ADMIN" | null;
  targetType?: string | null;
  targetId?: string | null;
  before?: unknown;
  after?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Mencatat satu peristiwa.
 *
 * Kegagalan menulis audit TIDAK boleh menggagalkan aksi penggunanya — tapi juga
 * tidak boleh hilang diam-diam. Karena itu kesalahan dicatat sebagai error log
 * dengan muatan lengkap, sehingga masih bisa direkonstruksi.
 */
export async function record(input: AuditInput): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action: input.action,
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        before:
          input.before === undefined
            ? undefined
            : JSON.parse(JSON.stringify(input.before)),
        after:
          input.after === undefined
            ? undefined
            : JSON.parse(JSON.stringify(input.after)),
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (error) {
    logger.error("audit.write_failed", {
      action: input.action,
      actorId: input.actorId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
  }
}

/** Aksi autentikasi yang wajib tercatat — docs/12 §12.6. */
export const AUTH_ACTIONS = {
  signUp: "auth.signup",
  signIn: "auth.signin",
  signInFailed: "auth.signin.failed",
  signOut: "auth.signout",
  passwordResetRequested: "auth.password.reset_requested",
  passwordReset: "auth.password.reset",
  passwordChanged: "auth.password.changed",
  emailVerified: "auth.email.verified",
  profileUpdated: "account.profile.updated",
} as const;
