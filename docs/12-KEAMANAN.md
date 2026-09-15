# 12 — Keamanan

## 12.1 Ancaman Utama & Mitigasi

| #   | Ancaman                                                        | Dampak bila terjadi                              | Mitigasi                                                                                                      |
| --- | -------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| A1  | Pengguna membaca/mengubah project milik orang lain             | Kebocoran data pelanggan                         | `userId` ada di setiap klausa `where` ([06 §6.7](./06-DATABASE-SCHEMA.md)); uji E2E khusus                    |
| A2  | Naik peran jadi `SUPER_ADMIN` lewat pendaftaran                | Sistem diambil alih                              | `input: false` pada `role`/`status`/`planId` ([07 §7.2](./07-AUTH-DAN-RBAC.md))                               |
| A3  | Prompt injection lewat prompt pengguna                         | AI mengabaikan aturan, membocorkan system prompt | Pembatas + label data + sanitasi ([09 §9.5](./09-AI-BUILDER-PIPELINE.md))                                     |
| A4  | Penyalahgunaan kredit / serangan biaya                         | Tagihan AI membengkak                            | Rate limit + kuota reservasi + ambang biaya + kill switch otomatis                                            |
| A5  | Kunci API bocor ke klien                                       | Siapa pun bisa memakai akun v0 kita              | Rahasia hanya di server; lint melarang `NEXT_PUBLIC_` pada nama berpola rahasia                               |
| A6  | XSS lewat keluaran AI atau nama project                        | Pengambilalihan sesi                             | Tidak ada `dangerouslySetInnerHTML`; Markdown disanitasi; pratinjau di iframe `sandbox`                       |
| A7  | Webhook palsu dari "Vercel"                                    | Status deployment dipalsukan                     | Verifikasi signature, gagal tertutup tanpa secret; payload hanya pemicu — status dibaca ulang dari API Vercel |
| A8  | Pengambilalihan subdomain (domain dilepas tapi DNS tertinggal) | Situs pengguna dibajak                           | Verifikasi kepemilikan (TXT) sebelum aktivasi; lepas dari Vercel dulu, catatan baru dihapus bila berhasil     |
| A9  | Enumerasi email di halaman masuk                               | Daftar pelanggan bocor                           | Pesan gagal seragam ([07 §7.5](./07-AUTH-DAN-RBAC.md))                                                        |
| A10 | Penyalahgunaan impersonasi                                     | Perubahan data atas nama pengguna                | Aksi destruktif diblokir; banner permanen; audit mulai & selesai; kedaluwarsa 60 menit                        |
| A11 | SSRF lewat URL yang diberikan pengguna                         | Akses ke jaringan internal                       | Tidak ada fitur yang mengambil URL sembarang di MVP; bila ditambahkan, wajib allowlist                        |
| A12 | Kondisi balapan pada kuota                                     | Batas terlampaui                                 | Penguncian baris di dalam transaksi ([11 §11.4](./11-QUOTA-DAN-BILLING.md))                                   |

## 12.2 Pengelolaan Rahasia

```
# Server saja - TIDAK PERNAH diawali NEXT_PUBLIC_
DATABASE_URL=
BETTER_AUTH_SECRET=          # openssl rand -base64 32
V0_API_KEY=
VERCEL_TOKEN=
VERCEL_TEAM_ID=
GOOGLE_CLIENT_SECRET=
RESEND_API_KEY=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
SENTRY_AUTH_TOKEN=

# Boleh terlihat browser
NEXT_PUBLIC_APP_URL=
NEXT_PUBLIC_SENTRY_DSN=
```

Aturan:

1. `.env*` masuk `.gitignore`. Hanya `.env.example` yang di-commit, **berisi nama saja,
   tanpa nilai**.
2. Environment variable divalidasi saat _startup_ dengan Zod (`src/lib/env.ts`).
   Variabel yang hilang membuat aplikasi **gagal start**, bukan gagal diam-diam di
   tengah jalan saat ada pengguna.
3. Rahasia production berbeda dari staging. Tidak ada berbagi.
4. Rotasi kunci setiap 90 hari, dan **segera** bila ada yang meninggalkan tim.
5. Scan rahasia di pre-commit (`gitleaks`) dan di CI.

```ts
// src/lib/env.ts
import { z } from "zod";

const server = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  V0_API_KEY: z.string().min(1),
  VERCEL_TOKEN: z.string().min(1),
  RESEND_API_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "test", "production"]),
});

export const env = server.parse(process.env); // gagal keras saat start
```

## 12.3 Header Keamanan

```ts
// next.config.ts
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];
```

CSP dipasang di **Fase 7** memakai nonce, setelah seluruh sumber skrip diketahui.
Menambahkannya terlalu awal menyebabkan tim terbiasa melonggarkannya setiap kali ada
yang rusak — dan pada akhirnya CSP-nya tidak berarti apa-apa.

CSP dibuat di `src/proxy.ts` (bukan `next.config.ts`) karena nonce harus baru di setiap
permintaan. Layout akar membaca `x-nonce` dan meneruskannya ke skrip tema; akibatnya
**seluruh halaman dirender dinamis** — harga yang pantas untuk nonce yang bermakna.

| Direktif          | Nilai                                                         | Alasan                                                               |
| ----------------- | ------------------------------------------------------------- | -------------------------------------------------------------------- |
| `script-src`      | `'self' 'nonce-…' 'strict-dynamic'` (+`'unsafe-eval'` di dev) | Hanya skrip ber-nonce dan yang dimuatnya                             |
| `style-src`       | `'self' 'unsafe-inline'`                                      | Atribut `style` hasil SSR tidak bisa diberi nonce; skrip tetap ketat |
| `img-src`         | `'self' data: blob: https:`                                   | Avatar Google, gambar situs pengguna                                 |
| `connect-src`     | `'self'` + origin Sentry dari `NEXT_PUBLIC_SENTRY_DSN`        | Server Action & pelaporan error                                      |
| `frame-src`       | `https://*.vusercontent.net https://*.vercel.app` (+`data:`)  | Pratinjau v0 & situs terbit; `data:` hanya saat `V0_MOCK`            |
| `frame-ancestors` | `'none'`                                                      | SaCMS tidak boleh dibingkai situs lain                               |
| lainnya           | `object-src 'none'; base-uri 'self'; form-action 'self'`      | Tutup vektor injeksi klasik                                          |

`upgrade-insecure-requests` hanya dipasang bila `NEXT_PUBLIC_APP_URL` memakai https.
Setiap uji E2E gagal bila konsol peramban mencatat pelanggaran CSP — sumber baru wajib
ditambahkan ke tabel ini di PR yang sama.

`X-Frame-Options: DENY` tetap berlaku untuk halaman SaCMS. Pratinjau di dalam iframe
memuat domain milik v0/pengguna, bukan halaman SaCMS, sehingga tidak terpengaruh.

## 12.4 Aturan Penanganan Input

| Input            | Perlakuan                                                                                                             |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| Semua input form | Divalidasi Zod di server, **bukan hanya** di klien                                                                    |
| Prompt pengguna  | Batas 4.000 karakter, karakter kontrol dibuang, disimpan apa adanya, diapit pembatas saat dikirim ke AI               |
| Nama project     | Batas 100 karakter, slug dibuat dari nama (`a-z0-9-`), tidak pernah dipakai sebagai jalur berkas                      |
| Domain           | Dirapikan (skema/jalur dibuang), wajib nama host sah, tolak `*.vercel.app` & domain SaCMS, tolak yang sudah terdaftar |
| Unggahan berkas  | Hanya gambar, maks 5 MB, tipe MIME diperiksa dari **isi berkas** bukan ekstensi                                       |
| Parameter URL    | Divalidasi lewat parser `nuqs`, tidak pernah masuk query mentah                                                       |
| Keluaran AI      | Diperlakukan sebagai konten tidak dipercaya; Markdown disanitasi                                                      |

## 12.5 Keamanan Pratinjau

Pratinjau menampilkan kode yang dihasilkan AI. Ia harus diperlakukan sebagai **situs
asing**:

```tsx
<iframe
  src={previewUrl} // origin berbeda: *.vercel.app
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
  referrerPolicy="no-referrer"
  className="h-full w-full border-0"
  title="Pratinjau website"
/>
```

- Tidak pernah dirender inline ke dalam DOM SaCMS.
- Tidak pernah diberi akses ke cookie SaCMS (origin berbeda menjaminnya).
- Tidak ada `postMessage` dari pratinjau yang dipercaya tanpa memeriksa `event.origin`.

## 12.6 Privasi Data

| Data              | Retensi                  | Catatan                                             |
| ----------------- | ------------------------ | --------------------------------------------------- |
| Akun pengguna     | Sampai dihapus + 30 hari | Soft delete dulu, lalu hard delete                  |
| Prompt & pesan AI | Selama project ada       | Ikut terhapus bersama project                       |
| Audit log         | 12 bulan minimum         | Tetap ada meski pengguna dihapus (`actorId` → null) |
| Usage event       | 24 bulan                 | Dibutuhkan untuk pembukuan                          |
| Log aplikasi      | 30 hari                  | **Tidak boleh** memuat email, prompt, atau token    |
| Alamat IP         | 90 hari                  | Untuk penyelidikan penyalahgunaan                   |

Permintaan hapus akun (dan kepatuhan UU PDP Indonesia): satu tindakan dari
`/akun/keamanan` → hapus project, cabut sesi, anonimkan catatan yang harus dipertahankan.

Aturan log: `lib/logger` memiliki daftar kunci yang disamarkan (`password`, `token`,
`secret`, `apiKey`, `email`, `prompt`). Penyamaran ada di logger, bukan bergantung pada
setiap pemanggil mengingatnya.

## 12.7 Kesiapan Insiden

| Skenario                        | Tindakan pertama                                                                                     |
| ------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Kunci v0 bocor                  | Cabut di dasbor v0 → terbitkan kunci baru → perbarui env → redeploy                                  |
| Kredit terkuras tak wajar       | Nyalakan kill switch → periksa `/admin/build` → tangguhkan akun pelaku                               |
| Akun Super Admin disusupi       | Cabut semua sesi (hapus baris `Session`) → ganti sandi → periksa audit log                           |
| Kebocoran data                  | Nyalakan maintenance mode → pertahankan log → tentukan cakupan dari audit → beri tahu yang terdampak |
| Hasil AI merusak situs pengguna | Rollback deployment (production sebelumnya masih ada)                                                |

Setiap kendali di atas **harus bisa dijalankan dari `/admin`** tanpa akses terminal.
Panel yang tidak bisa dipakai saat krisis adalah panel yang gagal.

## 12.8 Checklist Sebelum Go-Live

- [ ] Semua rahasia di Vercel, tidak ada satu pun di repositori
- [ ] `gitleaks` bersih pada seluruh riwayat git
- [ ] `env.ts` memvalidasi setiap variabel wajib
- [ ] Header keamanan aktif dan terverifikasi
- [ ] Rate limit aktif di semua jalur autentikasi dan AI
- [ ] Checklist uji akses [07 §7.8](./07-AUTH-DAN-RBAC.md) **lulus seluruhnya**
- [ ] Tidak ada `console.log` yang tersisa di kode production
- [ ] Sentry aktif, sampel error terkirim, data sensitif tersamarkan
- [ ] Pencadangan database aktif (Neon PITR) dan **pemulihan sudah diuji sekali**
- [ ] `CRON_SECRET` memproteksi seluruh endpoint cron
- [ ] Webhook Vercel memverifikasi signature
- [ ] Kill switch diuji: menyala → generate ditolak dengan pesan sopan
- [ ] Impersonasi diuji: banner tampil, aksi destruktif diblokir, audit tercatat
- [ ] `npm audit` / `pnpm audit` tanpa kerentanan tinggi
- [ ] Halaman Syarat Layanan & Kebijakan Privasi terbit
