import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sendAccountSuspendedEmail } from "@/lib/mail";
import type { AuditTrail } from "@/services/audit.service";
import * as quotaService from "@/services/quota.service";
import type { UserRole, UserStatus } from "@/types/db";

/**
 * Pengelolaan pengguna oleh Super Admin — docs/10 §10.4, docs/07 §7.3.
 *
 * Setiap fungsi tulis mengembalikan AuditTrail; middleware action yang
 * menuliskannya ke audit log. Kewenangan (requireRole) diperiksa di action.
 *
 * Aturan yang ditegakkan DI SINI, bukan di UI:
 * - Sistem selalu punya minimal satu Super Admin aktif.
 * - Admin tidak bisa menangguhkan, menghapus, atau menyamar sebagai dirinya sendiri.
 * - Penangguhan dan perubahan peran mencabut SEMUA sesi target saat itu juga.
 */

const PAGE_SIZE = 25;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/* ============================================================
 *  BACA
 * ============================================================ */

export interface UserListFilters {
  q?: string | undefined;
  plan?: string | undefined;
  status?: UserStatus | undefined;
  role?: UserRole | undefined;
  cursor?: string | undefined;
}

export interface AdminUserListItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  planName: string;
  projectCount: number;
  creditsUsed: number;
  creditLimit: number;
  lastLoginAt: Date | null;
  createdAt: Date;
}

export async function list(
  f: UserListFilters,
): Promise<{ items: AdminUserListItem[]; nextCursor: string | null }> {
  const rows = await db.user.findMany({
    where: {
      deletedAt: null,
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: "insensitive" } },
              { email: { contains: f.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(f.plan ? { plan: { slug: f.plan } } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.role ? { role: f.role } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      creditsUsed: true,
      creditsOverride: true,
      lastLoginAt: true,
      createdAt: true,
      plan: { select: { name: true, monthlyCredits: true } },
      _count: { select: { projects: { where: { deletedAt: null } } } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    planName: u.plan.name,
    projectCount: u._count.projects,
    creditsUsed: u.creditsUsed,
    creditLimit: u.creditsOverride ?? u.plan.monthlyCredits,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
  }));

  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

export async function getDetail(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      role: true,
      status: true,
      banReason: true,
      createdAt: true,
      lastLoginAt: true,
      creditsOverride: true,
      maxProjectsOverride: true,
      planId: true,
      _count: { select: { sessions: true } },
    },
  });
  if (!user) return null;

  const [quota, projects, builds, audit, plans] = await Promise.all([
    quotaService.getQuota(userId),
    db.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        status: true,
        deletedAt: true,
        productionUrl: true,
        updatedAt: true,
      },
    }),
    db.buildJob.findMany({
      where: { project: { userId } },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        kind: true,
        attempt: true,
        maxAttempts: true,
        createdAt: true,
        startedAt: true,
        finishedAt: true,
        project: { select: { name: true } },
      },
    }),
    db.auditLog.findMany({
      where: { OR: [{ targetType: "User", targetId: userId }, { actorId: userId }] },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        action: true,
        createdAt: true,
        actor: { select: { email: true } },
      },
    }),
    db.plan.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, slug: true },
    }),
  ]);

  return {
    user: { ...user, activeSessions: user._count.sessions },
    quota,
    projects,
    builds,
    audit,
    plans,
  };
}

/* ============================================================
 *  PEMBANTU
 * ============================================================ */

async function loadTarget(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      planId: true,
      creditsUsed: true,
      creditsOverride: true,
      maxProjectsOverride: true,
      periodStartedAt: true,
      plan: { select: { slug: true } },
    },
  });
  if (!user) throw new AppError("NOT_FOUND", "Pengguna tidak ditemukan.");
  return user;
}

/**
 * Menjamin masih ada Super Admin AKTIF lain selain `excludeUserId`.
 *
 * Baris Super Admin dikunci (FOR UPDATE): tanpa kunci, dua Super Admin yang
 * saling menurunkan pada detik yang sama sama-sama melihat "masih ada satu
 * lagi" dan sistem berakhir tanpa pemilik.
 */
async function assertAnotherActiveSuperAdmin(
  tx: Tx,
  excludeUserId: string,
  verb: string,
) {
  await tx.$queryRaw`SELECT id FROM "user" WHERE role = 'SUPER_ADMIN' FOR UPDATE`;

  const others = await tx.user.count({
    where: { role: "SUPER_ADMIN", status: "ACTIVE", id: { not: excludeUserId } },
  });

  if (others === 0) {
    throw new AppError(
      "CONFLICT",
      `Tidak bisa ${verb} Super Admin terakhir. Sistem harus selalu punya minimal satu Super Admin aktif.`,
    );
  }
}

function forbidSelf(actorId: string, userId: string, message: string) {
  if (actorId === userId) throw new AppError("CONFLICT", message);
}

function userTrail(userId: string, before: unknown, after: unknown): AuditTrail {
  return { targetType: "User", targetId: userId, before, after };
}

/* ============================================================
 *  TULIS
 * ============================================================ */

export async function changePlan(input: {
  userId: string;
  planId: string;
}): Promise<AuditTrail> {
  const target = await loadTarget(input.userId);
  const plan = await db.plan.findUnique({
    where: { id: input.planId },
    select: { id: true, slug: true },
  });
  if (!plan) throw new AppError("NOT_FOUND", "Paket tidak ditemukan.");
  if (plan.id === target.planId) {
    throw new AppError("CONFLICT", "Pengguna sudah memakai paket ini.");
  }

  await db.user.update({ where: { id: target.id }, data: { planId: plan.id } });
  logger.info("admin.user.plan_changed", { userId: target.id, plan: plan.slug });

  return userTrail(target.id, { plan: target.plan.slug }, { plan: plan.slug });
}

export async function setQuota(input: {
  userId: string;
  creditsOverride: number | null;
  maxProjectsOverride: number | null;
}): Promise<AuditTrail> {
  const target = await loadTarget(input.userId);

  await db.user.update({
    where: { id: target.id },
    data: {
      creditsOverride: input.creditsOverride,
      maxProjectsOverride: input.maxProjectsOverride,
    },
  });

  return userTrail(
    target.id,
    {
      creditsOverride: target.creditsOverride,
      maxProjectsOverride: target.maxProjectsOverride,
    },
    {
      creditsOverride: input.creditsOverride,
      maxProjectsOverride: input.maxProjectsOverride,
    },
  );
}

export async function resetUsage(input: { userId: string }): Promise<AuditTrail> {
  const target = await loadTarget(input.userId);
  const now = new Date();

  await db.user.update({
    where: { id: target.id },
    data: { creditsUsed: 0, periodStartedAt: now },
  });

  return userTrail(
    target.id,
    { creditsUsed: target.creditsUsed, periodStartedAt: target.periodStartedAt },
    { creditsUsed: 0, periodStartedAt: now },
  );
}

export async function suspend(input: {
  actorId: string;
  userId: string;
  reason: string;
}): Promise<AuditTrail> {
  forbidSelf(
    input.actorId,
    input.userId,
    "Anda tidak bisa menangguhkan akun Anda sendiri.",
  );
  const target = await loadTarget(input.userId);

  if (target.status === "SUSPENDED") {
    throw new AppError("CONFLICT", "Akun ini sudah ditangguhkan.");
  }

  const revoked = await db.$transaction(async (tx) => {
    if (target.role === "SUPER_ADMIN") {
      await assertAnotherActiveSuperAdmin(tx, target.id, "menangguhkan");
    }

    await tx.user.update({
      where: { id: target.id },
      // `banned` untuk Better Auth: sign-in ditolak di tingkat endpoint, bahkan
      // bila seseorang memanggil /api/auth/sign-in/email langsung.
      data: { status: "SUSPENDED", banned: true, banReason: input.reason },
    });

    // Cabut SEMUA sesi seketika — docs/07 §7.6.
    const { count } = await tx.session.deleteMany({ where: { userId: target.id } });
    return count;
  });

  logger.warn("admin.user.suspended", { userId: target.id, revokedSessions: revoked });

  await sendAccountSuspendedEmail({
    to: target.email,
    name: target.name,
    reason: input.reason,
  });

  return userTrail(
    target.id,
    { status: target.status },
    { status: "SUSPENDED", reason: input.reason, revokedSessions: revoked },
  );
}

export async function reactivate(input: { userId: string }): Promise<AuditTrail> {
  const target = await loadTarget(input.userId);

  if (target.status !== "SUSPENDED") {
    throw new AppError("CONFLICT", "Akun ini tidak sedang ditangguhkan.");
  }

  await db.user.update({
    where: { id: target.id },
    data: { status: "ACTIVE", banned: false, banReason: null, banExpires: null },
  });

  return userTrail(target.id, { status: "SUSPENDED" }, { status: "ACTIVE" });
}

/**
 * Runbook insiden "akun disusupi" — docs/12 §12.7.
 *
 * Mencabut semua sesi TANPA menangguhkan: pemilik akun yang sah bisa langsung
 * masuk lagi setelah mengganti sandi, sementara penyusup kehilangan sesinya.
 */
export async function revokeSessions(input: { userId: string }): Promise<AuditTrail> {
  const target = await loadTarget(input.userId);
  const { count } = await db.session.deleteMany({ where: { userId: target.id } });

  logger.warn("admin.user.sessions_revoked", { userId: target.id, count });

  return userTrail(target.id, { activeSessions: count }, { activeSessions: 0 });
}

export async function changeRole(input: {
  actorId: string;
  userId: string;
  role: UserRole;
}): Promise<AuditTrail> {
  const target = await loadTarget(input.userId);

  if (target.role === input.role) {
    throw new AppError("CONFLICT", "Peran pengguna ini tidak berubah.");
  }

  const revoked = await db.$transaction(async (tx) => {
    if (target.role === "SUPER_ADMIN" && input.role !== "SUPER_ADMIN") {
      await assertAnotherActiveSuperAdmin(tx, target.id, "menurunkan peran");
    }

    await tx.user.update({ where: { id: target.id }, data: { role: input.role } });

    // Peran baru berlaku dari sesi baru — docs/07 §7.6.
    const { count } = await tx.session.deleteMany({ where: { userId: target.id } });
    return count;
  });

  logger.warn("admin.user.role_changed", {
    userId: target.id,
    from: target.role,
    to: input.role,
    self: input.actorId === target.id,
  });

  return userTrail(
    target.id,
    { role: target.role },
    { role: input.role, revokedSessions: revoked },
  );
}

export async function hardDelete(input: {
  actorId: string;
  userId: string;
  confirmEmail: string;
}): Promise<AuditTrail> {
  forbidSelf(
    input.actorId,
    input.userId,
    "Anda tidak bisa menghapus akun Anda sendiri.",
  );
  const target = await loadTarget(input.userId);

  // Ketik-untuk-yakin dicocokkan ulang DI SERVER (docs/10 §10.9 aturan 6).
  if (input.confirmEmail.trim() !== target.email) {
    throw new AppError(
      "VALIDATION",
      "Email yang Anda ketik tidak sama dengan email pengguna.",
    );
  }

  const summary = await db.$transaction(async (tx) => {
    if (target.role === "SUPER_ADMIN") {
      await assertAnotherActiveSuperAdmin(tx, target.id, "menghapus");
    }

    const [projects, liveProjects] = await Promise.all([
      tx.project.count({ where: { userId: target.id } }),
      tx.project.count({ where: { userId: target.id, productionUrl: { not: null } } }),
    ]);

    // AuditLog.actorId dan UsageEvent.userId menjadi null (onDelete: SetNull),
    // jadi jejak dan catatan biaya tetap tinggal (docs/10 §10.4).
    await tx.user.delete({ where: { id: target.id } });

    return { projects, liveProjects };
  });

  logger.warn("admin.user.hard_deleted", { userId: target.id, ...summary });

  return userTrail(
    target.id,
    { email: target.email, name: target.name, role: target.role, ...summary },
    { deleted: true },
  );
}

/**
 * Pemeriksaan sebelum impersonasi. Pemanggilan Better Auth dilakukan action
 * (butuh header permintaan dan menulis cookie).
 */
export async function assertImpersonatable(input: {
  actorId: string;
  userId: string;
}): Promise<AuditTrail> {
  forbidSelf(
    input.actorId,
    input.userId,
    "Anda tidak bisa menyamar sebagai diri sendiri.",
  );
  const target = await loadTarget(input.userId);

  // Menyamar sebagai admin lain = memakai kewenangan admin tanpa jejak peran
  // yang jujur. Hanya pengguna biasa.
  if (target.role !== "USER") {
    throw new AppError("FORBIDDEN", "Hanya akun pengguna biasa yang bisa dimasuki.");
  }
  if (target.status === "SUSPENDED") {
    throw new AppError("CONFLICT", "Akun yang ditangguhkan tidak bisa dimasuki.");
  }

  return userTrail(target.id, undefined, { email: target.email, durationMinutes: 60 });
}
