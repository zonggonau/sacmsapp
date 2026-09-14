# ADR-002 — Better Auth untuk Autentikasi

**Status:** Accepted
**Tanggal:** 2026-09-14
**Versi:** `better-auth@1.7.4`

## Konteks

SaCMS membutuhkan: login email + kata sandi, login Google, verifikasi email, reset kata
sandi, sesi yang dapat dicabut, sistem peran, dan kemampuan **impersonasi** agar pemilik
sistem dapat menyelidiki keluhan pengguna.

Peran dan impersonasi bukan tambahan opsional di sini — keduanya kebutuhan produk yang
dinyatakan sejak awal ("ada super admin untuk mengontrol seluruh sistem").

## Keputusan

Memakai **Better Auth 1.7.4** dengan adapter Prisma, plugin `admin`, dan plugin
`nextCookies`.

## Alternatif yang Dipertimbangkan

| Alternatif            | Kelebihan                                                                                    | Kekurangan                                                                 | Alasan ditolak                                      |
| --------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------- |
| Auth.js v5 (NextAuth) | Ekosistem besar, banyak contoh                                                               | Credentials provider terasa tempelan; tanpa peran/ban/impersonasi bawaan   | Seluruh kebutuhan super admin harus dibangun manual |
| Clerk                 | Sangat cepat dipasang, UI siap pakai                                                         | Berbayar per pengguna aktif; data pengguna di luar; sulit di-Indonesia-kan | Biaya dan kendali                                   |
| Supabase Auth         | Matang                                                                                       | Menarik seluruh platform Supabase sementara database kita Neon             | Mencampur dua platform                              |
| Bangun sendiri        | Kendali penuh                                                                                | Auth buatan sendiri adalah sumber kerentanan klasik                        | Risiko tidak sebanding                              |
| **Better Auth**       | Email+sandi kelas satu; plugin `admin` memberi peran, ban, **impersonasi**; skema milik kita | Ekosistem lebih muda                                                       | **Dipilih**                                         |

## Konsekuensi

**Positif:**

- Plugin `admin` menyediakan `role`, `banUser`, `listUsers`, dan `impersonateUser` secara
  langsung. Ini memangkas pekerjaan Fase 5 secara berarti.
- Tabel `User`, `Session`, `Account` adalah model Prisma **kita sendiri**, sehingga kolom
  SaCMS (`planId`, `creditsUsed`, `status`) hidup berdampingan tanpa tabel bayangan.
- Sesi tersimpan di database, jadi dapat dicabut seketika saat pengguna ditangguhkan —
  hal yang tidak mungkin dengan JWT tanpa daftar cabut.

**Negatif:**

- Contoh dan jawaban komunitas lebih sedikit dibanding Auth.js; sebagian hal harus digali
  dari dokumentasi resmi.
- `additionalFields` **wajib** memakai `input: false` untuk `role`, `status`, dan
  `planId`. Melupakannya membuka celah naik peran (_mass assignment_). Karena itu hal ini
  menjadi butir uji wajib di [07 §7.8](../07-AUTH-DAN-RBAC.md) dan
  [13 Fase 1](../13-ROADMAP-DAN-FASE.md).

## Kapan Ditinjau Ulang

- Better Auth berhenti dikembangkan atau merilis perubahan memutus yang besar.
- Muncul kebutuhan SSO enterprise (SAML) yang tidak didukung.
