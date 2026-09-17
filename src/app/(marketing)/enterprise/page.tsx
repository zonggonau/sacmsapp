import type { Metadata } from "next";
import Link from "next/link";
import {
  Bot,
  Braces,
  Check,
  Database,
  ExternalLink,
  Globe,
  KeyRound,
  Languages,
  ListChecks,
  Server,
  ShieldCheck,
  Webhook,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { SACMS_DEVELOPER } from "@/config/enterprise";
import { SUPPORT, whatsappWithText } from "@/config/support";

export const metadata: Metadata = {
  title: "Enterprise",
  description:
    "SaCMS Developer untuk developer, agensi, dan instansi yang membangun sistemnya sendiri — server khusus, database terpisah, REST, GraphQL, dan MCP.",
};

/**
 * Halaman Enterprise — RENCANA-FRONTEND.md §7.
 *
 * Enterprise TIDAK dijual di aplikasi ini. Halaman ini hanya menjelaskan dan menaut
 * keluar ke SaCMS Developer, tempat pendaftaran dan langganan dilakukan (ADR-015 §7).
 *
 * Setiap fitur yang disebut di sini sudah ada di SaCMS Developer. Jangan menambahkan
 * janji — harga, SLA, lokasi server — yang belum diputuskan pemilik sistem.
 */

const FEATURES = [
  {
    icon: Server,
    title: "Server khusus",
    body: "VPS untuk workspace Anda sendiri. Database PostgreSQL dan storage berada di server itu, tidak dibagi dengan pelanggan lain.",
  },
  {
    icon: Database,
    title: "Headless CMS",
    body: "Content type, single type, komponen, media library, dan riwayat versi konten.",
  },
  {
    icon: Braces,
    title: "REST, GraphQL & SDK",
    body: "API publik per workspace lengkap dengan spesifikasi OpenAPI, plus SDK TypeScript.",
  },
  {
    icon: Bot,
    title: "MCP untuk AI coding agent",
    body: "Kelola content type, konten, dan webhook langsung dari editor kode lewat Model Context Protocol.",
  },
  {
    icon: ListChecks,
    title: "Alur persetujuan konten",
    body: "Review berurutan dan penjadwalan sebelum konten terbit.",
  },
  {
    icon: ShieldCheck,
    title: "Peran & jejak audit",
    body: "Hak akses per peran dan log audit untuk setiap perubahan.",
  },
  {
    icon: Globe,
    title: "Custom domain & white-label",
    body: "Domain sendiri dengan HTTPS otomatis, serta nama dan logo instansi Anda di halaman login.",
  },
  {
    icon: Webhook,
    title: "Webhook",
    body: "Beri tahu sistem lain saat konten berubah, dengan antrean ulang bila pengiriman gagal.",
  },
  {
    icon: KeyRound,
    title: "Akun untuk pengguna aplikasi Anda",
    body: "Pendaftaran, login, dan reset sandi untuk pengguna sistem yang Anda bangun.",
  },
  {
    icon: Languages,
    title: "Multi-bahasa",
    body: "Konten dalam beberapa bahasa di satu workspace.",
  },
];

const STEPS = [
  {
    title: `Daftar di ${SACMS_DEVELOPER.name}`,
    body: `Buat akun di ${SACMS_DEVELOPER.host}. Akun ini terpisah dari akun sacms.cloud.`,
  },
  {
    title: "Berlangganan Enterprise",
    body: "Pilih paket Enterprise saat berlangganan.",
  },
  {
    title: "Server disiapkan",
    body: "Server khusus, database, dan storage disiapkan untuk workspace Anda.",
  },
  {
    title: "Hubungkan sistem Anda",
    body: "Pakai REST, GraphQL, SDK TypeScript, atau MCP dari editor kode.",
  },
];

const FAQ = [
  {
    q: "Apakah akun sacms.cloud bisa dipakai di SaCMS Developer?",
    a: `Tidak. Keduanya memakai akun terpisah — daftar akun baru di ${SACMS_DEVELOPER.host}.`,
  },
  {
    q: "Bisakah website yang sudah saya buat di sacms.cloud dipindah ke Enterprise?",
    a: "Belum. Enterprise dimulai sebagai proyek baru di SaCMS Developer.",
  },
  {
    q: "Kami tidak punya developer. Apakah Enterprise cocok?",
    a: "Kemungkinan besar tidak. Enterprise ditujukan untuk tim yang membangun sistemnya sendiri lewat API. Untuk website jadi tanpa koding, pilih paket Standar, Pro, atau Business.",
  },
  {
    q: "Di mana data kami disimpan?",
    a: "Di server khusus untuk workspace Anda. Database PostgreSQL dan storage berada di server itu dan tidak dibagi dengan pelanggan lain.",
  },
  {
    q: "Berapa harganya?",
    a: "Rincian paket dan harga Enterprise tersedia saat berlangganan di SaCMS Developer. Untuk kebutuhan khusus instansi, hubungi kami.",
  },
];

const DISCUSS_TEXT = "Halo, saya ingin berdiskusi tentang SaCMS Developer Enterprise.";

/** Tautan keluar ke SaCMS Developer — dibuka di tab baru. */
function ExternalLabel({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ExternalLink className="size-4" aria-hidden="true" />
      <span className="sr-only">(membuka tab baru)</span>
    </>
  );
}

export default function EnterprisePage() {
  const discussHref = whatsappWithText(DISCUSS_TEXT) ?? SUPPORT.emailHref;

  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-16 text-center sm:px-6 sm:pt-24">
        <p className="text-primary-text mb-4 text-sm font-medium">
          {SACMS_DEVELOPER.name} · Enterprise
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Bangun sistem Anda sendiri, di server khusus Anda.
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-balance">
          Untuk developer, agensi, dan instansi yang menulis kodenya sendiri. Konten
          dikelola lewat CMS, sistem Anda membacanya lewat API — dan semuanya berjalan
          di server yang tidak dibagi dengan pelanggan lain.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" asChild>
            <a
              href={SACMS_DEVELOPER.registerHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLabel>Daftar di {SACMS_DEVELOPER.name}</ExternalLabel>
            </a>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <a
              href={SACMS_DEVELOPER.docsHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLabel>Baca dokumentasi</ExternalLabel>
            </a>
          </Button>
        </div>
        <p className="text-muted-foreground mt-4 text-xs">
          Akun {SACMS_DEVELOPER.name} terpisah dari akun di sacms.cloud.
        </p>
      </section>

      <section className="border-border bg-card/40 border-y">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Mana yang cocok untuk Anda?
          </h2>
          <div className="mx-auto mt-10 grid max-w-4xl gap-6 md:grid-cols-2">
            <div className="border-border bg-background flex flex-col rounded-xl border p-6">
              <p className="text-muted-foreground text-xs font-medium">
                di sacms.cloud
              </p>
              <h3 className="mt-1 text-lg font-semibold">Standar · Pro · Business</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Untuk yang ingin website jadi tanpa koding.
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {[
                  "Website dibuat AI dari satu kalimat",
                  "Tidak perlu developer",
                  "Hosting, domain, dan penerbitan sudah termasuk",
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check
                      className="text-success mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant="outline" asChild>
                <Link href="/harga">Lihat paket</Link>
              </Button>
            </div>

            <div className="border-border bg-background flex flex-col rounded-xl border p-6">
              <p className="text-muted-foreground text-xs font-medium">
                di {SACMS_DEVELOPER.name}
              </p>
              <h3 className="mt-1 text-lg font-semibold">Enterprise</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Untuk tim yang membangun sistemnya sendiri.
              </p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm">
                {[
                  "Website, aplikasi, atau integrasi dibangun tim Anda di atas API",
                  "Server khusus dengan database dan storage sendiri",
                  `Akun dan langganan dikelola di ${SACMS_DEVELOPER.name}`,
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <Check
                      className="text-success mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    {line}
                  </li>
                ))}
              </ul>
              <Button className="mt-6 w-full" variant="outline" asChild>
                <a
                  href={SACMS_DEVELOPER.registerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLabel>Daftar Enterprise</ExternalLabel>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">Yang Anda dapatkan</h2>
        <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <f.icon
                className="text-muted-foreground mt-0.5 size-5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{f.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-border bg-card/40 border-y">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Cara memulai
          </h2>
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="border-border bg-background rounded-lg border p-6"
              >
                <span className="bg-muted text-muted-foreground grid size-8 place-items-center rounded-full font-mono text-sm">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">Pertanyaan umum</h2>
          <div className="border-border divide-border mt-6 divide-y rounded-lg border">
            {FAQ.map((item) => (
              <details key={item.q} className="group px-5 py-4">
                <summary className="cursor-pointer font-medium select-none">
                  {item.q}
                </summary>
                <p className="text-muted-foreground mt-2 text-sm">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-3 text-center">
            <p className="text-lg font-semibold">
              Siap membangun di server Anda sendiri?
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" asChild>
                <a
                  href={SACMS_DEVELOPER.registerHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLabel>Daftar di {SACMS_DEVELOPER.name}</ExternalLabel>
                </a>
              </Button>
              {discussHref ? (
                <Button variant="ghost" asChild>
                  <a href={discussHref} target="_blank" rel="noopener noreferrer">
                    Diskusikan kebutuhan instansi
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
