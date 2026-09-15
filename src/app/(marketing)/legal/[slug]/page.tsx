import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * Syarat Layanan & Kebijakan Privasi — docs/12 §12.6, docs/14 §14.9.
 *
 * VERSI AWAL. Isinya disusun dari keputusan di dokumen perancangan (retensi,
 * vendor pihak ketiga, hak pengguna) dan WAJIB ditinjau penasihat hukum sebelum
 * go-live. Konten statis di sini supaya perubahannya tercatat di riwayat git.
 */

interface Section {
  heading: string;
  paragraphs: string[];
}

interface LegalDoc {
  title: string;
  description: string;
  updated: string;
  sections: Section[];
}

const DOCS: Record<string, LegalDoc> = {
  syarat: {
    title: "Syarat Layanan",
    description: "Ketentuan penggunaan layanan SaCMS.",
    updated: "15 September 2026",
    sections: [
      {
        heading: "1. Tentang layanan",
        paragraphs: [
          "SaCMS adalah layanan pembuatan website berbantuan kecerdasan buatan (AI). Anda menuliskan kebutuhan website dalam bahasa Indonesia, lalu SaCMS membuat, menampilkan pratinjau, dan menerbitkan website tersebut ke internet.",
          "Dengan mendaftar dan memakai SaCMS, Anda menyetujui syarat ini. Bila tidak setuju, mohon tidak memakai layanan.",
        ],
      },
      {
        heading: "2. Akun",
        paragraphs: [
          "Anda wajib memberikan alamat email yang benar dan menjaga kerahasiaan kata sandi. Semua aktivitas di akun Anda menjadi tanggung jawab Anda.",
          "Kami dapat menangguhkan akun yang melanggar syarat ini, misalnya untuk penyalahgunaan, penipuan, atau konten yang melanggar hukum. Alasan penangguhan disampaikan melalui email.",
        ],
      },
      {
        heading: "3. Pemakaian AI dan layanan pihak ketiga",
        paragraphs: [
          "Website dibuat menggunakan layanan AI pihak ketiga (v0 dari Vercel) dan diterbitkan pada infrastruktur hosting Vercel. Permintaan yang Anda tulis dikirim ke layanan tersebut untuk diproses.",
          "Hasil AI dapat mengandung kekeliruan. Anda bertanggung jawab memeriksa isi website — terutama informasi resmi, harga, dan data kontak — sebelum dan sesudah diterbitkan.",
        ],
      },
      {
        heading: "4. Konten Anda",
        paragraphs: [
          "Anda tetap memiliki hak atas isi yang Anda berikan. Anda memberi kami izin memproses isi tersebut sebatas yang diperlukan untuk menjalankan layanan.",
          "Anda dilarang membuat website yang melanggar hukum Republik Indonesia, melanggar hak kekayaan intelektual pihak lain, berisi penipuan, perjudian, pornografi, ujaran kebencian, atau perangkat lunak berbahaya.",
        ],
      },
      {
        heading: "5. Kredit, paket, dan pembayaran",
        paragraphs: [
          "Setiap paket memiliki batas kredit, jumlah website, penerbitan harian, dan custom domain sebagaimana tercantum di halaman Harga. Kredit terisi kembali setiap 30 hari sejak awal periode Anda dan tidak menumpuk.",
          "Kredit dipotong saat pembuatan atau perubahan website dimulai dan dikembalikan otomatis bila proses gagal atau dibatalkan. Peningkatan paket saat ini diproses oleh tim SaCMS setelah pembayaran diterima.",
        ],
      },
      {
        heading: "6. Ketersediaan layanan",
        paragraphs: [
          "Kami berupaya menjaga layanan tetap tersedia, namun tidak menjamin layanan bebas gangguan. Kami dapat menghentikan sementara pembuatan website untuk pemeliharaan atau untuk melindungi sistem. Website yang sudah terbit tetap dapat diakses selama pemeliharaan tersebut.",
        ],
      },
      {
        heading: "7. Batas tanggung jawab",
        paragraphs: [
          "Sepanjang diizinkan hukum, SaCMS tidak bertanggung jawab atas kerugian tidak langsung yang timbul dari pemakaian layanan atau dari isi website yang dihasilkan AI.",
        ],
      },
      {
        heading: "8. Perubahan syarat",
        paragraphs: [
          "Kami dapat memperbarui syarat ini. Perubahan penting diberitahukan melalui email atau pemberitahuan di aplikasi sebelum berlaku.",
        ],
      },
    ],
  },
  privasi: {
    title: "Kebijakan Privasi",
    description: "Bagaimana SaCMS mengumpulkan, memakai, dan melindungi data Anda.",
    updated: "15 September 2026",
    sections: [
      {
        heading: "1. Data yang kami kumpulkan",
        paragraphs: [
          "Data akun: nama, alamat email, dan kata sandi (disimpan dalam bentuk hash, tidak pernah dalam bentuk asli).",
          "Data pemakaian: permintaan (prompt) yang Anda tulis, riwayat versi website, catatan pemakaian kredit, serta alamat IP dan jenis peramban untuk keamanan.",
        ],
      },
      {
        heading: "2. Untuk apa data dipakai",
        paragraphs: [
          "Menjalankan layanan: membuat dan menerbitkan website, menghitung kuota, dan mengirim email penting seperti verifikasi akun dan pemberitahuan website siap.",
          "Menjaga keamanan: mencegah penyalahgunaan, menyelidiki insiden, dan memenuhi kewajiban hukum. Kami tidak menjual data Anda.",
        ],
      },
      {
        heading: "3. Pihak ketiga yang memproses data",
        paragraphs: [
          "Vercel (layanan AI v0 dan hosting website), penyedia database, penyedia email transaksional, dan layanan pemantauan kesalahan. Permintaan (prompt) Anda dikirim ke layanan AI v0 untuk membuat website. Data hanya dibagikan sebatas yang diperlukan untuk fungsi tersebut.",
        ],
      },
      {
        heading: "4. Lama penyimpanan",
        paragraphs: [
          "Akun: sampai Anda menghapusnya, ditambah 30 hari sebelum dihapus permanen.",
          "Prompt dan pesan AI: selama project masih ada; ikut terhapus bersama project.",
          "Catatan pemakaian: 24 bulan untuk keperluan pembukuan. Catatan audit keamanan: minimal 12 bulan. Alamat IP: 90 hari. Log aplikasi: 30 hari dan tidak memuat email, prompt, atau token.",
        ],
      },
      {
        heading: "5. Hak Anda",
        paragraphs: [
          "Sesuai Undang-Undang Pelindungan Data Pribadi, Anda berhak mengakses, memperbaiki, dan meminta penghapusan data pribadi Anda. Menghapus akun akan menghapus project Anda; catatan yang wajib disimpan untuk keperluan hukum dan pembukuan dianonimkan.",
        ],
      },
      {
        heading: "6. Keamanan",
        paragraphs: [
          "Koneksi dilindungi HTTPS, akses dibatasi sesuai peran, dan setiap tindakan administratif tercatat. Tidak ada sistem yang sepenuhnya bebas risiko; bila terjadi insiden yang berdampak pada data Anda, kami akan memberi tahu Anda.",
        ],
      },
      {
        heading: "7. Perubahan kebijakan",
        paragraphs: [
          "Kebijakan ini dapat diperbarui. Tanggal pembaruan terakhir tercantum di bagian atas halaman.",
        ],
      },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(DOCS).map((slug) => ({ slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const doc = DOCS[(await params).slug];
  return doc ? { title: doc.title, description: doc.description } : {};
}

export default async function LegalPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const doc = DOCS[(await params).slug];
  if (!doc) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{doc.title}</h1>
      <p className="text-muted-foreground mt-2 text-sm">
        Terakhir diperbarui {doc.updated}
      </p>

      <div className="mt-10 space-y-8">
        {doc.sections.map((section) => (
          <section key={section.heading} className="space-y-3">
            <h2 className="text-xl font-semibold">{section.heading}</h2>
            {section.paragraphs.map((p) => (
              <p key={p} className="text-muted-foreground leading-relaxed">
                {p}
              </p>
            ))}
          </section>
        ))}
      </div>
    </article>
  );
}
