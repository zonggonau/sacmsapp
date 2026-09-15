import Link from "next/link";
import { Bell, ShieldCheck } from "lucide-react";

import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { NavItem } from "@/components/layout/nav-item";
import { UserMenu } from "@/components/layout/user-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { MAIN_NAV } from "@/config/navigation";
import { CRITICAL_CREDIT_RATIO, LOW_CREDIT_RATIO, PLAN_PAGE } from "@/config/quota";
import { angka } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ShellUser {
  name: string;
  email: string;
  image?: string | null;
  role: string;
}

interface Impersonation {
  userName: string;
  userEmail: string;
  adminName: string;
}

/**
 * Sisa kredit selalu terlihat di topbar — docs/11 §11.6: kuota harus terlihat
 * SEBELUM dibutuhkan. Oranye saat sisa ≤ 20%, merah saat ≤ 5%.
 */
function CreditMeter({ used, limit }: { used: number; limit: number }) {
  const remainingRatio = limit > 0 ? Math.max(0, limit - used) / limit : 0;
  const tone =
    remainingRatio <= CRITICAL_CREDIT_RATIO
      ? "text-destructive"
      : remainingRatio <= LOW_CREDIT_RATIO
        ? "text-primary-text"
        : "text-muted-foreground";

  return (
    <Link
      href={PLAN_PAGE}
      title="Kredit terpakai bulan ini"
      className={cn(
        "hover:bg-accent hidden rounded-md px-2 py-1 font-mono text-xs tabular-nums sm:inline-flex",
        tone,
      )}
    >
      {angka(used)} / {angka(limit)} kredit
    </Link>
  );
}

/**
 * Kerangka area terautentikasi: sidebar + topbar.
 *
 * Server Component — hanya UserMenu, NavItem, ThemeToggle, dan banner yang
 * client, sesuai aturan "dorong client ke bawah" (docs/05 §5.6).
 */
export function AppShell({
  user,
  impersonation,
  credits,
  unreadNotifications = 0,
  children,
}: {
  user: ShellUser;
  impersonation: Impersonation | null;
  credits: { used: number; limit: number } | null;
  unreadNotifications?: number;
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

      <aside className="bg-sidebar border-sidebar-border sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r md:flex">
        <div className="flex h-14 items-center gap-2.5 px-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold">
              S
            </span>
            <span className="text-base font-bold tracking-tight">SaCMS</span>
          </Link>
        </div>

        <nav
          className="flex-1 space-y-1 overflow-y-auto px-2 py-2"
          aria-label="Navigasi utama"
        >
          {MAIN_NAV.map((item) => (
            <NavItem
              key={item.href}
              label={item.label}
              href={item.href}
              exact={item.exact}
              // Ikon di-render DI SINI lalu dikirim sebagai elemen.
              // Mengirim komponennya akan gagal serialisasi — lihat nav-item.tsx.
              icon={<item.icon className="size-4 shrink-0" />}
            />
          ))}
        </nav>

        {user.role === "SUPER_ADMIN" && !impersonation ? (
          <div className="border-sidebar-border border-t px-2 py-2">
            <NavItem
              label="Panel Admin"
              href="/admin"
              icon={<ShieldCheck className="size-4 shrink-0" />}
            />
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Banner dan topbar menempel bersama, supaya banner impersonasi
            tidak pernah tergulung keluar layar. */}
        <div className="sticky top-0 z-20">
          {impersonation ? <ImpersonationBanner {...impersonation} /> : null}

          <header className="border-border bg-background/85 flex h-14 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
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

            {credits ? <CreditMeter used={credits.used} limit={credits.limit} /> : null}
            <Link
              href="/akun/notifikasi"
              aria-label={
                unreadNotifications > 0
                  ? `Notifikasi, ${unreadNotifications} belum dibaca`
                  : "Notifikasi"
              }
              className="hover:bg-accent relative grid size-9 place-items-center rounded-md"
            >
              <Bell className="size-4" />
              {unreadNotifications > 0 ? (
                <span className="bg-primary text-primary-foreground absolute top-1 right-1 grid min-w-4 place-items-center rounded-full px-1 text-[10px] leading-4 font-bold">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              ) : null}
            </Link>
            {user.role === "SUPER_ADMIN" && !impersonation ? (
              <Badge>SUPER ADMIN</Badge>
            ) : null}
            <ThemeToggle />
            <UserMenu name={user.name} email={user.email} image={user.image} />
          </header>
        </div>

        <main id="konten" className="flex-1 p-6 lg:p-8">
          {/* Lebar konten seragam: max-w-6xl (1152px), di tengah. Halaman yang
              menandai dirinya data-lebar="penuh" (ruang kerja project) memakai
              lebar penuh. */}
          <div className="mx-auto w-full max-w-6xl has-[[data-lebar=penuh]]:max-w-none">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
