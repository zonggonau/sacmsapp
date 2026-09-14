import { Sparkles, LayoutDashboard, FolderKanban, Settings } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * Halaman verifikasi design system — FASE 0.
 * Tujuannya membuktikan token warna, dark/light, dan komponen dasar sudah benar.
 * Akan diganti landing page sesungguhnya di Fase 7.
 */

const TOKENS = [
  { name: "background", className: "bg-background border border-border" },
  { name: "card", className: "bg-card border border-border" },
  { name: "muted", className: "bg-muted" },
  { name: "accent", className: "bg-accent" },
  { name: "border", className: "bg-border" },
  { name: "primary", className: "bg-primary" },
  { name: "primary-subtle", className: "bg-primary-subtle border border-primary/25" },
  { name: "foreground", className: "bg-foreground" },
];

const NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: false },
  { label: "Project", icon: FolderKanban, active: true },
  { label: "Pengaturan", icon: Settings, active: false },
];

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="text-muted-foreground text-sm">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export default function Page() {
  return (
    <div className="min-h-dvh">
      <header className="border-border bg-background/85 sticky top-0 z-20 border-b backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3">
          <div className="flex items-center gap-2.5">
            <span className="bg-primary text-primary-foreground grid size-7 place-items-center rounded-md text-xs font-bold">
              S
            </span>
            <span className="text-base font-bold tracking-tight">SaCMS</span>
          </div>
          <Badge variant="subtle">Fase 0</Badge>
          <div className="flex-1" />
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-12 px-6 py-10">
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            Verifikasi Design System
          </h1>
          <p className="text-muted-foreground max-w-prose text-sm">
            Halaman ini membuktikan token warna, mode gelap/terang, dan komponen dasar
            sudah sesuai{" "}
            <code className="font-mono text-[13px]">docs/04-DESIGN-SYSTEM.md</code>.
            Tekan tombol tema di kanan atas untuk memeriksa keduanya.
          </p>
        </div>

        <Separator />

        <Section
          title="Token warna"
          description="Dark mode memakai latar hitam murni. Kedalaman dibentuk surface dan border, bukan bayangan."
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {TOKENS.map((token) => (
              <div key={token.name} className="space-y-2">
                <div className={cn("h-16 rounded-lg", token.className)} />
                <p className="text-muted-foreground font-mono text-xs">{token.name}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Aturan kontras"
          description="Teks putih di atas oranye gagal WCAG (2,9:1). Teks hitam lulus AAA (7,3:1)."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="bg-primary text-primary-foreground rounded-lg p-5">
              <p className="font-semibold">Teks hitam di atas oranye</p>
              <p className="mt-1 text-sm opacity-80">
                7,3 : 1 — benar, ini yang dipakai
              </p>
            </div>
            <div className="border-border rounded-lg border p-5">
              <p className="text-primary-text font-semibold">
                Teks oranye di atas latar halaman
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Memakai token <code className="font-mono">primary-text</code>, aman di
                kedua tema
              </p>
            </div>
          </div>
        </Section>

        <Section title="Tombol">
          <div className="flex flex-wrap gap-3">
            <Button>
              <Sparkles className="size-4" />
              Buat Website
            </Button>
            <Button variant="secondary">Sekunder</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Hapus</Button>
            <Button disabled>Nonaktif</Button>
          </div>
        </Section>

        <Section
          title="Badge status"
          description="Warna tidak pernah menjadi satu-satunya penanda — setiap badge selalu berteks."
        >
          <div className="flex flex-wrap gap-2">
            <Badge variant="neutral">Draf</Badge>
            <Badge variant="subtle">Membangun</Badge>
            <Badge variant="subtle">Siap</Badge>
            <Badge variant="success">Live</Badge>
            <Badge variant="danger">Gagal</Badge>
            <Badge variant="warning">Kuota menipis</Badge>
            <Badge>PRO</Badge>
            <Badge variant="outline">Diarsipkan</Badge>
          </div>
        </Section>

        <Section
          title="Pola navigasi aktif"
          description="Satu item aktif: bar oranye di kiri, latar oranye tipis, teks primary-text."
        >
          <nav className="bg-sidebar border-sidebar-border w-full max-w-64 space-y-1 rounded-lg border p-2">
            {NAV.map((item) => (
              <a
                key={item.label}
                href="#"
                data-active={item.active}
                className={cn(
                  "group relative flex items-center gap-3 rounded-md px-3 py-2",
                  "text-sm font-medium transition-colors",
                  "text-muted-foreground hover:bg-accent hover:text-foreground",
                  "data-[active=true]:bg-primary-subtle data-[active=true]:text-primary-text",
                  "data-[active=true]:before:absolute data-[active=true]:before:left-0",
                  "data-[active=true]:before:h-5 data-[active=true]:before:w-0.5",
                  "data-[active=true]:before:bg-primary data-[active=true]:before:rounded-r-full",
                )}
              >
                <item.icon className="size-4 shrink-0" />
                {item.label}
              </a>
            ))}
          </nav>
        </Section>

        <Section title="Kartu dan isian">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Website Kabupaten Intan Jaya</CardTitle>
                <CardDescription>Pemerintahan · 3 halaman</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="success">Live</Badge>
              </CardContent>
              <CardFooter className="gap-2">
                <Button size="sm">Buka</Button>
                <Button size="sm" variant="outline">
                  Edit dengan AI
                </Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Formulir</CardTitle>
                <CardDescription>Ring fokus memakai warna oranye.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <Label htmlFor="contoh">Nama website</Label>
                <Input id="contoh" placeholder="Website Desa Sukamaju" />
              </CardContent>
            </Card>
          </div>
        </Section>

        <Separator />

        <footer className="text-muted-foreground flex flex-wrap justify-between gap-3 pb-6 font-mono text-xs">
          <span>SaCMS — Fase 0: Fondasi &amp; Setup</span>
          <span>docs/13-ROADMAP-DAN-FASE.md</span>
        </footer>
      </main>
    </div>
  );
}
