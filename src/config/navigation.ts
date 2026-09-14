import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FolderKanban,
  Hammer,
  LayoutDashboard,
  Package,
  ScrollText,
  Settings,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** true = aktif hanya bila path persis sama (untuk rute indeks). */
  exact?: boolean;
}

/**
 * Navigasi utama. Hanya memuat rute yang BENAR-BENAR sudah ada.
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

/** Navigasi panel Super Admin — docs/10 §10.10. */
export const ADMIN_NAV: NavItem[] = [
  { label: "Ringkasan", href: "/admin", icon: LayoutDashboard, exact: true },
  { label: "Pengguna", href: "/admin/pengguna", icon: Users },
  { label: "Project", href: "/admin/project", icon: FolderKanban },
  { label: "Build", href: "/admin/build", icon: Hammer },
  { label: "Paket", href: "/admin/paket", icon: Package },
  { label: "AI & Model", href: "/admin/ai", icon: Bot },
  { label: "Sistem", href: "/admin/sistem", icon: Settings },
  { label: "Audit Log", href: "/admin/audit", icon: ScrollText },
];
