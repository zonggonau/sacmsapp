import { ACCOUNT_DELETE_PHRASE } from "@/config/account";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import * as auditService from "@/services/audit.service";
import * as deployService from "@/services/deploy.service";

/**
 * Akun milik pengguna sendiri — docs/12 §12.6 (kepatuhan UU PDP):
 * satu tindakan dari `/akun/keamanan` yang menghapus project, mencabut sesi,
 * dan menyisakan catatan wajib simpan dalam keadaan anonim.
 *
 * KENAPA AUDIT DITULIS DI SINI, bukan oleh middleware action: middleware
 * mencatat SETELAH action selesai (docs/08 §8.3 langkah 7). Saat itu baris
 * pengguna sudah tidak ada, sehingga `actorId` menunjuk baris yang hilang dan
 * penulisan audit gagal — justru jejak yang paling perlu disimpan.
 */

export interface DeleteOwnAccountInput {
  userId: string;
  confirmEmail: string;
  confirmPhrase: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeleteOwnAccountResult {
  email: string;
  projects: number;
  liveProjects: number;
}

export async function deleteOwnAccount(
  input: DeleteOwnAccountInput,
): Promise<DeleteOwnAccountResult> {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, name: true, role: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "Akun tidak ditemukan.");

  // Akun staf tidak boleh hilang lewat jalur mandiri: sistem wajib selalu punya
  // Super Admin aktif, dan penghapusannya harus lewat admin lain (docs/07 §7.3).
  if (user.role !== "USER") {
    throw new AppError(
      "FORBIDDEN",
      "Akun admin tidak bisa dihapus dari halaman ini. Hubungi Super Admin lain.",
    );
  }

  // Ketik-untuk-yakin dicocokkan ulang DI SERVER (docs/10 §10.9 aturan 6).
  if (input.confirmEmail.trim().toLowerCase() !== user.email.toLowerCase()) {
    throw new AppError(
      "VALIDATION",
      "Email yang Anda ketik tidak sama dengan email akun ini.",
    );
  }
  if (input.confirmPhrase.trim().toLowerCase() !== ACCOUNT_DELETE_PHRASE) {
    throw new AppError(
      "VALIDATION",
      `Ketik kalimat "${ACCOUNT_DELETE_PHRASE}" untuk konfirmasi.`,
    );
  }

  // Website yang tayang diturunkan SEBELUM barisnya hilang: setelah project
  // terhapus, pengenal project Vercel ikut hilang dan situsnya menjadi yatim
  // (pelajaran yang sama dengan hapus pengguna oleh admin, docs/10 §10.4).
  const published = await db.project.findMany({
    where: { userId: user.id, vercelProjectId: { not: null } },
    select: { id: true },
  });
  for (const p of published) await deployService.takeDown(p.id);

  const [projects, liveProjects] = await Promise.all([
    db.project.count({ where: { userId: user.id } }),
    db.project.count({ where: { userId: user.id, productionUrl: { not: null } } }),
  ]);

  await auditService.record({
    action: "user.account.delete",
    actorId: user.id,
    actorRole: user.role,
    targetType: "User",
    targetId: user.id,
    before: { email: user.email, name: user.name, projects, liveProjects },
    after: { deleted: true, olehPenggunaSendiri: true },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  // Session, Account, Project, dan Notification ikut terhapus (onDelete:
  // Cascade) sehingga seluruh sesi tercabut saat itu juga. AuditLog.actorId dan
  // UsageEvent.userId menjadi null (SetNull): jejak audit 12 bulan dan catatan
  // pembukuan 24 bulan tetap ada, tanpa identitas (docs/12 §12.6).
  await db.user.delete({ where: { id: user.id } });

  logger.warn("user.account_deleted", {
    userId: user.id,
    projects,
    liveProjects,
  });

  return { email: user.email, projects, liveProjects };
}
