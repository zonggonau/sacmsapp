# 02 — Arsitektur Sistem

## 2.1 Diagram Utama

```
                              PENGGUNA (browser)
                                     |
                                     v
+========================================================================+
|                      SaCMS  -  Next.js 16 (App Router)                 |
|                              di Vercel                                 |
|                                                                        |
|  +--------------+---------------+--------------+-------------------+   |
|  |  (marketing) |     (auth)    |    (app)     |     (admin)       |   |
|  |  landing,    |  login,       |  dashboard,  |  panel owner      |   |
|  |  pricing     |  register     |  builder     |  sistem           |   |
|  +--------------+---------------+--------------+-------------------+   |
|           |             |              |                |              |
|           +-------------+------+-------+----------------+              |
|                                v                                       |
|                     +----------------------+                           |
|                     |   SERVER ACTIONS     |  <- satu-satunya pintu    |
|                     |  (next-safe-action)  |     mutasi data           |
|                     |  auth > rbac > quota |                           |
|                     |  > validate > audit  |                           |
|                     +----------+-----------+                           |
|                                v                                       |
|   +----------------------- SERVICE LAYER ----------------------------+ |
|   |  project.service   build.service   deploy.service                | |
|   |  quota.service     audit.service   user.service                  | |
|   +------+------------------+---------------------+------------------+ |
|          |                  |                     |                    |
|          v                  v                     v                    |
|   +------------+   +-----------------+   +------------------+          |
|   | lib/db     |   | lib/v0/client   |   | lib/vercel/client|          |
|   | (Prisma)   |   | (ACL ke v0)     |   | (ACL ke Vercel)  |          |
|   +-----+------+   +--------+--------+   +--------+---------+          |
+=========|===================|=====================|====================+
          |                   |                     |
          v                   v                     v
  +---------------+   +---------------+   +------------------+
  |  PostgreSQL   |   |  v0 Platform  |   |   Vercel API     |
  |  (Neon)       |   |  API          |   |  deploy, domain  |
  |               |   |  AI ENGINE    |   |                  |
  |  Upstash Redis|   +-------+-------+   +--------+---------+
  |  (rate limit) |           |                    |
  |  Vercel Blob  |           +--------+-----------+
  |  (aset)       |                    v
  +---------------+          +----------------------+
                             |  WEBSITE HASIL USER  |
                             |  xxx.vercel.app      |
                             |  / domain-user.com   |
                             +----------------------+
```

## 2.2 Lapisan & Tanggung Jawab

Aturan besi: **setiap lapisan hanya boleh memanggil lapisan di bawahnya.**

| Lapisan                      | Isi                                | Boleh memanggil                                 | DILARANG                                               |
| ---------------------------- | ---------------------------------- | ----------------------------------------------- | ------------------------------------------------------ |
| **1. UI (Server Component)** | `page.tsx`, `layout.tsx`           | Service layer (baca), `lib/db` untuk query baca | Memanggil v0/Vercel API langsung; melakukan mutasi     |
| **2. UI (Client Component)** | Form, chat, interaksi              | Server Action saja                              | `lib/db`, akses env rahasia                            |
| **3. Server Action**         | `actions/*.ts`                     | Service layer                                   | Query Prisma langsung untuk logika bisnis; fetch ke v0 |
| **4. Service**               | `services/*.ts`                    | `lib/db`, `lib/v0`, `lib/vercel`, service lain  | `revalidatePath`, `redirect`, membaca cookie           |
| **5. Integrasi (ACL)**       | `lib/v0`, `lib/vercel`, `lib/mail` | SDK vendor                                      | Menyentuh Prisma                                       |
| **6. Data**                  | `lib/db` (Prisma)                  | PostgreSQL                                      | Apa pun di atasnya                                     |

> **Anti-Corruption Layer.** Semua panggilan ke v0 dan Vercel dibungkus di `lib/v0/` dan
> `lib/vercel/`. Tidak ada import SDK v0 di luar folder itu. Alasannya: API pihak ketiga
> akan berubah; kita ingin dampaknya berhenti di satu folder.
>
> Dokumen ini menetapkan **bentuk integrasi**, bukan menjamin nama parameter vendor.
> Verifikasi signature terbaru di dokumentasi v0 sebelum implementasi Fase 3.

## 2.3 Alur Inti #1 — Buat Website Baru

```
User isi prompt + pilih tipe website
  |
  v
[Server Action] createProject
  |- 1. cek sesi                        -> gagal: redirect /login
  |- 2. cek role & status user          -> gagal: 403
  |- 3. cek kuota project & kredit AI   -> gagal: "kuota habis" + tombol upgrade
  |- 4. validasi input (Zod)            -> gagal: error per field
  |- 5. rate limit (Upstash)            -> gagal: "terlalu cepat, coba lagi"
  |- 6. DB transaction:
  |       Project(status=DRAFT)
  |     + BuildJob(status=QUEUED)
  |     + 10 BuildStep(status=PENDING)
  |     + UsageEvent(reservasi kredit)
  |     + AuditLog
  |- 7. after() -> jalankan pipeline di background
  +- 8. redirect ke /projects/{id}/builder
       |
       v
Halaman builder polling status job tiap 2 detik
  (Server Action getBuildStatus, atau SSE di /api/builds/[jobId]/stream)
       |
       v
Progres tampil: [v] Memahami kebutuhan  [v] Menyusun arsitektur  [*] Membuat halaman ...
       |
       v
Job READY -> preview URL muncul di iframe
```

Detail lengkap state machine: [09 — AI Builder Pipeline](./09-AI-BUILDER-PIPELINE.md).

## 2.4 Alur Inti #2 — Edit Setelah Live

```
User: "Tambahkan halaman transparansi anggaran"
  |
  v
[Server Action] sendBuilderMessage
  |- cek kepemilikan project + kuota generate
  |- simpan AiMessage(role=USER)
  |- lib/v0 -> kirim pesan ke chat v0 yang SAMA (v0ChatId tersimpan di Project)
  |- simpan AiMessage(role=ASSISTANT) + ProjectVersion baru
  +- revalidatePath('/projects/[projectId]/builder')
  |
  v
Preview diperbarui (versi baru, BELUM production)
  |
  v
User klik "Terbitkan Perubahan" -> [Server Action] deployProject
  |
  v
Deployment baru menggantikan production; URL tetap sama
```

> **Keputusan penting:** preview bukan production. Generate tidak pernah otomatis mengubah
> situs yang sudah hidup. User harus menekan "Terbitkan" secara sadar. Ini mencegah satu
> prompt buruk merusak situs resmi yang sedang dilihat publik.

## 2.5 Alur Inti #3 — Kontrol Super Admin

```
Super Admin -> /admin
  |- Ringkasan: user aktif, build hari ini, kredit terpakai, estimasi biaya
  |- User: cari, detail, ubah plan, reset kuota, suspend, impersonate
  |- Project: lihat SEMUA project lintas user, buka build log, hentikan build
  |- Build Jobs: antrean, yang gagal, retry manual
  |- Plan: ubah batas kuota tanpa deploy ulang
  |- Pengaturan Sistem: maintenance mode, KILL SWITCH generate global, model AI aktif
  +- Audit Log: append-only, tidak bisa dihapus dari UI
```

Detail: [10 — Super Admin](./10-SUPER-ADMIN.md).

## 2.6 Batas Kepercayaan (Trust Boundaries)

```
  TIDAK DIPERCAYA           |  DIPERCAYA (server)      |  RAHASIA
  --------------------------+--------------------------+---------------------
  Input browser             |  Server Action setelah   |  V0_API_KEY
  Parameter URL             |  auth + Zod + RBAC       |  VERCEL_TOKEN
  Prompt user               |  Service layer           |  DATABASE_URL
  Teks balasan AI           |  Prisma                  |  BETTER_AUTH_SECRET
  Webhook Vercel (sebelum   |                          |  RESEND_API_KEY
  verifikasi signature)     |                          |  UPSTASH_REDIS_TOKEN
```

Aturan yang mengikat:

- **Prompt user tidak pernah menjadi instruksi sistem.** Prompt selalu disisipkan ke slot
  data di dalam system prompt, dengan pembatas eksplisit. Lihat [09](./09-AI-BUILDER-PIPELINE.md).
- **Balasan AI tidak pernah masuk `dangerouslySetInnerHTML`.** Render sebagai Markdown
  tersanitasi (`rehype-sanitize`).
- **Preview hasil AI dijalankan di iframe dengan atribut `sandbox`** pada origin berbeda.
  Tidak pernah di-render inline ke dalam DOM SaCMS.
- **Setiap query yang menyentuh milik user WAJIB menyertakan `userId` di klausa `where`**,
  bukan dicek setelah data diambil.

## 2.7 Strategi Rendering

| Segmen                 | Strategi                                      | Alasan                              |
| ---------------------- | --------------------------------------------- | ----------------------------------- |
| `(marketing)`          | Dynamic (CSP nonce — ADR-009, diusulkan)      | Nonce wajib render per permintaan   |
| `(auth)`               | Dynamic                                       | Butuh CSRF & cookie                 |
| `(app)` daftar project | Dynamic + streaming (`Suspense`)              | Data per user, shell tampil duluan  |
| `(app)` builder        | Dynamic + Client Component untuk chat/preview | Sangat interaktif                   |
| `(admin)`              | Dynamic, tanpa cache                          | Data operasional harus selalu segar |
| Aset publik            | CDN Vercel                                    | —                                   |

## 2.8 Yang Terjadi Saat Gagal

| Skenario                     | Perilaku sistem                                                                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| v0 API timeout / 5xx         | Retry 3x backoff (2s, 8s, 20s) + jitter. Tetap gagal: job `FAILED`, kredit **dikembalikan**, user lihat "AI sedang sibuk, coba lagi" + tombol Ulangi |
| v0 API rate limit (429)      | Job kembali ke `QUEUED`, dijadwalkan ulang, tidak menghabiskan jatah percobaan                                                                       |
| Vercel deploy gagal          | Production **tidak berubah**; deployment ditandai `ERROR`, log tersimpan, user lihat ringkasan yang dapat dibaca                                     |
| Database down                | Halaman error global; tidak ada penulisan parsial karena semua mutasi multi-tabel dalam transaksi                                                    |
| Job nyangkut > 15 menit      | Cron penyapu menandai `FAILED`, mengembalikan kredit, menulis audit log                                                                              |
| Kredit habis di tengah jalan | Tidak mungkin — kredit direservasi di awal (langkah 6), bukan di akhir                                                                               |

## 2.9 Observability

| Kebutuhan                                  | Alat                                                | Wajib sejak |
| ------------------------------------------ | --------------------------------------------------- | ----------- |
| Error runtime                              | Sentry                                              | Fase 1      |
| Log terstruktur (JSON)                     | `lib/logger` ke Vercel Log Drain                    | Fase 0      |
| Metrik build (durasi, sukses/gagal, biaya) | Tabel `BuildJob` + `UsageEvent`, tampil di `/admin` | Fase 3      |
| Uptime situs hasil user                    | Cron ping + status di kartu project                 | Fase 7      |
| Jejak audit aksi                           | Tabel `AuditLog`                                    | Fase 1      |

Setiap build wajib membawa `correlationId` yang sama dari Server Action ke service, ke
panggilan v0, sampai deployment — supaya satu build bisa ditelusuri utuh di log.
