import type { LucideIcon } from "lucide-react";
import {
  Building2,
  GraduationCap,
  Hotel,
  Landmark,
  Megaphone,
  Newspaper,
  Rocket,
  ShoppingBag,
  Sparkles,
  Stethoscope,
  UserRound,
  UtensilsCrossed,
} from "lucide-react";

import type { WebsiteType } from "@/types/db";

/**
 * Template per tipe website — docs/09-AI-BUILDER-PIPELINE.md §9.6.
 *
 * DI SINI letak nilai nyata SaCMS. Pengguna awam tidak tahu apa saja yang harus
 * dimiliki sebuah situs pemerintah atau sekolah. SaCMS yang tahu: pengguna
 * menulis satu kalimat, AI menerima spesifikasi lengkap.
 *
 * `requirements` menjadi isi contoh prompt yang diisikan ke formulir project
 * baru (promptTemplate). Sejak ADR-011 daftar ini tidak lagi dikirim ke v0 di
 * belakang layar — pengguna melihat dan boleh mengubah semuanya.
 */
export interface WebsiteTypeConfig {
  value: WebsiteType;
  label: string;
  icon: LucideIcon;
  description: string;
  placeholder: string;
  requirements: string[];
}

export const WEBSITE_TYPES: WebsiteTypeConfig[] = [
  {
    value: "GOVERNMENT",
    label: "Pemerintahan",
    icon: Landmark,
    description: "Kabupaten, kota, desa, kelurahan, atau dinas",
    placeholder:
      "Contoh: Buat website Pemerintah Kabupaten Intan Jaya dengan beranda, berita, agenda, profil daerah, daftar OPD, galeri, dan kontak.",
    requirements: [
      "Identitas resmi: logo instansi, nama lengkap, tagline",
      "Navigasi: Beranda, Profil, Berita, Agenda, Layanan, OPD, Galeri, Kontak",
      "Berita dengan kategori, tanggal, penulis, dan halaman detail",
      "Pengumuman dan agenda kegiatan",
      "Profil daerah: sejarah, visi misi, struktur organisasi",
      "Daftar OPD/dinas beserta tautan dan kontak",
      "Halaman transparansi: APBD, laporan, dokumen unduhan",
      "Kontak lengkap: alamat, telepon, email, peta lokasi",
      "Aksesibilitas tinggi — banyak pengguna lansia",
      "Bahasa Indonesia formal dan baku",
    ],
  },
  {
    value: "SCHOOL",
    label: "Sekolah",
    icon: GraduationCap,
    description: "SD, SMP, SMA, SMK, madrasah, atau kampus",
    placeholder:
      "Contoh: Buat website SMA Negeri 1 Jayapura dengan profil sekolah, berita, ekstrakurikuler, PPDB, dan kontak.",
    requirements: [
      "Identitas sekolah: logo, nama, akreditasi, motto",
      "Navigasi: Beranda, Profil, Akademik, Berita, Ekstrakurikuler, PPDB, Kontak",
      "Profil: sejarah, visi misi, sambutan kepala sekolah",
      "Data guru dan tenaga kependidikan",
      "Program jurusan atau kurikulum",
      "Informasi penerimaan siswa baru (PPDB) dengan alur pendaftaran",
      "Berita dan prestasi siswa",
      "Galeri kegiatan",
      "Kontak dan peta lokasi",
    ],
  },
  {
    value: "COMPANY",
    label: "Perusahaan",
    icon: Building2,
    description: "Profil perusahaan, CV, PT, atau koperasi",
    placeholder:
      "Contoh: Buat website PT Nusantara Karya, kontraktor bangunan, dengan profil, layanan, portofolio proyek, dan kontak.",
    requirements: [
      "Beranda dengan proposisi nilai yang jelas",
      "Tentang kami: sejarah, visi misi, nilai perusahaan",
      "Daftar layanan atau produk dengan penjelasan",
      "Portofolio atau klien",
      "Tim manajemen",
      "Testimoni",
      "Formulir kontak dan penawaran",
      "Alamat kantor dan peta",
    ],
  },
  {
    value: "ECOMMERCE",
    label: "Toko Online",
    icon: ShoppingBag,
    description: "Katalog produk dengan keranjang dan checkout",
    placeholder:
      "Contoh: Buat toko online sepatu kulit Papua dengan katalog produk, keranjang, dan checkout.",
    requirements: [
      "Katalog produk dengan kategori dan filter",
      "Halaman detail produk: gambar, harga, stok, deskripsi, varian",
      "Keranjang belanja",
      "Alur checkout dengan alamat pengiriman",
      "Pencarian produk",
      "Halaman kebijakan: pengiriman, pengembalian",
      "Harga dalam Rupiah dengan pemisah ribuan",
      "Responsif — mayoritas pembeli memakai ponsel",
    ],
  },
  {
    value: "HOSPITAL",
    label: "Kesehatan",
    icon: Stethoscope,
    description: "Rumah sakit, klinik, puskesmas, apotek",
    placeholder:
      "Contoh: Buat website Klinik Sehat Sentani dengan layanan, jadwal dokter, dan pendaftaran online.",
    requirements: [
      "Daftar layanan medis dan poliklinik",
      "Jadwal praktik dokter",
      "Profil dokter dan tenaga medis",
      "Informasi pendaftaran dan rawat inap",
      "Informasi asuransi dan BPJS",
      "Nomor darurat yang menonjol di setiap halaman",
      "Artikel kesehatan",
      "Kontak, alamat, dan peta",
    ],
  },
  {
    value: "HOTEL",
    label: "Hotel & Penginapan",
    icon: Hotel,
    description: "Hotel, losmen, homestay, vila",
    placeholder:
      "Contoh: Buat website Hotel Cendrawasih Sentani dengan tipe kamar, fasilitas, galeri, dan formulir reservasi.",
    requirements: [
      "Tipe kamar dengan harga, foto, dan fasilitas",
      "Fasilitas hotel",
      "Galeri foto berkualitas tinggi",
      "Formulir reservasi dengan tanggal menginap",
      "Informasi lokasi dan objek wisata sekitar",
      "Kebijakan check-in, check-out, dan pembatalan",
      "Testimoni tamu",
    ],
  },
  {
    value: "RESTAURANT",
    label: "Restoran & Kafe",
    icon: UtensilsCrossed,
    description: "Restoran, kafe, katering, warung",
    placeholder:
      "Contoh: Buat website Kopi Papua Sentani dengan menu, harga, galeri, dan lokasi.",
    requirements: [
      "Menu dengan kategori, foto, dan harga",
      "Jam operasional",
      "Galeri suasana tempat",
      "Informasi reservasi meja",
      "Layanan pesan antar bila ada",
      "Lokasi dan peta",
      "Tautan media sosial",
    ],
  },
  {
    value: "PORTFOLIO",
    label: "Portofolio",
    icon: UserRound,
    description: "Portofolio pribadi, fotografer, desainer",
    placeholder:
      "Contoh: Buat portofolio fotografer pernikahan dengan galeri karya, tentang saya, paket harga, dan kontak.",
    requirements: [
      "Beranda dengan karya terbaik di depan",
      "Galeri karya dengan kategori",
      "Tentang saya dan keahlian",
      "Pengalaman atau riwayat kerja",
      "Paket layanan dan harga bila relevan",
      "Formulir kontak",
      "Tautan media sosial dan unduh CV",
    ],
  },
  {
    value: "SAAS",
    label: "Produk SaaS",
    icon: Rocket,
    description: "Aplikasi berlangganan dengan halaman harga",
    placeholder:
      "Contoh: Buat landing page aplikasi kasir untuk UMKM dengan fitur, harga berlangganan, dan pendaftaran.",
    requirements: [
      "Beranda dengan proposisi nilai dan ajakan tindakan jelas",
      "Daftar fitur dengan penjelasan manfaat, bukan hanya teknis",
      "Halaman harga dengan perbandingan paket",
      "Tanya jawab (FAQ)",
      "Testimoni atau logo pengguna",
      "Halaman masuk dan daftar",
      "Dokumentasi atau panduan awal",
    ],
  },
  {
    value: "LANDING",
    label: "Landing Page",
    icon: Megaphone,
    description: "Satu halaman untuk kampanye atau acara",
    placeholder:
      "Contoh: Buat landing page seminar kewirausahaan Papua dengan agenda, pembicara, dan formulir pendaftaran.",
    requirements: [
      "Satu halaman dengan alur membaca yang jelas dari atas ke bawah",
      "Judul utama yang langsung menjelaskan manfaat",
      "Ajakan tindakan yang berulang di beberapa titik",
      "Detail acara atau penawaran: tanggal, tempat, harga",
      "Formulir pendaftaran singkat",
      "Bukti sosial: testimoni, jumlah peserta, logo mitra",
    ],
  },
  {
    value: "BLOG",
    label: "Blog & Berita",
    icon: Newspaper,
    description: "Portal berita atau blog pribadi",
    placeholder:
      "Contoh: Buat portal berita lokal Papua dengan kategori, artikel, dan halaman penulis.",
    requirements: [
      "Beranda dengan artikel terbaru dan pilihan editor",
      "Kategori dan tag",
      "Halaman artikel dengan penulis, tanggal, dan waktu baca",
      "Pencarian artikel",
      "Halaman profil penulis",
      "Artikel terkait di akhir tulisan",
      "SEO kuat: metadata, sitemap, structured data",
    ],
  },
  {
    value: "CUSTOM",
    label: "Lainnya",
    icon: Sparkles,
    description: "Jelaskan sendiri kebutuhan Anda",
    placeholder:
      "Ceritakan website yang Anda inginkan: untuk siapa, halaman apa saja, dan apa yang harus bisa dilakukan pengunjung.",
    requirements: [
      "Ikuti sepenuhnya deskripsi pengguna",
      "Bila deskripsi kurang lengkap, pilih struktur wajar untuk jenis situs tersebut",
    ],
  },
];

const BY_VALUE = new Map(WEBSITE_TYPES.map((t) => [t.value, t]));

export function getWebsiteType(value: WebsiteType): WebsiteTypeConfig {
  const found = BY_VALUE.get(value);
  // CUSTOM selalu ada di daftar, jadi ini tidak pernah undefined.
  return found ?? WEBSITE_TYPES[WEBSITE_TYPES.length - 1]!;
}

/** Pokok kalimat contoh prompt. Bagian yang diganti pengguna ada di [kurung siku]. */
const PROMPT_SUBJECT: Record<WebsiteType, string> = {
  GOVERNMENT: "website resmi [nama pemerintah daerah, desa, atau dinas]",
  SCHOOL: "website [nama sekolah atau kampus]",
  COMPANY: "website profil [nama perusahaan] yang bergerak di bidang [bidang usaha]",
  ECOMMERCE: "toko online [nama toko] yang menjual [jenis produk]",
  HOSPITAL: "website [nama rumah sakit, klinik, atau puskesmas]",
  HOTEL: "website [nama hotel atau penginapan] di [kota]",
  RESTAURANT: "website [nama restoran atau kafe] di [kota]",
  PORTFOLIO: "website portofolio [nama Anda], seorang [profesi]",
  SAAS: "landing page aplikasi [nama aplikasi] untuk [target pengguna]",
  LANDING: "landing page untuk [nama acara atau kampanye]",
  BLOG: "portal berita atau blog [nama situs] tentang [topik]",
  CUSTOM: "website [jelaskan jenis website] untuk [siapa pengunjungnya]",
};

/**
 * Contoh prompt yang langsung diisikan ke formulir saat pengguna memilih jenis
 * website. Hanya BANTUAN MENULIS: pengguna bebas mengubahnya, dan yang dikirim
 * ke v0 tetap teks akhir di formulir apa adanya (ADR-011).
 */
export function promptTemplate(value: WebsiteType): string {
  const closing = "Gunakan bahasa Indonesia dan pastikan tampilan rapi di ponsel.";

  if (value === "CUSTOM") {
    return [
      `Buat ${PROMPT_SUBJECT.CUSTOM}.`,
      "",
      "Halaman yang dibutuhkan:",
      "- [halaman pertama]",
      "- [halaman kedua]",
      "",
      "Pengunjung harus bisa: [apa yang bisa dilakukan pengunjung].",
      "",
      closing,
    ].join("\n");
  }

  return [
    `Buat ${PROMPT_SUBJECT[value]}.`,
    "",
    "Halaman dan fitur yang dibutuhkan:",
    ...getWebsiteType(value).requirements.map((r) => `- ${r}`),
    "",
    closing,
  ].join("\n");
}
