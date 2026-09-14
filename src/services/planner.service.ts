import { resolveModel, type V0Model } from "@/config/ai-models";
import { getWebsiteType } from "@/config/website-types";
import { flagSuspiciousPrompt, sanitizeUserPrompt } from "@/lib/v0/system-prompt";
import type { WebsiteType } from "@/types/db";

/**
 * Perencana build — docs/09-AI-BUILDER-PIPELINE.md §9.3 langkah 1–2.
 *
 * Mengubah prompt bebas menjadi spesifikasi terstruktur SEBELUM menyentuh AI.
 *
 * Sengaja TANPA memanggil LLM. Perencanaan dilakukan dengan aturan
 * deterministik atas template tipe website, karena:
 * - hasilnya bisa diulang dan diuji tanpa biaya,
 * - tidak menambah satu titik kegagalan jaringan lagi sebelum langkah utama,
 * - nilai nyatanya ada di daftar requirements yang kita tulis sendiri, bukan di
 *   kemampuan model menebak apa yang dibutuhkan situs pemerintah.
 */

export interface BuildSpec {
  projectType: WebsiteType;
  projectTypeLabel: string;
  language: "id";
  pages: string[];
  features: string[];
  requirements: string[];
}

export interface BuildPlan {
  kind: "INITIAL" | "EDIT";
  sanitizedPrompt: string;
  /** Pola yang patut ditinjau Super Admin. Tidak memblokir build. */
  suspiciousFlags: string[];
  model: V0Model;
  spec: BuildSpec;
}

/**
 * Halaman baku per tipe website. Prompt pengguna bisa menambah, tidak mengurangi
 * — situs pemerintah tanpa halaman kontak tetap situs yang kurang.
 */
const BASE_PAGES: Record<WebsiteType, string[]> = {
  GOVERNMENT: [
    "/",
    "/profil",
    "/berita",
    "/berita/[slug]",
    "/agenda",
    "/layanan",
    "/opd",
    "/galeri",
    "/kontak",
  ],
  SCHOOL: [
    "/",
    "/profil",
    "/akademik",
    "/berita",
    "/berita/[slug]",
    "/ekstrakurikuler",
    "/ppdb",
    "/kontak",
  ],
  COMPANY: ["/", "/tentang", "/layanan", "/portofolio", "/tim", "/kontak"],
  ECOMMERCE: [
    "/",
    "/produk",
    "/produk/[slug]",
    "/keranjang",
    "/checkout",
    "/kebijakan",
    "/kontak",
  ],
  HOSPITAL: [
    "/",
    "/layanan",
    "/dokter",
    "/jadwal",
    "/artikel",
    "/pendaftaran",
    "/kontak",
  ],
  HOTEL: [
    "/",
    "/kamar",
    "/kamar/[slug]",
    "/fasilitas",
    "/galeri",
    "/reservasi",
    "/kontak",
  ],
  RESTAURANT: ["/", "/menu", "/galeri", "/reservasi", "/kontak"],
  PORTFOLIO: ["/", "/karya", "/karya/[slug]", "/tentang", "/kontak"],
  SAAS: ["/", "/fitur", "/harga", "/faq", "/masuk", "/daftar"],
  LANDING: ["/"],
  BLOG: [
    "/",
    "/artikel",
    "/artikel/[slug]",
    "/kategori/[slug]",
    "/penulis/[slug]",
    "/tentang",
  ],
  CUSTOM: ["/", "/kontak"],
};

/**
 * Fitur yang disebut pengguna, dideteksi dari kata kunci.
 *
 * Ini pelengkap, bukan pengganti requirements template. Tujuannya memastikan
 * hal yang pengguna sebut eksplisit tidak hilang di dalam spesifikasi.
 */
const FEATURE_KEYWORDS: Array<{ feature: string; pattern: RegExp }> = [
  { feature: "pencarian", pattern: /cari|pencarian|search/i },
  { feature: "formulir kontak", pattern: /kontak|hubungi|formulir|form/i },
  { feature: "peta lokasi", pattern: /peta|maps|lokasi|alamat/i },
  { feature: "galeri foto", pattern: /galeri|gallery|foto|album/i },
  { feature: "unduh dokumen", pattern: /unduh|download|pdf|dokumen/i },
  { feature: "berita", pattern: /berita|artikel|news|blog/i },
  { feature: "agenda kegiatan", pattern: /agenda|jadwal|kalender|acara|event/i },
  { feature: "katalog produk", pattern: /produk|katalog|barang|jual/i },
  { feature: "keranjang belanja", pattern: /keranjang|cart|checkout|pembayaran/i },
  { feature: "autentikasi pengguna", pattern: /login|masuk|daftar|akun|admin/i },
  { feature: "dark mode", pattern: /dark\s*mode|mode\s*gelap|tema\s*gelap/i },
  {
    feature: "multi bahasa",
    pattern: /dua\s*bahasa|multi\s*bahasa|bilingual|english/i,
  },
  { feature: "testimoni", pattern: /testimoni|ulasan|review/i },
  { feature: "statistik", pattern: /statistik|grafik|chart|dashboard/i },
];

/** Halaman tambahan yang jelas diminta pengguna tapi tidak ada di daftar baku. */
const EXTRA_PAGE_KEYWORDS: Array<{ page: string; pattern: RegExp }> = [
  { page: "/transparansi", pattern: /transparansi|apbd|anggaran/i },
  { page: "/faq", pattern: /faq|tanya\s*jawab|pertanyaan/i },
  { page: "/karier", pattern: /karier|karir|lowongan|rekrutmen/i },
  { page: "/harga", pattern: /harga|tarif|paket\s*harga|biaya/i },
  { page: "/galeri", pattern: /galeri|gallery/i },
];

function detect<T>(
  prompt: string,
  table: Array<{ pattern: RegExp } & Record<string, unknown>>,
  pick: (row: { pattern: RegExp } & Record<string, unknown>) => T,
): T[] {
  return table.filter((row) => row.pattern.test(prompt)).map(pick);
}

export interface PlanInput {
  kind: "INITIAL" | "EDIT";
  prompt: string;
  websiteType: WebsiteType;
  /** Model yang diizinkan paket pengguna. */
  allowedModels: string[];
  requestedModel?: string | null;
}

export function plan(input: PlanInput): BuildPlan {
  const sanitizedPrompt = sanitizeUserPrompt(input.prompt);
  const suspiciousFlags = flagSuspiciousPrompt(sanitizedPrompt);
  const type = getWebsiteType(input.websiteType);

  const basePages = BASE_PAGES[input.websiteType] ?? BASE_PAGES.CUSTOM;
  const extraPages = detect(
    sanitizedPrompt,
    EXTRA_PAGE_KEYWORDS,
    (r) => r.page as string,
  );
  const features = detect(
    sanitizedPrompt,
    FEATURE_KEYWORDS,
    (r) => r.feature as string,
  );

  const pages = [...new Set([...basePages, ...extraPages])];

  return {
    kind: input.kind,
    sanitizedPrompt,
    suspiciousFlags,
    model: resolveModel(input.allowedModels, input.requestedModel),
    spec: {
      projectType: input.websiteType,
      projectTypeLabel: type.label,
      language: "id",
      pages,
      features,
      requirements: [...type.requirements],
    },
  };
}
