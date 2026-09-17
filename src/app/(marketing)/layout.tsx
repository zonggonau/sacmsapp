import { SUPPORT } from "@/config/support";
import type { Metadata } from "next";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "SaCMS — Buat Website dengan AI dalam Bahasa Indonesia",
    template: "%s | SaCMS",
  },
  description:
    "Ketik satu kalimat, dapatkan website siap tayang. Untuk instansi pemerintah, sekolah, dan UMKM — tanpa koding.",
  openGraph: {
    type: "website",
    locale: "id_ID",
    siteName: "SaCMS",
  },
};

/**
 * Layout grup (marketing) — header publik + footer. docs/05 §5.1.
 * Tidak memuat sesi: halaman publik harus bisa dirender statis.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-border bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5 rounded-md">
            {/* Lencana dekoratif: disembunyikan dari pembaca layar supaya nama tautan
                sama dengan teks yang terlihat ("SaCMS") — WCAG 2.5.3. */}
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold"
            >
              S
            </span>
            <span className="text-base font-bold tracking-tight">SaCMS</span>
          </Link>

          <nav
            className="text-muted-foreground ml-2 hidden gap-1 text-sm sm:flex"
            aria-label="Navigasi publik"
          >
            <Link
              href="/#cara-kerja"
              className="hover:text-foreground rounded-md px-2 py-1"
            >
              Cara kerja
            </Link>
            <Link href="/harga" className="hover:text-foreground rounded-md px-2 py-1">
              Harga
            </Link>
            <Link
              href="/enterprise"
              className="hover:text-foreground rounded-md px-2 py-1"
            >
              Enterprise
            </Link>
          </nav>

          <div className="flex-1" />
          <ThemeToggle />
          <Button variant="ghost" size="sm" asChild>
            <Link href="/masuk">Masuk</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/daftar">Daftar gratis</Link>
          </Button>
        </div>
      </header>

      <main id="konten" className="flex-1">
        {children}
      </main>

      <footer className="border-border border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} SaCMS — Smart Content Management System</p>
          <nav className="flex flex-wrap gap-4" aria-label="Tautan legal">
            <Link href="/harga" className="hover:text-foreground">
              Harga
            </Link>
            <Link href="/enterprise" className="hover:text-foreground">
              Untuk developer &amp; instansi
            </Link>
            <Link href="/legal/syarat" className="hover:text-foreground">
              Syarat Layanan
            </Link>
            <Link href="/legal/privasi" className="hover:text-foreground">
              Kebijakan Privasi
            </Link>
            {/* Kanal dukungan — docs/14 §14.9; tampil hanya bila env diisi. */}
            {SUPPORT.emailHref ? (
              <a href={SUPPORT.emailHref} className="hover:text-foreground">
                {SUPPORT.email}
              </a>
            ) : null}
            {SUPPORT.whatsappHref ? (
              <a
                href={SUPPORT.whatsappHref}
                target="_blank"
                rel="noreferrer noopener"
                className="hover:text-foreground"
              >
                WhatsApp
              </a>
            ) : null}
          </nav>
        </div>
      </footer>
    </div>
  );
}
