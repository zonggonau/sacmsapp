# SaCMS — Master Index Dokumen Perancangan

> **PACE AI — Papua Artificial Creation Engine.** _Born in Papua. Built for the World._
>
> **SaCMS (Smart Content Management System)** — nama kode platform AI Website Builder di
> bawah brand PACE AI. Prompt → Generate → Preview → Edit → Deploy → Live.
> Identitas brand lengkap: [01 §1.0](./01-VISI-DAN-SCOPE.md).

**Versi dokumen:** 1.0
**Tanggal:** 2026-09-14
**Status:** BASELINE — disetujui sebagai acuan pengembangan

---

## Aturan Utama

> **Dokumen ini adalah sumber kebenaran (single source of truth).**
> Kode mengikuti dokumen. Jika kode dan dokumen berbeda, salah satunya harus diperbaiki
> dalam PR yang sama — tidak boleh dibiarkan berbeda.
>
> Perubahan arsitektur **wajib** lewat ADR baru di [`docs/adr/`](./adr/). Tidak ada
> "sambil jalan kita ubah saja".

---

## Daftar Dokumen

| #   | Dokumen                                            | Isi                                                       | Wajib dibaca oleh |
| --- | -------------------------------------------------- | --------------------------------------------------------- | ----------------- |
| 01  | [Visi & Scope](./01-VISI-DAN-SCOPE.md)             | Masalah, persona, scope MVP, **out of scope**             | Semua             |
| 02  | [Arsitektur Sistem](./02-ARSITEKTUR-SISTEM.md)     | Layer, boundary, integrasi v0 + Vercel, data flow         | Semua             |
| 03  | [Stack & Versi](./03-STACK-DAN-VERSI.md)           | Versi terkunci, alasan pemilihan, larangan                | Semua             |
| 04  | [Design System](./04-DESIGN-SYSTEM.md)             | Token warna, dark bold black + orange, komponen, a11y     | Frontend          |
| 05  | [Struktur Aplikasi](./05-STRUKTUR-APLIKASI.md)     | Route groups, nested layout, parallel/intercepting routes | Frontend          |
| 06  | [Database Schema](./06-DATABASE-SCHEMA.md)         | Prisma schema lengkap + indeks + aturan migrasi           | Backend           |
| 07  | [Auth & RBAC](./07-AUTH-DAN-RBAC.md)               | Better Auth, role, guard berlapis, super admin            | Semua             |
| 08  | [Server Actions](./08-SERVER-ACTIONS.md)           | Kontrak action, validasi, error, revalidate, audit        | Semua             |
| 09  | [AI Builder Pipeline](./09-AI-BUILDER-PIPELINE.md) | State machine build, orkestrasi v0, system prompt         | Backend           |
| 10  | [Super Admin](./10-SUPER-ADMIN.md)                 | Panel pemilik sistem, kontrol global                      | Semua             |
| 11  | [Quota & Billing](./11-QUOTA-DAN-BILLING.md)       | Plan, kredit, penghitungan usage, enforcement             | Backend           |
| 12  | [Keamanan](./12-KEAMANAN.md)                       | Ancaman, mitigasi, secret handling, checklist             | Semua             |
| 13  | [Roadmap & Fase](./13-ROADMAP-DAN-FASE.md)         | Fase 0–7, Definition of Done, acceptance criteria         | Semua             |
| 14  | [Deployment & Go-Live](./14-DEPLOYMENT-GO-LIVE.md) | Env, CI/CD, staging, checklist go-live, rollback          | DevOps            |

## Architecture Decision Records

| ADR                                                             | Keputusan                                                | Status    |
| --------------------------------------------------------------- | -------------------------------------------------------- | --------- |
| [000](./adr/ADR-000-template.md)                                | Template ADR                                             | —         |
| [001](./adr/ADR-001-v0-sebagai-ai-engine.md)                    | v0 Platform API sebagai AI engine (bukan bangun sendiri) | Accepted  |
| [002](./adr/ADR-002-better-auth.md)                             | Better Auth untuk autentikasi                            | Accepted  |
| [003](./adr/ADR-003-postgres-prisma.md)                         | PostgreSQL + Prisma ORM                                  | Accepted  |
| [004](./adr/ADR-004-server-actions-first.md)                    | Server Actions sebagai mutasi utama, bukan REST          | Accepted  |
| [005](./adr/ADR-005-build-job-polling.md)                       | Build job table + polling (bukan queue eksternal) di MVP | Accepted  |
| [006](./adr/ADR-006-mvp-tanpa-workspace.md)                     | MVP tanpa Workspace/Organization                         | Accepted  |
| [007](./adr/ADR-007-prisma-driver-adapter.md)                   | Driver adapter Prisma 7 (`@prisma/adapter-pg`)           | Accepted  |
| [008](./adr/ADR-008-terbit-lewat-v0-deployments.md)             | Menerbitkan website lewat v0 deployments                 | Accepted  |
| [009](./adr/ADR-009-csp-nonce-render-dinamis.md)                | CSP nonce membuat seluruh halaman dirender dinamis       | Diusulkan |
| [010](./adr/ADR-010-pembayaran-midtrans.md)                     | Pembayaran otomatis lewat Midtrans (v1.1)                | Accepted  |
| [011](./adr/ADR-011-ikuti-perilaku-bawaan-v0.md)                | Ikuti perilaku bawaan v0 — hasil sama dengan v0.app      | Accepted  |
| [012](./adr/ADR-012-langganan-per-website-dan-dompet-kredit.md) | Paket per project tahunan + kredit AI per akun           | Diusulkan |
| [013](./adr/ADR-013-formulir-project-baru-tanpa-dialog.md)      | Formulir project baru tanpa dialog (halaman penuh)       | Accepted  |

---

## Cara Membaca untuk Memulai Kerja

1. Baca **01** dan **02** sampai paham batas sistem. Jangan lewati.
2. Baca **13** untuk tahu fase yang sedang berjalan dan apa yang **belum boleh** dikerjakan.
3. Baca dokumen teknis sesuai area kerja (04/05 untuk UI, 06–09 untuk backend).
4. Sebelum menulis kode, cek [`/CLAUDE.md`](../CLAUDE.md) — berisi guardrail operasional.

## Status Fase Saat Ini

```
✓ FASE 0 — Fondasi & Setup        [ SELESAI — database aktif, seed terisi ]
◐ FASE 1 — Auth & App Shell       [ TERUJI E2E — tersisa Google OAuth (butuh kredensial) ]
✓ FASE 2 — Project CRUD           [ SELESAI — DoD terbukti E2E, 404 sungguhan ]
◐ FASE 3 — AI Builder Core        [ tersisa: versi lanjutan dengan v0 nyata (butuh kredit) ]
◐ FASE 4 — Deploy & Domain        [ UJI NYATA LULUS — 1 butir tersisa: domain ACTIVE (butuh domain uji) ]
✓ FASE 5 — Super Admin            [ SELESAI — 60 asertasi HTTP + 13 service ]
✓ FASE 6 — Quota & Billing        [ SELESAI — 38 asertasi service + uji HTTP ]
▶ FASE 7 — Hardening & Go-Live    [ BERJALAN — CI hijau, unit 81%, CSP, runbook, beban & pemulihan lulus ]
```

> Update blok ini setiap kali sebuah fase selesai. Fase berikutnya **tidak dibuka**
> sebelum Definition of Done fase sekarang terpenuhi penuh (lihat dokumen 13).

### Yang sudah terbukti berjalan

Diuji langsung terhadap database, bukan hanya lolos kompilasi:

| Uji                                       | Hasil                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| Migrasi + seed                            | 15 tabel dibuat; 3 paket, 5 pengaturan sistem, 1 super admin                       |
| `/dashboard` tanpa sesi                   | 307 ke `/masuk?lanjut=%2Fdashboard`                                                |
| Daftar menyuntikkan `role: "SUPER_ADMIN"` | **Ditolak** — `FIELD_NOT_ALLOWED` (proteksi `input: false`)                        |
| Daftar normal                             | Peran `USER`, paket `free` otomatis, tanpa sesi                                    |
| Masuk sebelum email dikonfirmasi          | Ditolak `EMAIL_NOT_VERIFIED`                                                       |
| Rate limit masuk                          | Percobaan 1–5 lolos, ke-6 diblokir `429`                                           |
| Audit service                             | Menulis baris ke `audit_log`                                                       |
| Pipeline AI Builder (`V0_MOCK=true`)      | 10 langkah tercatat, bobot progres akurat, status `READY`, pratinjau data URI      |
| Chat lanjutan & versi baru                | Chat v0 sama digunakan ulang, versi 2 terbentuk, riwayat pesan tersimpan           |
| Pulihkan versi (`restoreVersion`)         | Versi lama dijadikan aktif tanpa deploy otomatis                                   |
| Pembatalan build (`cancelBuild`)          | Status `CANCELLED`, sisa langkah dilewati, kredit otomatis di-refund               |
| Simulasi kegagalan v0 & retry             | Ditolak -> `FAILED` + pesan Indonesia + refund; retry membuat job baru             |
| Cron penyapu job nyangkut                 | Job lewat `timeoutAt` disapu -> `FAILED` (`AI_TIMEOUT`) + refund                   |
| Proteksi injeksi prompt                   | Pembatas pengguna & karakter tak terlihat dibuang, pola berbahaya ditandai         |
| Isolasi SDK vendor                        | `v0-sdk` hanya diimpor di `src/lib/v0/client.ts`, diverifikasi linter              |
| Klaim job atomik                          | Tiga run() bersamaan pada satu job: hanya satu versi, attempt=1                    |
| Batal saat job berjalan                   | Tetap CANCELLED, hasil dibuang, kredit kembali                                     |
| Kegagalan sementara                       | Retry 3x dengan backoff, lalu FAILED + refund (tidak macet QUEUED)                 |
| Rate limit vendor                         | Antre ulang, dibatasi 3 kali jalan, lalu FAILED + refund                           |
| Edit, batal, gagal pada situs LIVE        | Status LIVE dipertahankan, tidak ada deploy otomatis                               |
| Job QUEUED tak pernah dimulai             | Dipicu polling di server Next sungguhan (SUCCEEDED); disapu cron setelah 15 menit  |
| Id model per paket                        | Semua id valid (v0-mini sampai v0-max-fast), migrasi data diterapkan               |
| Deploy sukses (tiruan)                    | QUEUED → BUILDING → READY, project LIVE, UsageEvent DEPLOY sekali                  |
| Deploy gagal                              | ERROR + pesan jelas; productionUrl & status LIVE tidak berubah; tidak dihitung     |
| Rollback                                  | Versi lama tayang lagi; tolak versi yang sedang tayang / deployment gagal          |
| Penjaga deploy                            | Tiga klik bersamaan → satu deployment; build berjalan & arsip → ditolak            |
| Timeout & deployment tertinggal           | >20 menit → ERROR; QUEUED tak dimulai → dimulai polling/cron                       |
| Webhook                                   | Signature salah → 401; payload "succeeded" diabaikan selama Vercel masih membangun |
| Rekaman DNS                               | Subdomain `.go.id` → CNAME (tanpa `A @`); TXT relatif; anjuran Vercel dipakai      |
| Domain                                    | ACTIVE / PENDING_DNS / VERIFYING sesuai keadaan; kepemilikan di setiap operasi     |
| Mode nyata menolak versi tiruan           | Ditolak sebelum panggilan vendor apa pun                                           |
| Bentuk API Vercel (baca-saja, nyata)      | Alias production 200 publik; URL deployment 302 ke SSO; `/v6/domains/:d/config`    |

### Yang belum terverifikasi

| Butir                                          | Penghalang                                                                                                                   |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Email konfirmasi benar-benar sampai            | **Sandbox Resend LULUS** (`mail.sent`); domain pengirim production masih perlu diverifikasi di Resend                        |
| Login Google                                   | `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` belum diisi                                                                      |
| Tampilan visual (nav aktif oranye, dark/light) | **LULUS 2026-09-16** — audit tangkapan layar /projects/* desktop gelap & ponsel terang; nav aktif diuji E2E                  |
| Generate & deploy dengan v0 sungguhan          | **LULUS 2026-09-15** — generate 120 dtk, deploy READY ±22 dtk, `uji-nyata-sma-jayapura.vercel.app` HTTP 200 (tim Vercel Pro) |
| Custom domain ACTIVE dengan HTTPS sungguhan    | Butuh satu domain uji yang DNS-nya bisa diubah                                                                               |
| Tampilan halaman Deployment & Domain           | **LULUS 2026-09-16** — audit 360px & desktop, tanpa melebar setelah perbaikan URL pratinjau                                  |

### Menunggu kredensial pemilik

| Item                  | Yang dibutuhkan                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repositori GitHub     | Akun GitHub (`gh` CLI belum terpasang di mesin ini). Git lokal aktif di `main` + `develop`, `.github/workflows/ci.yml` siap                                 |
| Deploy staging Vercel | Akun Vercel + environment variable                                                                                                                          |
| Upstash Redis         | Rate limit sekarang memakai penghitung dalam memori; **production menolak start tanpa Upstash** (disengaja — penghitung memori tidak berlaku di serverless) |

> **Catatan penyimpangan:** database development memakai **PostgreSQL lokal**, bukan Neon
> seperti tertulis di [ADR-003](./adr/ADR-003-postgres-prisma.md). Ini bekerja tanpa
> perubahan kode justru karena [ADR-007](./adr/ADR-007-prisma-driver-adapter.md) memilih
> `@prisma/adapter-pg` yang portabel. Neon tetap rencana untuk staging dan production.
