import type { LucideIcon } from "lucide-react";
import { FolderKanban, LayoutDashboard, ShieldCheck, User } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** true = aktif hanya bila path persis sama (untuk rute indeks). */
  exact?: boolean;
}

/**
 * Navigasi utama.
 *
 * Hanya memuat rute yang BENAR-BENAR sudah ada. "Admin" masuk di Fase 5 —
 * menampilkannya sekarang hanya menghasilkan tautan mati.
 * docs/13-ROADMAP-DAN-FASE.md
 */
export const MAIN_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, exact: true },
  { label: "Project", href: "/projects", icon: FolderKanban },
];

export const ACCOUNT_NAV: NavItem[] = [
  { label: "Profil", href: "/akun/profil", icon: User },
  { label: "Keamanan", href: "/akun/keamanan", icon: ShieldCheck },
];

/** Menentukan apakah sebuah item nav sedang aktif untuk path saat ini. */
export function isNavActive(pathname: string, item: NavItem): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}
