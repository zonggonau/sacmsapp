# 15 — Integrasi dengan SaCMS Developer (Data Plane)

> **Prasyarat:** dokumen ini hanya berlaku bila
> [ADR-015](./adr/ADR-015-backend-data-dari-sacms-developer.md) **disetujui**. Sebelum itu,
> jangan menulis satu baris pun dari isi dokumen ini — lihat aturan fase di
> [`CLAUDE.md`](../CLAUDE.md).

**Versi dokumen:** 0.1 — draf
**Tanggal:** 2026-09-16
**Lawan bicara:** `sacms-for-developer` di `https://developer.sacms.cloud` (VPS SaCMS `164.68.116.79`)
**Domain kita:** `https://sacms.cloud` (VPS SaCMS) — peta lengkap di §15.1b

> **Hosting diperbarui oleh [ADR-017](./adr/ADR-017-nocode-di-vps-sacms.md):** aplikasi kita berjalan di
> VPS SaCMS, bukan Vercel. PostgreSQL diakses lewat jaringan Docker (tanpa PgBouncer dan TLS lintas
> internet), cron dijalankan penjadwal di VPS, dan Vercel hanya untuk website hasil generate.
> **Kontrak sisi sana:** `sacms-for-developer/docs/16-Pemisahan-Platform-dan-Penghapusan-AI-Builder.md`

---

## 15.1 Ringkas dalam Satu Diagram

```
                         PENGGUNA (browser)
                                |
                                v
+=======================================================================+
|        SaCMS nocode  -  Next.js 16 (App Router)  di VPS SaCMS         |
|                                                                        |
|   (marketing) | (auth) | (app: builder) | (admin)                      |
|                          |                                             |
|                  SERVER ACTIONS  (next-safe-action)                    |
|                          |                                             |
|   +--------------------- SERVICE LAYER ------------------------------+ |
|   | project · build · deploy · quota · audit · SCHEMA (baru)         | |
|   +----+----------+------------+---------------+--------------------+ |
|        |          |            |               |                      |
|        v          v            v               v                      |
|   +--------+ +---------+ +------------+ +----------------+            |
|   | lib/db | | lib/v0  | | lib/vercel | | lib/sacms (BARU)|           |
|   +---+----+ +----+----+ +-----+------+ +--------+-------+            |
+=======|===========|============|=================|====================+
        |           |            |                 | HTTPS
        |           v            v                 |
        |    +-----------+  +----------+           |
        |    | v0 API    |  | Vercel   |           |
        |    | AI ENGINE |  | deploy   |           |
        |    +-----+-----+  +----+-----+           |
        |          +-------------+                 |
        |                  v                       |
        |        +----------------------+          |
        |        | WEBSITE HASIL USER   |<---------+  konten & aset
        |        | xxx.vercel.app       |             (REST/GraphQL + media)
        |        +----------------------+
        |
        |  jaringan Docker internal (tanpa PgBouncer)
        v
+=======================================================================+
|              VPS SACMS    -  sacms.cloud  (sacms-for-developer)        |
|                                                                        |
|  PostgreSQL 17                                                         |
|    ├── sacms          (database CMS milik developer platform)          |
|    └── sacms_nocode   (database KITA — 24 model Prisma, tidak berubah) |
|                                                                        |
|  SaCMS app (Next.js standalone, Docker, di belakang Caddy)             |
|    ├── /api/mcp                   44 tool — CRUD schema & konten       |
|    ├── /api/platform/tenants      provisioning M2M  (BARU, §15.4)      |
|    ├── /api/public/[tenant]/*     REST + GraphQL untuk website hasil   |
|    └── /api/tenant/[tenant]/media unggah & kelola aset                 |
|                                                                        |
|  Object storage S3-compatible     kunci ${tenantId}/media/...          |
+=======================================================================+
```

Perhatikan: **hanya `lib/sacms/` dan `lib/db` yang menyentuh VPS.** Aturan lapisan di
[02 §2.2](./02-ARSITEKTUR-SISTEM.md) tetap berlaku — `lib/sacms/` adalah Anti-Corruption
Layer baru, sederajat dengan `lib/v0/` dan `lib/vercel/`.

## 15.1b Peta Domain

| Domain                                    | Aplikasi         | Hosting   | Untuk                                                                            |
| ----------------------------------------- | ---------------- | --------- | -------------------------------------------------------------------------------- |
| `sacms.cloud`, `www.sacms.cloud`          | **SaCMS nocode** | VPS SaCMS | Pengguna awam: landing, daftar, builder, harga Standar/Pro/Business              |
| `developer.sacms.cloud`                   | **SaCMS**        | VPS SaCMS | Pintu utama developer, agensi, instansi: daftar, langganan Enterprise, dashboard |
| `cms.sacms.cloud`                         | SaCMS            | VPS SaCMS | Mengelola konten: entry, media, single type                                      |
| `admin.sacms.cloud`, `api.sacms.cloud`    | SaCMS            | VPS SaCMS | Tidak berubah                                                                    |
| `<slug>.sacms.cloud` (wildcard)           | SaCMS            | VPS SaCMS | Subdomain workspace — tidak berubah                                              |
| `cname.sacms.cloud`                       | SaCMS            | VPS SaCMS | Target CNAME custom domain tenant — **jangan dipindah**                          |
| `mail.sacms.cloud`, `license.sacms.cloud` | SaCMS            | —         | Pengirim email & server lisensi — tidak berubah                                  |

Aplikasi kita ada di **`sacms.cloud`**. Semua yang kita panggil dari SaCMS ada di
**`developer.sacms.cloud`** (MCP, provisioning, REST/GraphQL, media). Urutan pemindahan domain
dan langkah yang harus dilakukan pemilik ada di `../../RENCANA-PEMISAHAN-PLATFORM.md` §2b —
**rute apex baru boleh dialihkan ke aplikasi kita setelah `developer.sacms.cloud` terbukti berjalan.**

Di kode kita: `trustedOrigins` Better Auth sudah memuat `https://sacms.cloud` dan `www`;
`sacms.app` dipertahankan sampai domain lama dialihkan. Env production ada di
`/opt/sacms-nocode/.env` di VPS (ditulis CI dari secret), dan `NEXT_PUBLIC_APP_URL` juga harus
menjadi build-arg image — bukan berkas `.env.production` lokal yang masih berisi `sacms.app`.

## 15.2 Aturan Lapisan yang Bertambah

| Lapisan               | Boleh memanggil                                   | DILARANG                                   |
| --------------------- | ------------------------------------------------- | ------------------------------------------ |
| Service               | `lib/db`, `lib/v0`, `lib/vercel`, **`lib/sacms`** | —                                          |
| **`lib/sacms`** (ACL) | `fetch` ke `developer.sacms.cloud`, SDK MCP       | Menyentuh Prisma; `revalidatePath`; cookie |
| Server Action         | Service                                           | Memanggil `lib/sacms` langsung             |
| Server Component      | Service (baca)                                    | Memanggil `lib/sacms` langsung             |

Tambahkan ke [`CLAUDE.md`](../CLAUDE.md) daftar larangan: **hanya `lib/sacms/` yang boleh
memanggil `developer.sacms.cloud`. Tanpa pengecualian.**

## 15.3 Pembagian Dua Bidang Data

Ini aturan paling penting di dokumen ini. Salah menempatkan data = builder jadi lambat atau
data pengguna terkunci di tempat yang salah.

| Data                                                                          | Tinggal di            | Jalur                     | Frekuensi akses    |
| ----------------------------------------------------------------------------- | --------------------- | ------------------------- | ------------------ |
| `ContentType`, `SingleType`, `Component`                                      | developer platform    | **MCP**                   | Jarang, saat build |
| `ContentEntry` (isi konten website pengguna)                                  | developer platform    | MCP (tulis) / REST (baca) | Sedang             |
| Media / aset pengguna                                                         | S3 developer platform | media API                 | Sedang             |
| `User`, `Session`, `Account`                                                  | `sacms_nocode`        | Prisma                    | Tiap request       |
| `Project` (+ `sacmsTenantId`, `sacmsApiToken`), `ProjectVersion`, `AiMessage` | `sacms_nocode`        | Prisma                    | Tinggi             |
| `BuildJob`, `BuildStep`                                                       | `sacms_nocode`        | Prisma                    | **Tiap 2 detik**   |
| `Deployment`, `Domain`                                                        | `sacms_nocode`        | Prisma                    | Sedang             |
| `Plan`, `WebsiteSubscription`, `CreditLot`, `UsageEvent`                      | `sacms_nocode`        | Prisma                    | Tinggi             |
| `AuditLog`, `SystemSetting`, `Notification`                                   | `sacms_nocode`        | Prisma                    | Sedang             |

**Kenapa `BuildJob` tidak lewat MCP.** Halaman builder melakukan polling status tiap 2 detik
([02 §2.3](./02-ARSITEKTUR-SISTEM.md), [ADR-005](./adr/ADR-005-build-job-polling.md)).
Melewatkan itu ke MCP over HTTP berarti menambah satu lompatan jaringan di jalur terpanas
aplikasi, dan menabrak rate limit per-tenant milik MCP server. Skema Prisma kita **tidak
berubah sama sekali** — hanya tempat databasenya yang pindah.

**Akibat untuk rencana v2.0.** [13 §13.4](./13-ROADMAP-DAN-FASE.md) mencantumkan
"v2.0 — CMS SaCMS (content type builder, media library), MCP server, API publik".
Seluruh baris itu **dicoret**: kita tidak membangunnya, kita memakai punya
`sacms-for-developer`. Perbarui dokumen 13 saat ADR-015 disetujui.

## 15.4 Alur Buat Project — Tenant Otomatis Terbentuk

**Satu project = satu tenant.** Provisioning terjadi saat pengguna **membuat project**, bukan
saat mendaftar. Pengguna nocode tidak pernah punya akun di SaCMS dan tidak perlu tahu bahwa
tenant itu ada.

Tenant dibuat oleh **satu akun layanan berperan `super_admin`** milik pemilik sistem. Peran
itu dipilih karena `enforceUserPlanLimit` keluar lebih awal untuk `super_admin`, sehingga
batas jumlah workspace tidak berlaku sama sekali — tanpa itu, pendaftaran project akan
berhenti pada tenant ke-`max_workspaces`.

```
Pengguna isi prompt + pilih tipe website
  |
  v
[Server Action] createProject
  |- 1. cek sesi, role, status user
  |- 2. cek kuota project & kredit AI      <- batas jumlah website ditegakkan DI SINI
  |- 3. validasi Zod + rate limit
  |- 4. transaksi: Project(DRAFT) + BuildJob(QUEUED) + 10 BuildStep
  |                + UsageEvent(reservasi) + AuditLog
  |- 5. after():
  |       a. provisionTenant(project.id)
  |            |
  |            v
  |       POST https://developer.sacms.cloud/api/platform/tenants
  |         Authorization: Bearer $SACMS_PROVISION_KEY
  |         Idempotency-Key: nocode:<project.id>
  |         { externalRef, name, plan, websiteType, source: "nocode" }
  |            |
  |            |  di sisi SaCMS, semuanya di bawah AKUN LAYANAN super_admin:
  |            |    Tenant { source: "nocode", externalRef, ownerId: akunLayanan }
  |            |    TenantMember { userId: akunLayanan, role: "owner" }
  |            |    ApiToken (full-access)
  |            |    provisionTenant() -> starter kit sesuai websiteType
  |            v
  |       { tenantId, tenantSlug, apiToken, mcpUrl, apiBaseUrl }
  |            |
  |            v
  |       simpan ke Project: sacmsTenantId, sacmsTenantSlug, sacmsApiToken (TERENKRIPSI)
  |
  |       b. jalankan pipeline build
  |
  +- redirect ke /projects/{id}/builder
```

**Kolomnya ada di `Project`, bukan `User`.** Satu pengguna bisa punya banyak project, dan
tiap project punya tenant serta tokennya sendiri. Ini yang memberi isolasi bersih: content
type milik satu website tidak bisa bertabrakan dengan milik website lain, walaupun pemiliknya
sama.

Aturan yang mengikat:

1. **Provisioning masuk `after()`**, tidak ditunggu di dalam action. Pembuatan project tidak
   boleh gagal hanya karena VPS sedang lambat.
2. **Build menunggu tenant siap.** `BuildStep` pertama tidak boleh berjalan sebelum
   `sacmsTenantId` terisi — tanpa tenant, tidak ada tempat menaruh schema. Beri status
   `MENUNGGU_TENANT` pada langkah itu, bukan gagal.
3. **Idempoten.** `Idempotency-Key` = `nocode:<project.id>`. Retry mengembalikan tenant yang
   sama beserta tokennya.
4. **Ada jalur pemulihan.** Kalau provisioning gagal, project tetap ada dengan
   `sacmsTenantId = null`. Satu cron mencoba ulang; `/admin` punya tombol "Buat ulang tenant".
5. **`sacmsApiToken` terenkripsi at-rest**, tidak pernah dikirim ke klien, tidak pernah masuk
   log. SaCMS mengembalikan token plain **satu kali saja**.
6. **Pengguna tidak pernah melihat kata "tenant" atau "workspace".** Pesan error mengikuti
   aturan [`CLAUDE.md`](../CLAUDE.md): apa yang terjadi + apa yang bisa dilakukan.
   Buruk: `Provisioning failed 502`. Baik: "Ruang kerja website sedang disiapkan. Coba muat
   ulang dalam satu menit."

### Menghapus project harus menghapus tenantnya

Diputuskan pemilik: project dihapus di nocode → **tenant dihapus** di SaCMS. Bukan sekadar
dinonaktifkan. Tanpa itu, setiap percobaan yang dibuang pengguna meninggalkan tenant hidup
beserta seluruh content type dan medianya — dan dengan satu tenant per project, sampahnya
menumpuk secepat pengguna bereksperimen.

```
DELETE https://developer.sacms.cloud/api/platform/tenants/{externalRef}
  Authorization: Bearer $SACMS_PROVISION_KEY
```

Alamatnya memakai **`externalRef`, bukan `tenantId`** — disengaja, supaya kunci yang bocor
tidak bisa menghapus workspace pelanggan developer. Rinciannya di `docs/16` §5.9 sisi sana.

**Ada satu ketimpangan yang harus diputuskan.** `deleteProject` kita hari ini memanggil
`projectService.softDelete`, yang menulis `deletedAt` dan `status: "ARCHIVED"` — barisnya
tetap ada dan bisa dipulihkan. Kalau tindakan itu langsung menghapus tenant di SaCMS, sisi
kita bisa dibatalkan sementara sisi sana tidak: pengguna memulihkan project-nya dan mendapat
project tanpa schema, tanpa konten, tanpa media.

**Pemilik memilih tenggang waktu 30 hari (16 September 2026), dengan pemberitahuan.**
Hapus di UI tetap soft delete seperti
sekarang; satu cron menghapus tenant **30 hari** setelah `deletedAt`. Kedua sisi tetap bisa dipulihkan
selama 30 hari itu, lalu hilang bersama — jaring pengaman yang sudah dibangun tidak ikut
dibuang.

**Pengguna diberi tahu tanggal hilangnya permanen.** Pemberitahuan dikirim saat project
dihapus, dan diulang menjelang tenggang habis. Menghapus website orang tanpa peringatan adalah
hal yang hanya terasa salah setelah terjadi — halaman project yang terhapus menampilkan
tanggal itu, dan `Notification` dipakai untuk mengabarkannya.

Apa pun pilihannya, kegagalan penghapusan tenant **masuk antrean coba-ulang dan terlihat di
`/admin`** — tidak boleh diabaikan diam-diam. Kegagalan yang hening adalah cara tenant yatim
menumpuk tanpa ada yang tahu.

> **Prasyarat yang belum ada di sisi sana:** `POST /api/platform/tenants` belum dibangun.
> `POST /api/tenants` yang ada memakai `getServerSession` — tanpa sesi manusia, 401. MCP juga
> tidak bisa membuat tenant pertama karena tokennya sudah terikat ke satu tenant.
> Lihat `docs/16` §5.

## 15.5 Tingkat Paket — Enterprise Hanya Tautan ke SaCMS

Prinsip yang ditetapkan pemilik (16 September 2026):

| Paket                      | Ada di         | Hosting website | Storage & database konten |
| -------------------------- | -------------- | --------------- | ------------------------- |
| **Standar, Pro, Business** | **nocode**     | Vercel          | Shared, di SaCMS          |
| **Enterprise**             | **SaCMS saja** | Vercel          | Shared, kuota lebih besar |

Slug di tabel `plan`: `free`, `standar`, `pro`, `business`. Slug lama **`umkm` dan `pemda`
dihapus** — pelanggannya dipindahkan lebih dulu. `pro` dan `business` sudah ada; yang
ditambahkan hanya `standar`.

Aplikasi kita di VPS SaCMS (ADR-017); seluruh website hasil pengguna tetap terbit lewat
`v0.deployments.create` ([ADR-008](./adr/ADR-008-terbit-lewat-v0-deployments.md)), dan setiap
tenant yang kita buat selalu bertarget `shared_vercel`. Tidak ada percabangan target hosting
di `deploy.service`, dan tidak perlu kolom target hosting di `Project`.

### Enterprise di halaman harga

**Enterprise = diarahkan ke SaCMS, bukan dimigrasikan.** Diputuskan pemilik (16 September
2026). Paket Enterprise **boleh ditampilkan** di halaman harga kita, tetapi tombolnya adalah
tautan ke `https://developer.sacms.cloud` untuk mendaftar dan berlangganan **di sana**. Tidak
ada pembayaran Enterprise di nocode, dan tidak ada pemindahan project nocode ke Enterprise —
pelanggan Enterprise memulai sebagai pelanggan SaCMS.

Konsekuensinya, pekerjaan backup → restore → pengalihan kepemilikan tenant yang sebelumnya
direncanakan untuk jalur naik kelas **dibatalkan**. Di sisi kita yang dibangun hanya satu
tautan.

Tombolnya berupa tautan biasa ke `https://developer.sacms.cloud` — bukan server action, bukan
alur bayar. Kartunya ditandai jelas bahwa langganan dilakukan di SaCMS, supaya pengguna tidak
kaget berpindah situs.

### Catatan: berkas v0 bisa diambil lewat API

Dicek di tipe `v0-sdk@0.16.7` yang terpasang: `chats.getVersion()` mengembalikan
`files: { name, content }[]`, dan `chats.downloadVersion()` mengembalikan zip/tarball sebagai
`ArrayBuffer`. Karena Enterprise berupa pengalihan, kemampuan ini **tidak dipakai** rencana saat
ini — dicatat supaya tidak perlu diperiksa ulang bila kelak dibutuhkan.

## 15.6 Tool MCP yang Kita Pakai

Dari 44 tool yang tersedia, kita memakai subset ini. Sisanya (`deploy_to_vercel`,
`list_members`, webhook, dan seterusnya) **tidak dipakai** — deploy
tetap lewat `lib/vercel` dan `lib/v0` sesuai [ADR-008](./adr/ADR-008-terbit-lewat-v0-deployments.md).

| Keperluan                    | Tool MCP                                                                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Baca struktur yang ada       | `get_full_schema`, `list_field_types`                                                                                                  |
| Content Type                 | `create_content_type`, `update_content_type`, `delete_content_type`, `list_content_types`, `get_content_type`                          |
| Single Type                  | `create_single_type`, `update_single_type`, `update_single_type_content`, `delete_single_type`, `list_single_types`, `get_single_type` |
| Component                    | `create_component`, `update_component`, `delete_component`, `list_components`, `get_component`                                         |
| Isi konten                   | `create_content_entry`, `update_content_entry`, `delete_content_entry`, `query_content`, `get_content_entry`                           |
| Info API untuk website hasil | `get_api_info`, `inspect_api_capabilities`                                                                                             |

Bentuk klien:

```ts
// lib/sacms/mcp.ts — SATU-SATUNYA berkas yang boleh bicara MCP
export async function callTool<T>(
  tenantToken: string,
  tool: string,
  args: Record<string, unknown>,
): Promise<T>;
```

Aturan:

- Transport **Streamable HTTP** ke `https://developer.sacms.cloud/api/mcp`, header
  `Authorization: Bearer <sacmsApiToken>`.
- Setiap panggilan **wajib** menyertakan token milik **project** yang bersangkutan. Tidak
  ada token global untuk memanggil MCP — itu akan melubangi isolasi antar-website, bukan
  hanya antar-pengguna.
- Balasan divalidasi dengan Zod sebelum keluar dari `lib/sacms/`. Jangan pernah meneruskan
  objek mentah dari vendor ke service layer — aturan DTO di [`CLAUDE.md`](../CLAUDE.md).
- Kegagalan diterjemahkan ke `AppError` berbahasa Indonesia dengan kode, bukan dilempar mentah.

## 15.7 Konten & Aset untuk Website Hasil

Website hasil pengguna hidup di Vercel dan mengambil kontennya dari developer platform:

| Keperluan              | Endpoint                                                  |
| ---------------------- | --------------------------------------------------------- |
| Baca koleksi           | `GET /api/public/{tenantSlug}/content/{contentType}`      |
| Baca satu entri        | `GET /api/public/{tenantSlug}/content/{contentType}/{id}` |
| Single type            | `GET /api/public/{tenantSlug}/single/{singleType}`        |
| GraphQL                | `POST /api/public/{tenantSlug}/graphql`                   |
| Kontrak API per tenant | `GET /api/public/{tenantSlug}/openapi.json`               |
| Unggah aset            | `POST /api/tenant/{tenantSlug}/media/upload`              |
| Sajikan aset           | `GET /api/media/serve?...`                                |
| Transformasi gambar    | `GET /api/media/transform?...`                            |

Dua hal yang wajib diurus saat menyusun prompt v0:

1. **CSP `img-src` pada website hasil** harus mengizinkan alamat storage SaCMS. Kalau tidak,
   gambar pengguna diblokir browser dan kita baru tahu setelah situs live.
2. **Token baca** yang ditanam ke website hasil harus **read-only**, bukan token MCP.
   Developer platform membedakan `type: "read-only"` dan full-access di model `ApiToken` —
   pakai yang pertama.

## 15.8 Variabel Lingkungan

| Variabel                | Nasib       | Keterangan                                                                                                                                                                 |
| ----------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`          | **berubah** | `postgresql://nocode_app:…@postgres:5432/sacms_nocode` — jaringan Docker (ADR-017)                                                                                         |
| `DIRECT_URL`            | **berubah** | Sama; dipakai `prisma migrate deploy` di CI.                                                                                                                               |
| `SACMS_BASE_URL`        | **baru**    | `http://app:3000` — jaringan internal (ADR-017)                                                                                                                            |
| `SACMS_PROVISION_KEY`   | **baru**    | Kunci tingkat platform. **Hanya** dipakai `lib/sacms/provision.ts`.                                                                                                        |
| `SACMS_TOKEN_SECRET`    | **baru**    | Kunci enkripsi `sacmsApiToken` at-rest.                                                                                                                                    |
| `PLATFORM_SUMMARY_KEY`  | **baru**    | Kunci baca `/api/platform/ringkasan` untuk SaCMS — [ADR-016](./adr/ADR-016-satu-pintu-admin-di-sacms.md). Sama dengan `NOCODE_SUMMARY_KEY` di SaCMS. **Sudah dikerjakan.** |
| `BLOB_READ_WRITE_TOKEN` | **dibuang** | Opsional dan belum pernah dipakai — hapus dari `lib/env.ts` baris 50.                                                                                                      |
| `V0_API_KEY`, `V0_MOCK` | tetap       | v0 tetap mesin AI ([ADR-001](./adr/ADR-001-v0-sebagai-ai-engine.md)).                                                                                                      |
| `VERCEL_*`              | tetap       | Deploy website pengguna tidak berubah.                                                                                                                                     |
| `UPSTASH_REDIS_*`       | **berubah** | Shim REST ke Redis bersama di VPS (ADR-017)                                                                                                                                |
| Sembilan cron           | **berubah** | Penjadwal container di VPS memanggil `/api/cron/*` — `vercel.json` tidak dipakai                                                                                           |

> `SACMS_PROVISION_KEY` di sini dan `PLATFORM_PROVISION_KEY` di sisi SaCMS adalah **rahasia
> yang sama**, hanya beda nama variabel: kita yang mengirim, mereka yang memverifikasi.
> Rotasi harus dilakukan di kedua sisi dalam satu jendela waktu.

`NEXT_PUBLIC_*` ditanam saat build: di VPS nilainya diteruskan sebagai build-arg, bukan dibaca dari
`.env` saat runtime (ADR-017).

## 15.9 Mode Gagal dan Apa yang Harus Terjadi

Ini yang membedakan integrasi yang siap produksi dari yang hanya jalan saat semuanya sehat.

| Yang gagal                            | Dampak                              | Perilaku yang diharuskan                                                                   |
| ------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------ |
| `POST /api/platform/tenants`          | Project baru tanpa tenant           | `Project.sacmsTenantId = null`; `BuildStep` pertama menunggu, tidak gagal; cron coba ulang |
| Penghapusan tenant saat hapus project | Tenant yatim di SaCMS               | Masuk antrean coba-ulang + terlihat di `/admin`. **Jangan diabaikan diam-diam**            |
| MCP timeout saat build                | Schema tidak terbentuk              | `BuildStep` gagal dengan pesan Indonesia + tombol "Coba lagi"; kredit **dikembalikan**     |
| MCP kena rate limit (429)             | Build lambat                        | Backoff eksponensial di `lib/sacms`, maksimum 3 kali; setelah itu gagal terkendali         |
| PostgreSQL VPS tidak terjangkau       | Seluruh aplikasi mati               | Halaman pemeliharaan; **jangan** tampilkan stack trace; alarm ke pemilik                   |
| Storage SaCMS mati                    | Gambar hilang di website pengguna   | Website tetap tayang; sediakan placeholder, jangan halaman rusak                           |
| `sacmsApiToken` dicabut/kedaluwarsa   | Semua operasi schema pengguna gagal | Deteksi 401 dari MCP → minta token baru lewat endpoint provisioning (idempoten)            |

Setiap baris di atas butuh uji sungguhan, bukan hanya penanganan di kode. Masukkan ke
runbook `/admin/insiden` yang sudah ada ([12 §12.7](./12-KEAMANAN.md)).

## 15.10 Fase 8 — Definition of Done

Pekerjaan ini menjadi **Fase 8**, dibuka **setelah Fase 7 selesai penuh**
([13](./13-ROADMAP-DAN-FASE.md)). Jangan menyerobot: Fase 7 masih menyisakan Lighthouse LCP
ponsel, checklist keamanan, pemulihan database, dan lima penguji beta.

- [ ] `POST /api/platform/tenants` ada di sisi developer platform dan terbukti idempoten
      (dipanggil dua kali → satu tenant).
- [ ] Buat project baru → tenant terbentuk otomatis → `sacmsApiToken` tersimpan terenkripsi
      **di baris `Project`**, bukan di `User`.
- [ ] Dua project milik satu pengguna mendapat **dua tenant berbeda**, dan content type yang
      bernama sama di keduanya tidak saling mengganggu.
- [ ] Tenant terbentuk di bawah akun layanan `super_admin` milik pemilik sistem, dan pengguna
      nocode **tidak** punya akun di sana.
- [ ] Membuat project jauh melampaui `max_workspaces` akun layanan tetap berhasil.
- [ ] Batas jumlah website ditegakkan oleh `quota.service` di sini, bukan oleh pesan error
      batas workspace dari SaCMS.
- [ ] `BuildStep` pertama menunggu `sacmsTenantId` terisi, dan tidak gagal saat provisioning
      masih berjalan.
- [ ] **Hapus project → tenant pasangannya dihapus** beserta content type, konten, dan
      **objek storage-nya**. Diuji sungguhan; tidak ada yang tertinggal di bucket.
- [ ] Penghapusan gagal → masuk antrean coba-ulang dan terlihat di `/admin`, bukan hening.
- [ ] Project yang dipulihkan dalam masa tenggang masih punya tenant yang hidup.
- [ ] Project yang dihapus dan **tidak** dipulihkan dalam 30 hari: tenantnya hilang, dan
      objek storage-nya benar-benar lenyap dari bucket.
- [ ] Pengguna menerima pemberitahuan berisi **tanggal** websitenya hilang permanen, dan
      tanggal itu juga terlihat di halaman project yang terhapus.
- [ ] Paket `umkm` dan `pemda` sudah tidak ada; pelanggannya sudah dipindahkan.
- [ ] Seluruh project terbit ke Vercel; tidak ada percabangan target hosting di `deploy.service`.
- [ ] `lib/sacms/` adalah **satu-satunya** yang memanggil `developer.sacms.cloud` —
      `grep -rn "developer.sacms.cloud" src/ --include=*.ts | grep -v "lib/sacms"` kosong.
- [ ] Buat project → `create_content_type` lewat MCP berhasil → terlihat di dashboard CMS
      developer platform.
- [ ] Website hasil membaca kontennya dari `/api/public/{tenant}/content/*` dan tayang.
- [ ] Unggah gambar di builder → tersimpan di storage SaCMS → tampil di website hasil dengan
      CSP yang benar.
- [ ] Database pindah dari Neon ke `sacms_nocode`; `prisma migrate deploy` jalan di CI; aplikasi
      terhubung lewat jaringan Docker.
- [ ] **Pemulihan `pg_dump` `sacms_nocode` diuji sungguhan minimal sekali.**
- [ ] Sembilan cron berjalan dari penjadwal di VPS — dibuktikan lewat log, bukan diasumsikan.
- [ ] Enam mode gagal di §15.9 diuji satu per satu, bukan hanya ditangani di kode.
- [ ] Aplikasi kita hanya bisa dicapai lewat Caddy (`127.0.0.1:3001`), tidak lewat port publik.
- [ ] Dokumen 02, 03, 13, 14 dan `CLAUDE.md` diperbarui di PR yang sama.

## 15.11 Yang Belum Dijawab Dokumen Ini

Sudah diputuskan pemilik (16 September 2026): satu project = satu tenant, dibuat akun layanan
`super_admin`; tenant dihapus **30 hari** setelah project di-soft-delete **dengan
pemberitahuan tanggal** ke pengguna; **tidak ada paket Enterprise di nocode** — seluruh
website hasil tetap di Vercel (aplikasi kita di VPS SaCMS, ADR-017); tombol Enterprise hanya **tautan ke `developer.sacms.cloud`**.
Paket: `free`, `standar`, `pro`, `business`; `umkm` dan `pemda` **dihapus**. Domain kita
`sacms.cloud`, SaCMS di `developer.sacms.cloud` (§15.1b).

Yang masih terbuka:

1. **Alamat email kita masih `@sacms.id`** (`EMAIL_FROM` bawaan, `dukungan@sacms.id` di halaman
   akun ditangguhkan). Pindah ke `sacms.cloud` butuh domain pengirim terverifikasi di Resend dan
   kotak surat yang benar-benar ada — sengaja belum diubah.
2. **Versi kontrak MCP.** Server sekarang `sacms-mcp v2.2.0`. Belum ada kesepakatan apa yang
   terjadi kalau versinya naik dan sebuah tool berubah bentuk.
3. **Kapasitas VPS SaCMS** untuk dua aplikasi, database, dan trafik API website hasil generate —
   belum diukur (ADR-017).
