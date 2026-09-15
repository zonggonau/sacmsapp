import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Globe,
  GraduationCap,
  History,
  Languages,
  MessageSquareText,
  Rocket,
  Sparkles,
  Store,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Landing page — docs/05 §5.1 ("hero + input prompt besar"), docs/01 §1.1.
 *
 * Prompt-first (docs/01 §1.7): pengunjung langsung menulis keinginannya.
 * Formulir hanya membawa teks itu ke pendaftaran; tidak ada yang dikirim ke AI
 * sebelum pengunjung punya akun dan kuota.
 */

// Judul absolut: tanpa ini template "%s | SaCMS" dari layout akar ikut dipakai
// dan judul beranda menjadi "SaCMS — … | SaCMS".
export const metadata: Metadata = {
  title: { absolute: "SaCMS — Buat Website dengan AI dalam Bahasa Indonesia" },
};

const STEPS = [
  {
    icon: MessageSquareText,
    title: "Ceritakan websitenya",
    body: "Tulis dalam bahasa sehari-hari: untuk siapa, halaman apa saja, isinya apa.",
  },
  {
    icon: Sparkles,
    title: "AI membangunnya",
    body: "Dalam beberapa menit website jadi. Lihat pratinjaunya dan minta perubahan lewat chat.",
  },
  {
    icon: Rocket,
    title: "Terbitkan",
    body: "Satu klik, website tayang di internet dengan HTTPS. Pakai domain sendiri kapan saja.",
  },
];

const AUDIENCE = [
  {
    icon: Building2,
    title: "Instansi pemerintah",
    body: "Profil dinas, berita, agenda, layanan publik.",
  },
  {
    icon: GraduationCap,
    title: "Sekolah & kampus",
    body: "Profil sekolah, PPDB, berita, galeri kegiatan.",
  },
  {
    icon: Store,
    title: "UMKM & usaha",
    body: "Katalog produk, menu, lokasi, tombol WhatsApp.",
  },
];

const FEATURES = [
  {
    icon: Languages,
    title: "Sepenuhnya bahasa Indonesia",
    body: "Dari tampilan sampai pesan kesalahan. Tanpa istilah teknis.",
  },
  {
    icon: MessageSquareText,
    title: "Ubah lewat chat",
    body: "Ganti warna, tambah halaman, perbarui isi — cukup minta.",
  },
  {
    icon: History,
    title: "Aman untuk dicoba",
    body: "Setiap versi tersimpan. Kembali ke versi sebelumnya kapan saja.",
  },
  {
    icon: Globe,
    title: "Domain sendiri",
    body: "Hubungkan domain .go.id, .sch.id, atau .com dengan panduan langkah demi langkah.",
  },
];

const FAQ = [
  {
    q: "Apakah saya perlu bisa koding?",
    a: "Tidak. Anda cukup menulis keinginan dalam bahasa Indonesia. Kode dibuat dan diterbitkan otomatis.",
  },
  {
    q: "Berapa lama sampai website tayang?",
    a: "Pembuatan biasanya 2–4 menit, penerbitan 1–3 menit. Anda boleh menutup halaman — kami kabari lewat email saat website siap.",
  },
  {
    q: "Bagaimana kalau hasilnya belum sesuai?",
    a: "Minta perubahan lewat chat di halaman yang sama. Setiap versi tersimpan, jadi versi lama bisa dikembalikan.",
  },
  {
    q: "Apa itu kredit?",
    a: "1 kredit = 1 kali pembuatan atau perubahan website. Menerbitkan dan mengembalikan versi tidak memakai kredit.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-4xl px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24">
        <p className="text-primary-text mb-4 text-sm font-medium">
          AI Website Builder berbahasa Indonesia
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl md:text-6xl">
          Ketik satu kalimat. Website Anda langsung tayang.
        </h1>
        <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg text-balance">
          Untuk instansi, sekolah, dan UMKM yang butuh website resmi hari ini — tanpa
          developer, tanpa koding, tanpa urusan server.
        </p>

        <form
          action="/daftar"
          method="get"
          className="border-border bg-card mx-auto mt-10 max-w-2xl space-y-3 rounded-xl border p-4 text-left"
        >
          <Label htmlFor="prompt" className="text-sm">
            Website seperti apa yang Anda butuhkan?
          </Label>
          <Textarea
            id="prompt"
            name="prompt"
            rows={4}
            maxLength={4000}
            placeholder="Contoh: Website resmi Dinas Kominfo Kabupaten Intan Jaya dengan berita, agenda kegiatan, profil pejabat, dan layanan pengaduan."
          />
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-muted-foreground text-xs">
              Gratis untuk memulai. Tidak perlu kartu kredit.
            </p>
            <Button type="submit" size="lg">
              <Sparkles className="size-4" />
              Buat Website Saya
            </Button>
          </div>
        </form>
      </section>

      <section id="cara-kerja" className="border-border bg-card/40 border-y">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-semibold tracking-tight">
            Tiga langkah, beberapa menit
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="border-border bg-background rounded-lg border p-6"
              >
                <div className="flex items-center gap-3">
                  <span className="bg-muted text-muted-foreground grid size-8 place-items-center rounded-full font-mono text-sm">
                    {i + 1}
                  </span>
                  <step.icon
                    className="text-muted-foreground size-5"
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">
          Dibuat untuk kebutuhan di Indonesia
        </h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {AUDIENCE.map((a) => (
            <div key={a.title} className="border-border rounded-lg border p-5">
              <a.icon className="text-muted-foreground size-5" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">{a.title}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{a.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-12 grid gap-x-8 gap-y-6 sm:grid-cols-2">
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

      <section className="border-border border-t">
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
            <p className="text-lg font-semibold">Siap punya website hari ini?</p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" asChild>
                <Link href="/daftar">
                  Daftar gratis
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button variant="ghost" asChild>
                <Link href="/harga">Lihat harga</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
