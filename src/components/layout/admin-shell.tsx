import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";

import { NavItem } from "@/components/layout/nav-item";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { ADMIN_NAV } from "@/config/navigation";

/**
 * Kerangka panel Super Admin — docs/10 §10.2.
 *
 * Sengaja terlihat berbeda dari aplikasi pengguna (garis kiri oranye penuh,
 * chip SUPER ADMIN permanen, banner merah saat maintenance) supaya Super Admin
 * tidak pernah bingung sedang berada di mana.
 */
export function AdminShell({
  user,
  maintenance,
  children,
}: {
  user: { name: string; email: string; image?: string | null };
  maintenance: boolean;
  children: React.ReactNode;
}) {
  const nav = ADMIN_NAV.map((item) => (
    <NavItem
      key={item.href}
      label={item.label}
      href={item.href}
      exact={item.exact}
      icon={<item.icon className="size-4 shrink-0" />}
    />
  ));

  return (
    <div className="flex min-h-dvh">
      <a
        href="#konten-admin"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Lewati ke konten utama
      </a>

      <aside className="bg-sidebar border-sidebar-border border-l-primary hidden w-60 shrink-0 flex-col border-r border-l-4 md:flex">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link href="/admin" className="flex items-center gap-2.5 rounded-md">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold">
              S
            </span>
            <span className="text-base font-bold tracking-tight">Panel Admin</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-2" aria-label="Navigasi admin">
          {nav}
        </nav>

        <div className="border-sidebar-border border-t px-2 py-2">
          <NavItem
            label="Kembali ke Aplikasi"
            href="/dashboard"
            icon={<ArrowLeft className="size-4 shrink-0" />}
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="sticky top-0 z-20">
          {maintenance ? (
            <div
              role="status"
              className="bg-destructive text-destructive-foreground flex items-center justify-center gap-2 px-4 py-2 text-center text-sm font-medium"
            >
              <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
              Maintenance mode AKTIF — pengguna biasa tidak bisa memakai aplikasi.
            </div>
          ) : null}

          <header className="border-border bg-background/85 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
            <Link href="/admin" className="text-sm font-bold md:hidden">
              Panel Admin
            </Link>
            <div className="flex-1" />
            <Badge>SUPER ADMIN</Badge>
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} image={user.image} />
          </header>

          <nav
            className="border-border bg-background flex gap-1 overflow-x-auto border-b px-2 py-2 md:hidden"
            aria-label="Navigasi admin"
          >
            {nav}
          </nav>
        </div>

        <main id="konten-admin" className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
