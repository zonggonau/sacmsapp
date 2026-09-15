# ADR-008 — Menerbitkan Website Lewat v0 Deployments

**Status:** Accepted
**Tanggal:** 2026-09-15
**Disetujui:** pemilik sistem
**Terkait:** melengkapi [ADR-001](./ADR-001-v0-sebagai-ai-engine.md)

## Konteks

Pemeriksaan Fase 4 menemukan bahwa implementasi penerbitan sebelumnya memanggil
`POST /v13/deployments` milik Vercel hanya dengan nama project, **tanpa berkas maupun
sumber kode**. Di mode nyata tidak ada kode website yang pernah terkirim, sehingga
seluruh "deployment berhasil" yang tercatat berasal dari mesin tiruan.

Kode website hasil generate hidup di v0 (per chat dan versi). Ada dua cara
membawanya ke internet:

1. Meminta v0 menerbitkan versi tersebut (`v0.deployments.create`).
2. Mengambil berkas versi dari v0 lalu mengunggahnya sendiri ke project Vercel milik
   SaCMS.

Pemeriksaan identitas memastikan akun di balik `V0_API_KEY` dan `VERCEL_TOKEN` adalah
akun yang **sama**, sehingga project Vercel yang dibuat v0 dapat dikelola dengan token
SaCMS.

## Keputusan

Penerbitan memakai **`v0.deployments.create({ projectId, chatId, versionId })`**.

- Pemanggilan hanya lewat `lib/v0/` (aturan anti-corruption layer tetap berlaku).
- `vercelProjectId` diambil dari detail project v0, bukan dibuat sendiri.
- Status build dan URL publik dibaca dari Vercel REST API memakai `vercelProjectId`.
- Mesin Vercel tiruan otomatis aktif bila mesin v0 tiruan aktif, dan hanya menghasilkan
  alamat ber-TLD `.invalid` — tidak pernah alamat `vercel.app` karangan.
- Custom domain dikelola lewat Vercel REST API pada project tersebut.
- Rollback = menerbitkan ulang versi lama lewat jalur yang sama.

## Alternatif yang Dipertimbangkan

| Alternatif                      | Kelebihan                                               | Kekurangan                                                                                                       | Alasan            |
| ------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------- |
| **v0 deployments**              | Kode paling sedikit; build dikelola v0; sejalan ADR-001 | Detail build dikendalikan v0; bergantung pada integrasi v0–Vercel                                                | **Dipilih**       |
| Unggah berkas sendiri ke Vercel | Kendali penuh atas project dan build                    | Jauh lebih banyak kode (unggah berkas, konfigurasi build, dependensi); kegagalan build jadi tanggung jawab SaCMS | Ditolak untuk MVP |
| Pertahankan kode lama           | —                                                       | Tidak menerbitkan apa pun di mode nyata                                                                          | Tidak layak       |

## Konsekuensi

**Positif:**

- Versi yang dilihat pengguna di pratinjau adalah versi yang persis diterbitkan.
- Tidak ada pipeline build kedua yang harus dipelihara.

**Negatif:**

- Website pengguna berada di akun Vercel pemilik SaCMS, di project yang dibuat v0.
- Bila v0 mengubah cara integrasinya dengan Vercel, jalur penerbitan ikut terdampak —
  dampaknya dibatasi di `lib/v0/` dan `lib/vercel/`.

**Yang menjadi lebih sulit:** memindahkan hosting ke akun atau penyedia lain; itu akan
memerlukan alternatif kedua di atas.

## Temuan Verifikasi (API sungguhan, 2026-09-15)

| Temuan                                                                                                               | Dampak pada desain                                                                                   |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `v0.projects.create` langsung mengembalikan `vercelProjectId`; project Vercel bernama slug nama project v0           | Domain dan status bisa dikelola sebelum deploy pertama                                               |
| Project buatan v0 memakai `ssoProtection: all_except_custom_domains`                                                 | URL per-deployment (`<nama>-<hash>-<tim>.vercel.app`) → 302 ke login Vercel                          |
| Alias production `<nama>.vercel.app` menjawab 200 tanpa login                                                        | `productionUrl` = alias production, **bukan** URL deployment; proteksi tidak perlu diubah            |
| `DeploymentDetail` v0 tidak memuat status maupun URL publik                                                          | Status dibaca dari `GET /v13/deployments/:id`; id dicocokkan lewat id/inspectorUrl/daftar deployment |
| `GET /v6/domains/:d/config` memberi `misconfigured`, `recommendedIPv4`, `recommendedCNAME` berperingkat              | Rekaman DNS memakai anjuran peringkat 1, tidak ditanam di kode                                       |
| Kredit akun v0 habis dikembalikan sebagai **200** berisi chat tanpa versi + pesan `task-stopped-v1 / out-of-credits` | `lib/v0` menerjemahkannya menjadi kegagalan `CONFIG`, bukan "AI tidak menghasilkan website"          |

**Terverifikasi dengan uji nyata (2026-09-15, tim Vercel Pro):** `v0.deployments.create`
mengembalikan id yang **sama** dengan id deployment Vercel (`dpl_…`), sehingga pencocokan
langsung berhasil pada percobaan pertama. Generate v0-mini 120 dtk, build Vercel READY ±22 dtk,
alias `https://uji-nyata-sma-jayapura.vercel.app` HTTP 200 tanpa login. Dua jalur cadangan
pencocokan (segmen `inspectorUrl`, daftar deployment project) tetap dipertahankan bila v0
mengubah bentuk id.

**Lokasi hosting:** website pengguna dibuat di tim Vercel **Pro** yang terhubung ke v0.
`V0_API_KEY`, `VERCEL_TOKEN`, dan `VERCEL_TEAM_ID` wajib menunjuk tim yang sama — bila tidak,
v0 membuat project di satu tim sementara SaCMS mencarinya di tim lain (403/404). Paket Hobby
tidak dipakai: penggunaan komersial dan cron berfrekuensi tinggi membutuhkan Pro.

## Kapan Ditinjau Ulang

- v0 mengubah atau menghentikan `deployments.create`.
- Muncul kebutuhan hosting di akun Vercel milik pelanggan sendiri.
- Kegagalan build di sisi v0 terbukti sering dan tidak bisa didiagnosis.
