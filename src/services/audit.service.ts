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
 * Jejak yang dikembalikan service admin lewat hasil action di kunci `audit`.
 *
 * Middleware action (lib/safe-action.ts) mengambilnya, menulisnya ke audit log,
 * lalu MEMBUANGNYA dari respons — jadi nilai `before`/`after` tidak pernah
 * terkirim ke peramban.
 */
export interface AuditTrail {
  targetType: string;
  targetId: string;
  before?: unknown;
  after?: unknown;
}

export function isAuditTrail(value: unknown): value is AuditTrail {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.targetType === "string" && typeof v.targetId === "string";
}

function toJson(value: unknown) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
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
        before: toJson(input.before),
        after: toJson(input.after),
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

/* ============================================================
 *  BACA — panel /admin/audit
 * ============================================================ */

export interface AuditFilters {
  action?: string | undefined;
  actor?: string | undefined;
  targetType?: string | undefined;
  targetId?: string | undefined;
  /** YYYY-MM-DD, inklusif. */
  from?: string | undefined;
  to?: string | undefined;
  cursor?: string | undefined;
}

export interface AuditRow {
  id: string;
  action: string;
  actorEmail: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: Date;
}

const PAGE_SIZE = 50;

function whereFor(f: AuditFilters) {
  const from = f.from ? new Date(`${f.from}T00:00:00`) : null;
  const to = f.to ? new Date(`${f.to}T23:59:59.999`) : null;

  return {
    ...(f.action
      ? { action: { contains: f.action, mode: "insensitive" as const } }
      : {}),
    ...(f.actor
      ? { actor: { email: { contains: f.actor, mode: "insensitive" as const } } }
      : {}),
    ...(f.targetType ? { targetType: f.targetType } : {}),
    ...(f.targetId ? { targetId: f.targetId } : {}),
    ...(from || to
      ? {
          createdAt: {
            ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
            ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
          },
        }
      : {}),
  };
}

const ROW_SELECT = {
  id: true,
  action: true,
  actorRole: true,
  targetType: true,
  targetId: true,
  before: true,
  after: true,
  ipAddress: true,
  createdAt: true,
  actor: { select: { email: true } },
} as const;

type RawRow = {
  id: string;
  action: string;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: Date;
  actor: { email: string } | null;
};

function toRow(r: RawRow): AuditRow {
  return {
    id: r.id,
    action: r.action,
    actorEmail: r.actor?.email ?? null,
    actorRole: r.actorRole,
    targetType: r.targetType,
    targetId: r.targetId,
    before: r.before,
    after: r.after,
    ipAddress: r.ipAddress,
    createdAt: r.createdAt,
  };
}

export async function list(
  filters: AuditFilters,
): Promise<{ items: AuditRow[]; nextCursor: string | null }> {
  const rows = await db.auditLog.findMany({
    where: whereFor(filters),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(filters.cursor ? { cursor: { id: filters.cursor }, skip: 1 } : {}),
    select: ROW_SELECT,
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE).map(toRow);
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

/** Batas ekspor sekali unduh — rentang lebih besar diekspor per bulan. */
export const EXPORT_LIMIT = 10_000;

function csvCell(value: unknown): string {
  const text =
    value === null || value === undefined
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : typeof value === "string"
          ? value
          : JSON.stringify(value);

  // Sel yang diawali = + - @ dieksekusi sebagai rumus oleh Excel (CSV injection).
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function exportCsv(filters: AuditFilters): Promise<string> {
  const rows = await db.auditLog.findMany({
    where: whereFor(filters),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: EXPORT_LIMIT,
    select: ROW_SELECT,
  });

  const header = [
    "waktu",
    "aksi",
    "pelaku",
    "peran",
    "jenis_target",
    "id_target",
    "sebelum",
    "sesudah",
    "alamat_ip",
  ];

  const lines = rows
    .map(toRow)
    .map((r) =>
      [
        r.createdAt,
        r.action,
        r.actorEmail,
        r.actorRole,
        r.targetType,
        r.targetId,
        r.before,
        r.after,
        r.ipAddress,
      ]
        .map(csvCell)
        .join(","),
    );

  // BOM agar Excel membaca UTF-8 dengan benar.
  return `﻿${[header.join(","), ...lines].join("\r\n")}`;
}
