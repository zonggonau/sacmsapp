# ADR-015 — SaCMS Developer sebagai Backend Data; Aplikasi nocode Tetap di Vercel

**Status:** Diusulkan — menunggu persetujuan pemilik sistem
**Tanggal:** 2026-09-16
**Menggantikan sebagian:** [ADR-014](./ADR-014-sacms-di-vps-sendiri-dan-paket-enterprise.md) —
aplikasi SaCMS nocode **tidak jadi** pindah ke VPS (hanya database dan storage yang pindah), dan
tahap 5–6-nya (`lib/github` + `lib/vps`) **tidak jadi dibangun** karena nocode tidak punya
paket Enterprise sama sekali — Enterprise hanya ada di `sacms-for-developer`.
**Mengubah:** [ADR-003](./ADR-003-postgres-prisma.md) (database di Neon),
[02 §2.1](../02-ARSITEKTUR-SISTEM.md) (diagram utama),
[14 §14.1](../14-DEPLOYMENT-GO-LIVE.md) (lingkungan)
**Tidak mengubah:** [ADR-001](./ADR-001-v0-sebagai-ai-engine.md) (v0 tetap mesin AI),
[ADR-004](./ADR-004-server-actions-first.md), [ADR-007](./ADR-007-prisma-driver-adapter.md),
[ADR-008](./ADR-008-terbit-lewat-v0-deployments.md)
**Terkait:** `sacms-for-developer/docs/16-Pemisahan-Platform-dan-Penghapusan-AI-Builder.md`

> **Diperbarui oleh [ADR-017](./ADR-017-nocode-di-vps-sacms.md) (2026-09-17):** keputusan 1 dibatalkan —
> aplikasi nocode berjalan di **VPS SaCMS**, bukan Vercel. Bagian yang menyebut PgBouncer, TLS
> database lewat internet, cron di `vercel.json`, dan latensi Vercel → VPS tidak berlaku lagi.
> Keputusan 2–7 tetap berlaku. Vercel hanya dipakai untuk website hasil generate.

## Konteks

Di dalam `sacms-project` ada dua produk yang selama ini tumbuh sendiri-sendiri:

| Repositori              | Untuk siapa                                   | Hari ini                                                            |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------------- |
| `sacms-for-developer`   | Developer, agensi, instansi yang menulis kode | Multi-tenant headless CMS di VPS SaCMS, **plus AI website builder** |
| `sacms-for-user-nocode` | Pengguna awam: ketik prompt, website jadi     | AI website builder di Vercel + Neon                                 |

Keduanya punya AI website builder. Itu duplikasi: dua pipeline v0, dua dompet kredit, dua
tempat memanggil Vercel. Pemilik sistem memutuskan AI website builder hanya ada di satu
tempat — **di sini**, di produk nocode — dan dihapus dari `sacms-for-developer`.

Konsekuensinya untuk kita: `sacms-for-developer` berhenti menjadi pesaing dan menjadi
**backend** kita. Ia sudah punya yang kita butuhkan dan tidak punya:

- Multi-tenant CMS dengan Content Type, Single Type, Component, Content Entry, Media.
- **MCP server dengan 44 tool** di `/api/mcp`, termasuk CRUD penuh schema dan konten.
- Object storage S3-compatible per-tenant (`${tenantId}/media/...`).
- REST + GraphQL publik per-tenant, lengkap dengan `openapi.json` per tenant.
- PostgreSQL 17 di VPS SaCMS yang sudah berjalan.

ADR-014 mengusulkan kita memindahkan **aplikasi** ke VPS juga. Usulan itu sekarang
dibatalkan sebagian: memindahkan aplikasi ke VPS berarti kita mengurus ops untuk aplikasi
yang sebenarnya cocok di serverless, sementara beban ops yang sama sudah ditanggung oleh
`sacms-for-developer`. Kita menumpang, bukan membangun VPS kedua.

## Keputusan (diusulkan)

### 1. ~~Aplikasi SaCMS nocode tetap di Vercel~~ — digantikan ADR-017

Aplikasi nocode berjalan di VPS SaCMS bersama SaCMS Developer. Desain deployment, variabel
lingkungan, cron, dan urutan kerjanya ada di [ADR-017](./ADR-017-nocode-di-vps-sacms.md).

### 2. Database pindah dari Neon ke PostgreSQL di VPS SaCMS

Skema Prisma kita **tidak berubah** — 24 model tetap milik kita. Yang berubah hanya tempatnya:
database `sacms_nocode` di server PostgreSQL 17 milik `sacms-for-developer`, terpisah dari
database CMS-nya.

`@prisma/adapter-pg` sudah portabel ([ADR-007](./ADR-007-prisma-driver-adapter.md)) dan
development sudah memakai Postgres lokal, jadi perubahan kodenya mendekati nol.

### 3. Storage pindah dari Vercel Blob ke storage developer platform

`BLOB_READ_WRITE_TOKEN` dibuang — ia opsional dan belum pernah dipakai. Aset diunggah lewat
media API per-tenant milik developer platform dan disajikan dari sana.

### 4. Schema dan konten website pengguna lewat **MCP**, bukan tabel kita

Ketika pengguna membangun website, struktur kontennya (Content Type, Single Type, Component)
dan isinya disimpan di developer platform, dikelola lewat MCP. Kita **tidak** membuat tabel
CMS sendiri.

### 5. Satu project = satu tenant, dibuat oleh akun layanan `super_admin`

Pengguna nocode **tidak punya akun di `sacms-for-developer`** dan tidak pernah tahu bahwa
tenant itu ada. **Setiap project** yang dibuat pengguna mendapat **satu tenant sendiri**,
dibuat oleh **satu akun layanan berperan `super_admin`** milik pemilik sistem.

```
Pengguna ──buat project──► nocode (VPS SaCMS)
                             │
                             │ POST /api/platform/tenants
                             │ Authorization: Bearer $SACMS_PROVISION_KEY
                             │ Idempotency-Key: nocode:<project.id>
                             ▼
                           SaCMS ── Tenant { source: "nocode", externalRef }
                                  ── TenantMember { AKUN LAYANAN, role: "owner" }
                                  ── ApiToken (full-access) ──┐
                                                               │
       Project.sacmsTenantId + sacmsApiToken (terenkripsi) ◄───┘
```

**Kenapa `super_admin`.** Membuat workspace di SaCMS wajib lewat akun SaCMS, dan tiap akun
punya batas jumlah workspace. `enforceUserPlanLimit` keluar lebih awal untuk `super_admin`
(`allowed: true, max: 999999`), sehingga batas itu tidak berlaku dan `getUserUsage` — yang
menjalankan `tenantMember.count()` dan makin lambat seiring bertambahnya tenant — tidak
pernah dipanggil. Dengan satu tenant per project, tanpa bypass ini pembuatan project akan
berhenti total pada tenant ke-`max_workspaces`.

Kekuasaan `super_admin` di SaCMS seluruhnya melekat pada **sesi** (76 berkas memeriksa
`session.user.role`), sedangkan akun layanan tidak pernah membuat sesi. Karena itu akun
tersebut wajib **tidak punya jalur login**: `password: null`, tanpa baris `Account`, dengan
alamat email yang tidak bisa menerima surat. Syarat itu dijaga uji CI di sisi sana
(`docs/16` §5.3). Token MCP yang kita terima juga tidak mewarisi kekuasaan itu — MCP
menetapkan `isSuperAdmin: false` tanpa syarat.

**Kenapa satu project = satu tenant.** Isolasi bersih per website: content type milik satu
website tidak bisa bertabrakan dengan milik website lain, walaupun pemiliknya sama. Karena
itu `sacmsTenantId`, `sacmsTenantSlug`, dan `sacmsApiToken` menempel di **`Project`**, bukan
di `User`, dan provisioning terjadi saat membuat project, bukan saat mendaftar.

Konsekuensi yang harus diurus: **menghapus project wajib menghapus tenantnya**, lewat
`DELETE /api/platform/tenants/{externalRef}` yang hanya boleh menyentuh tenant
`source = "nocode"`. Tanpa itu, setiap percobaan yang dibuang meninggalkan tenant hidup
beserta seluruh content type dan medianya, selamanya.

Pemetaan project → tenant adalah **milik kita** dan disimpan di `sacms_nocode`. SaCMS hanya
tahu `externalRef`, bukan siapa penggunanya.

### 6. Dua bidang data yang tidak boleh dicampur

| Data                                                                                               | Tinggal di         | Diakses lewat      |
| -------------------------------------------------------------------------------------------------- | ------------------ | ------------------ |
| ContentType, SingleType, Component, ContentEntry, Media                                            | developer platform | MCP + REST/GraphQL |
| User, Project, BuildJob, BuildStep, Deployment, Domain, CreditLot, UsageEvent, AiMessage, AuditLog | `sacms_nocode`     | Prisma langsung    |

Alasan pemisahan: halaman builder melakukan polling status build **tiap 2 detik**
([02 §2.3](../02-ARSITEKTUR-SISTEM.md)). Menjalankan itu lewat MCP over HTTP berarti
menambah latensi dan menabrak rate limit di jalur terpanas aplikasi. MCP dipakai untuk
operasi schema yang jarang dan bernilai tinggi, bukan untuk polling.

### 7. Tidak ada paket Enterprise di nocode — seluruh website tetap di Vercel

| Paket                      | Ada di         | Hosting website | Storage & database konten                                                               |
| -------------------------- | -------------- | --------------- | --------------------------------------------------------------------------------------- |
| **Standar, Pro, Business** | **nocode**     | Vercel          | Shared, di SaCMS                                                                        |
| **Enterprise**             | **SaCMS saja** | Vercel          | Shared, kuota lebih besar ([ADR-018](./ADR-018-enterprise-di-infrastruktur-bersama.md)) |

Aplikasi kita di VPS SaCMS (ADR-017); seluruh website hasil tetap terbit lewat
`v0.deployments.create` ([ADR-008](./ADR-008-terbit-lewat-v0-deployments.md)), dan setiap
tenant yang kita buat selalu bertarget `shared_vercel`. **Tidak ada percabangan target hosting
di `deploy.service`, dan tidak perlu kolom target hosting di `Project`.**

**Ini membatalkan tahap 5–6 [ADR-014](./ADR-014-sacms-di-vps-sendiri-dan-paket-enterprise.md)
seluruhnya.** `lib/github`, `lib/vps`, `GITHUB_TOKEN`, `GITHUB_OWNER`, repo per project —
tidak satu pun dibangun. ± 4 hari dan satu vendor hilang dari rencana.

**Enterprise = diarahkan ke SaCMS, bukan dimigrasikan.** Diputuskan pemilik (16 September
2026). Paket Enterprise **boleh ditampilkan** di halaman harga kita, tetapi tombolnya adalah
tautan ke `https://developer.sacms.cloud` untuk mendaftar dan berlangganan **di sana**. Tidak
ada pembayaran Enterprise di nocode, dan tidak ada pemindahan project nocode ke Enterprise —
pelanggan Enterprise memulai sebagai pelanggan SaCMS.

Konsekuensinya, pekerjaan backup → restore → pengalihan kepemilikan tenant yang sebelumnya
direncanakan untuk jalur naik kelas **dibatalkan**. Di sisi kita yang dibangun hanya satu
tautan.

**SaCMS sendiri hanya menjual Enterprise** — paket kecil hidup di sini, paket Enterprise hidup
di sana. Tidak ada tumpang tindih katalog.

### 7c. Domain

Aplikasi kita di **`sacms.cloud`** (VPS SaCMS). SaCMS di **`developer.sacms.cloud`**, pengelolaan
konten di **`cms.sacms.cloud`**. Semua yang kita panggil dari SaCMS memakai
`developer.sacms.cloud`. Peta lengkap dan urutan cutover: `../15-INTEGRASI-SACMS-DEVELOPER.md`
§15.1b.

### 7b. Berkas v0 bisa diambil lewat API — dikonfirmasi

Kekhawatiran ADR-014 ("metodenya belum saya konfirmasi") terjawab. Diperiksa di tipe
`v0-sdk@0.16.7` yang terpasang:

```ts
chats.getVersion({ chatId, versionId, includeDefaultFiles? })
  → VersionDetail { files: { object: 'file'; name: string; content: string; locked: boolean }[] }

chats.downloadVersion({ chatId, versionId, format?: "zip" | "tarball", includeDefaultFiles? })
  → Promise<ArrayBuffer>
```

`getVersion` mengembalikan `{ name, content }[]` tanpa unzip dan tanpa berkas sementara. `downloadVersion` dipakai untuk arsip dan backup.
Tidak ada kebutuhan integrasi GitHub sama sekali.

## Yang Berubah di Kode & Operasi

| Area                               | Perubahan                                                                                            |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Baru `lib/sacms/mcp.ts`            | Klien MCP (Streamable HTTP, Bearer ApiToken) — ACL sesuai [02 §2.2](../02-ARSITEKTUR-SISTEM.md)      |
| Baru `lib/sacms/rest.ts`           | Klien REST/GraphQL publik per-tenant                                                                 |
| Baru `lib/sacms/provision.ts`      | Panggil `POST /api/platform/tenants` saat **membuat project**; nonaktifkan saat project dihapus      |
| Baru `lib/storage.ts`              | Unggah & sajikan aset lewat media API developer platform                                             |
| ~~`lib/github`, `lib/vps`~~        | **Tidak jadi dibangun** — nocode tidak punya paket Enterprise (ADR-014 tahap 5–6 batal)              |
| Baru `schema.service.ts`           | Orkestrasi schema website pengguna lewat MCP                                                         |
| `Project` (Prisma)                 | Kolom `sacmsTenantId`, `sacmsTenantSlug`, `sacmsApiToken` (terenkripsi) — di `Project`, bukan `User` |
| `lib/env.ts`                       | `+SACMS_BASE_URL`, `+SACMS_PROVISION_KEY`; `−BLOB_READ_WRITE_TOKEN`                                  |
| `DATABASE_URL`/`DIRECT_URL`        | `postgres:5432/sacms_nocode` lewat jaringan Docker — tanpa PgBouncer (ADR-017)                       |
| `next.config.ts`                   | **Dipertahankan** — `output: "standalone"` (ADR-017)                                                 |
| `Dockerfile`, `docker-compose.yml` | Dipakai, dengan perbaikan service/port/mount dan build-arg (ADR-017)                                 |
| `vercel.json`                      | Cron dipindah ke penjadwal container di VPS (ADR-017)                                                |
| Ops baru                           | Deploy & penjadwal di VPS; backup mencakup `sacms_nocode`; alarm cadangan gagal                      |

> **Catatan pada kerja yang belum di-commit.** `Dockerfile`, `docker-compose.yml`,
> `output: "standalone"`, dan fallback rate limit **dipakai** (ADR-017), dengan perbaikan yang
> dirinci di sana.

## Risiko yang Harus Diterima

- **Satu VPS menanggung kedua aplikasi dan datanya** (ADR-017). VPS mati = aplikasi kita dan SaCMS
  mati bersamaan; website hasil generate tetap tayang di Vercel tetapi kehilangan konten dan media.
- **Kehilangan PITR Neon.** Diganti `pg_dump` terjadwal. **Cadangan yang belum pernah diuji pulih
  bukan cadangan** — dan `db-backup` hari ini belum mencakup `sacms_nocode`.

- **Dua repositori jadi saling terikat.** Perubahan kontrak MCP di developer platform bisa
  mematahkan kita tanpa ada perubahan di repo ini. Perlu versi pada kontrak dan uji lintas
  sistem di CI.
- **Prasyarat yang belum ada.** `POST /api/platform/tenants` belum dibangun. Tanpa itu
  keputusan 5 tidak bisa dijalankan sama sekali — lihat "Yang Harus Ada Lebih Dulu".

## Yang Harus Ada Lebih Dulu di `sacms-for-developer`

Diperiksa di kode, bukan dugaan:

- `POST /api/tenants` memanggil `getServerSession(authOptions)` — tanpa sesi manusia, 401.
- `resolveToken` di MCP server mengembalikan `AuthContext` yang **sudah berisi `tenantId`**,
  karena `ApiToken` dan `ApiKey` keduanya terikat ke satu tenant.

Artinya **MCP tidak bisa membuat tenant pertama** — ayam dan telur. Endpoint provisioning
machine-to-machine harus dibangun lebih dulu di sana
(`sacms-for-developer/docs/16` §5), berikut kebijakan plan dan gerbang pembayarannya.

**Batas workspace sudah tidak menjadi masalah**, karena akun layanan berperan `super_admin`
dan `enforceUserPlanLimit` keluar lebih awal untuk role itu. Yang menggantikannya adalah dua
syarat lain yang harus dipenuhi di sana sebelum kita menempel:

- **Akun layanan tidak boleh punya jalur login.** `password: null`, tanpa baris `Account`,
  email yang tidak bisa menerima surat — dijaga uji CI. Risikonya bukan hari akun itu dibuat,
  melainkan hari seseorang mengisi `password`-nya "sebentar untuk mengetes".
- **Jalur penghapusan tenant.** Dengan satu tenant per project, tenant yatim menumpuk secepat
  pengguna membuang percobaannya. Kontraknya ada di `docs/16` §5.9, tetapi jalur hapus yang
  ada **tidak menyapu storage tenant shared** — itu harus diperbaiki lebih dulu, kalau tidak
  penghapusan hanya membersihkan database dan bucketnya tetap tumbuh.

Batas jumlah website tetap kita tegakkan **di sini**, oleh `quota.service` dan
`WebsiteSubscription` yang sudah kita punya — bukan menumpang pada batas workspace SaCMS.

## Alternatif yang Dipertimbangkan

| Alternatif                                            | Kelebihan                                    | Kekurangan                                                                            | Alasan          |
| ----------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------- | --------------- |
| Tetap Neon + Vercel Blob, tanpa integrasi             | Tanpa kerja, tanpa ketergantungan baru       | Dua platform terus menduplikasi CMS; konten pengguna tidak bisa dipakai lintas produk | Ditolak pemilik |
| Pindahkan seluruh aplikasi ke VPS (ADR-014)           | Satu tempat, kendali penuh                   | Ops untuk aplikasi yang cocok di serverless; kehilangan CDN & preview Vercel          | Ditolak         |
| **DB+storage dari developer platform, app di Vercel** | Tanpa duplikasi CMS; ops ditanggung satu tim | Ketergantungan keras pada VPS; latensi lintas internet                                | **Diusulkan**   |
| Semua data lewat MCP, tanpa Postgres sendiri          | Satu sumber kebenaran                        | Polling build tiap 2 detik lewat HTTP = latensi + rate limit di jalur terpanas        | Ditolak         |
| Satu database dipakai bersama dua Prisma schema       | Latensi paling rendah                        | Coupling di level tabel; migrasi dua repo harus dikoordinasi setiap kali              | Ditolak         |

## Konsekuensi

**Positif:** tidak ada lagi dua CMS; konten pengguna nocode hidup di platform yang sama
dengan pelanggan developer, jadi pengguna bisa "naik kelas" dari nocode ke akses API penuh
tanpa migrasi data; biaya Neon dan Blob hilang; storage per-tenant sudah matang.

**Negatif:** ketersediaan kita sekarang terikat ke VPS SaCMS; ada kontrak lintas repo yang
harus dijaga dan diberi versi; pemulihan bencana menjadi tanggung jawab bersama, bukan
tanggung jawab vendor.

## Tahap Pengerjaan (setelah disetujui)

Tahap 1–2 dikerjakan di `sacms-for-developer` dan **harus selesai lebih dulu.**

| Tahap | Repo      | Isi                                                                  | Perkiraan      |
| ----- | --------- | -------------------------------------------------------------------- | -------------- |
| 1     | developer | `POST /api/platform/tenants` + kebijakan plan & gerbang pembayaran   | 1,5 hari       |
| 2     | developer | Database `sacms_nocode` + cadangan & uji pemulihan (ADR-017)         | 1,5 hari       |
| 3     | nocode    | `lib/sacms/` — klien MCP + REST (ACL)                                | 1,5 hari       |
| 4     | nocode    | Provisioning tenant saat registrasi; kolom `sacms*` di `User`        | 1 hari         |
| 5     | nocode    | `schema.service` lewat MCP; sambungkan ke pipeline builder           | 1 hari         |
| 6     | nocode    | `lib/storage` ke media API; buang `BLOB_*`                           | 0,5 hari       |
| 7     | nocode    | Pindah database dari Neon; migrasi data; verifikasi 9 cron           | 1 hari         |
| 8     | nocode    | Batalkan sisa ADR-014; revisi docs 02, 03, 14; tulis docs 15         | 0,5 hari       |
| 9     | keduanya  | E2E lintas sistem: daftar → tenant → schema → konten → terbit → live | 1 hari         |
|       |           | **Total**                                                            | **± 9,5 hari** |

## Keputusan yang Dibutuhkan dari Pemilik

Sudah diputuskan (16 September 2026):

1. Tenant dibuat oleh **satu akun layanan berperan `super_admin`** milik pemilik sistem;
   pengguna nocode tidak punya akun di SaCMS.
2. **Satu project = satu tenant.**
3. Tenant dihapus lewat **tenggang waktu** setelah project di-soft-delete.
4. Paket nocode: **Standar, Pro, Business** — website hasilnya di Vercel; storage & DB dari SaCMS shared.
   **Tidak ada Enterprise di nocode**; Enterprise hanya ada di SaCMS.
5. Tenggang penghapusan tenant: **30 hari**, dengan **pemberitahuan tanggal** ke pengguna.
6. Slug paket: `free`, `standar`, `pro`, `business`. **`umkm` dan `pemda` dihapus.**
7. Pembersihan storage saat tenant dihapus: **perluas `deleteTenantStorage`** di SaCMS,
   bukan memberi `storageConfig` per tenant.
8. Tombol Enterprise = **tautan ke `developer.sacms.cloud`**; tidak ada migrasi dari nocode.
9. Domain: nocode `sacms.cloud`, SaCMS `developer.sacms.cloud`, kelola konten `cms.sacms.cloud`.

Yang masih terbuka:

1. Tenant nocode di SaCMS: plan internal **`nocode`**, **tanpa `Subscription`**, dan
   `hostingStatus: "active"` (rekomendasi). Tanpa `hostingStatus` itu, **seluruh** panggilan MCP
   ditolak 402 — dicek di kode SaCMS.
2. Alamat email kita masih `@sacms.id`; pindah ke `sacms.cloud` butuh domain pengirim
   terverifikasi dan kotak surat yang ada.
3. ADR-014: dicabut seluruhnya, atau berstatus "Digantikan sebagian oleh ADR-015"?
   (Rekomendasi: yang kedua — riwayat keputusan tidak dihapus.)
4. Spesifikasi VPS SaCMS untuk dua aplikasi — lihat ADR-017.
5. Kalau VPS SaCMS mati, apa yang harus dilihat pengguna nocode — halaman pemeliharaan,
   atau mode baca-saja dari cache?

## Kapan Keputusan Ini Perlu Ditinjau Ulang

- Kapasitas satu VPS tidak lagi cukup — saatnya memisahkan database atau salah satu aplikasi.
- Terjadi downtime VPS yang membuat nocode ikut mati lebih dari sekali.
- Kontrak MCP berubah cukup sering sampai uji lintas sistem menjadi beban sendiri.
- Volume tenant nocode membuat database CMS dan `sacms_nocode` bersaing sumber daya di satu
  server — saat itu keduanya perlu dipisah ke server berbeda.
