import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

/**
 * Layout grup (auth) — kartu terpusat, tanpa navigasi.
 *
 * Pengalihan bagi pengguna yang SUDAH masuk ditangani middleware (lapis 1),
 * karena halaman ini tidak perlu memuat sesi untuk dirender.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded-md"
          aria-label="Kembali ke beranda SaCMS"
        >
          <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold">
            S
          </span>
          <span className="text-base font-bold tracking-tight">SaCMS</span>
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-8">
        <div className="w-full max-w-sm">{children}</div>
      </main>

      <footer className="text-muted-foreground px-6 py-6 text-center text-xs">
        <Link
          href="/legal/syarat"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          Syarat Layanan
        </Link>
        <span className="mx-2">·</span>
        <Link
          href="/legal/privasi"
          className="hover:text-foreground underline-offset-4 hover:underline"
        >
          Kebijakan Privasi
        </Link>
      </footer>
    </div>
  );
}
