import { cache } from "react";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";

import { auth } from "@/lib/auth";

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
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser() {
  const session = await getSession();

  if (!session) redirect("/masuk");
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
