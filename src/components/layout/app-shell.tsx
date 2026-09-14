import Link from "next/link";

import { NavItem } from "@/components/layout/nav-item";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { MAIN_NAV } from "@/config/navigation";

interface ShellUser {
  name: string;
  email: string;
  image?: string | null;
  role: string;
}

/**
 * Kerangka area terautentikasi: sidebar + topbar.
 *
 * Server Component — hanya UserMenu, NavItem, dan ThemeToggle yang client,
 * sesuai aturan "dorong client ke bawah" (docs/05 §5.6).
 */
export function AppShell({
  user,
  children,
}: {
  user: ShellUser;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#konten"
        className="bg-primary text-primary-foreground sr-only rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50"
      >
        Lewati ke konten utama
      </a>

      <aside className="bg-sidebar border-sidebar-border hidden w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold">
              S
            </span>
            <span className="text-base font-bold tracking-tight">SaCMS</span>
          </Link>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-2" aria-label="Navigasi utama">
          {MAIN_NAV.map((item) => (
            <NavItem key={item.href} item={item} />
          ))}
        </nav>

        <div className="border-sidebar-border border-t p-4">
          <p className="text-muted-foreground font-mono text-[11px]">
            Fase 1 · Auth &amp; App Shell
          </p>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-border bg-background/85 sticky top-0 z-20 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md md:hidden"
          >
            <span className="bg-primary text-primary-foreground grid size-6 place-items-center rounded text-[10px] font-bold">
              S
            </span>
            <span className="text-sm font-bold">SaCMS</span>
          </Link>

          <div className="flex-1" />

          {user.role === "SUPER_ADMIN" ? <Badge>SUPER ADMIN</Badge> : null}
          <ThemeToggle />
          <UserMenu name={user.name} email={user.email} image={user.image} />
        </header>

        <main id="konten" className="flex-1 p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
