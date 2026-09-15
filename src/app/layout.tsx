import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SaCMS — Buat Website dengan AI",
    template: "%s | SaCMS",
  },
  description:
    "Ketik satu kalimat, dapatkan website siap pakai. Tanpa koding, tanpa ribet.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#212121" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Nonce CSP dari proxy — docs/12 §12.3. Membaca headers() membuat seluruh
  // halaman dirender dinamis; itu syarat nonce (nonce statis = tidak berarti).
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    // suppressHydrationWarning WAJIB — tanpa ini next-themes memicu error hidrasi.
    <html lang="id" suppressHydrationWarning>
      <body className={cn(geistSans.variable, geistMono.variable, "font-sans")}>
        <ThemeProvider
          // Skrip inline next-themes (cegah kedip tema) wajib ber-nonce.
          nonce={nonce}
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {/* NuqsAdapter wajib: state filter/pencarian hidup di URL, bukan
              useState — docs/05 §5.7 */}
          <NuqsAdapter>{children}</NuqsAdapter>
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
