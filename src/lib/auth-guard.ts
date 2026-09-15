import { cache } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * Lapis 2 dari empat lapis pertahanan — docs/07-AUTH-DAN-RBAC.md §7.4.
 *
 * Middleware (lapis 1) hanya memeriksa keberadaan cookie dan TIDAK PERNAH cukup.
 * Otorisasi sebenarnya terjadi di sini dan di klausa `where` query (lapis 4).
 */

export type UserRole = "USER" | "ADMIN" | "SUPER_ADMIN";

/**
 * cache() membuat satu permintaan HTTP hanya memicu satu query sesi, meskipun
 * dipanggil di layout grup, topbar, dan beberapa Server Action sekaligus.
 * Tanpa ini, satu pemuatan halaman bisa menghasilkan lima query.
 */
export const getSession = cache(async () => {
  return auth.api.getSession({
    headers: await headers(),
    // Cookie cache Better Auth menyimpan sesi DAN data pengguna (peran, status)
    // selama 5 menit. Dengan cache itu, pengguna yang baru ditangguhkan atau
    // diturunkan perannya tetap lolos sampai 5 menit — melanggar docs/07 §7.6
    // "cabut semua sesi saat itu juga". Satu query per permintaan (sudah
    // didedupe cache()) adalah harga yang pantas.
    query: { disableCookieCache: true },
  });
});

export async function requireUser() {
  const session = await getSession();

  // Bukan langsung ke /masuk: cookie sesi yang sudah dicabut masih ada, dan
  // proxy akan memantulkannya kembali ke sini tanpa akhir. Rute ini
  // membersihkan cookie itu dulu.
  if (!session) redirect("/api/sesi-berakhir");
  if (session.user.status === "SUSPENDED") redirect("/akun-ditangguhkan");

  return session.user;
}

export async function requireRole(roles: readonly UserRole[]) {
  const user = await requireUser();

  if (!roles.includes(user.role as UserRole)) forbidden();

  return user;
}

export const requireAdmin = () => requireRole(["ADMIN", "SUPER_ADMIN"]);
export const requireSuperAdmin = () => requireRole(["SUPER_ADMIN"]);

/** true bila sesi saat ini adalah sesi impersonasi Super Admin. */
export async function isImpersonating() {
  const session = await getSession();
  return Boolean(session?.session.impersonatedBy);
}

export function isAdminRole(role: string): boolean {
  return role === "ADMIN" || role === "SUPER_ADMIN";
}

/** Super Admin yang sedang menyamar, untuk banner impersonasi — docs/07 §7.5. */
export const getImpersonator = cache(async () => {
  const session = await getSession();
  const adminId = session?.session.impersonatedBy;
  if (!adminId) return null;

  return db.user.findUnique({
    where: { id: adminId },
    select: { id: true, name: true, email: true },
  });
});
