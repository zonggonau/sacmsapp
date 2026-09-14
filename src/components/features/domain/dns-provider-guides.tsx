import { BookOpen } from "lucide-react";

/**
 * Panduan pemasangan DNS untuk penyedia yang umum di Indonesia — docs/09 §9.10.
 *
 * Langkahnya sengaja tidak menanam nilai rekaman: nilainya berbeda per domain
 * (apex vs subdomain, tantangan TXT) dan diambil dari Vercel, jadi pengguna
 * selalu diarahkan ke tabel di atas.
 *
 * Nama menu di panel penyedia bisa berubah sewaktu-waktu. Tangkapan layar per
 * penyedia dicatat di BACKLOG.
 */
const GUIDES = [
  {
    name: "Niagahoster",
    steps: [
      "Masuk ke hPanel Niagahoster, lalu pilih menu Domain.",
      "Pilih domain Anda, buka DNS / Nameserver.",
      "Pastikan nameserver masih milik Niagahoster. Bila nameserver mengarah ke layanan lain, pasang rekaman di layanan tersebut.",
      "Pada Kelola Rekaman DNS, tambahkan setiap rekaman dari tabel di atas: pilih Tipe, isi Nama, isi Nilai/Target. Biarkan TTL bawaan.",
      "Hapus rekaman A atau CNAME lama dengan nama yang sama bila ada, agar tidak bentrok.",
    ],
  },
  {
    name: "Rumahweb",
    steps: [
      "Masuk ke Clientzone Rumahweb, buka Domain lalu pilih domain Anda.",
      "Buka menu DNS Management.",
      "Tambahkan setiap rekaman dari tabel di atas. Bila kolom Host tidak menerima @, kosongkan kolom tersebut atau isi dengan nama domain lengkap.",
      "Hapus rekaman lama dengan nama yang sama, lalu simpan perubahan.",
    ],
  },
  {
    name: "DomaiNesia",
    steps: [
      "Masuk ke member area DomaiNesia, buka Domain lalu pilih domain Anda.",
      "Buka menu DNS Management (Kelola DNS).",
      "Tambahkan setiap rekaman dari tabel di atas, lalu simpan.",
      "Hapus rekaman A atau CNAME lama dengan nama yang sama bila ada.",
    ],
  },
  {
    name: "Cloudflare",
    steps: [
      "Buka dashboard Cloudflare, pilih domain Anda, lalu menu DNS → Records.",
      "Klik Add record untuk setiap rekaman dari tabel di atas.",
      "Untuk rekaman A dan CNAME, ubah Proxy status menjadi DNS only (awan abu-abu). Dengan proxy aktif, sertifikat HTTPS tidak bisa diterbitkan.",
      "Simpan. Perubahan di Cloudflare biasanya terbaca dalam beberapa menit.",
    ],
  },
] as const;

export function DnsProviderGuides() {
  return (
    <section className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <BookOpen className="text-muted-foreground size-4" />
        Panduan per penyedia domain
      </h3>
      <div className="border-border divide-border divide-y rounded-lg border">
        {GUIDES.map((guide) => (
          <details key={guide.name} className="group px-4 py-3">
            <summary className="cursor-pointer text-sm font-medium select-none">
              {guide.name}
            </summary>
            <ol className="text-muted-foreground mt-3 list-decimal space-y-1.5 pl-5 text-sm">
              {guide.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </details>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Perubahan DNS bisa memakan waktu hingga 24 jam. SaCMS memeriksa otomatis tiap 10
        menit selama 24 jam pertama; setelah itu tekan Periksa DNS.
      </p>
    </section>
  );
}
