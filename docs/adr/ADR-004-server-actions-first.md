# ADR-004 — Server Actions sebagai Mekanisme Mutasi Utama

**Status:** Accepted
**Tanggal:** 2026-09-14

## Konteks

Setiap mutasi data di SaCMS harus melewati rangkaian pemeriksaan yang sama: autentikasi,
peran, rate limit, kuota, validasi, dan audit. Ada dua cara membangunnya di Next.js App
Router: REST Route Handler dengan klien fetch, atau Server Actions.

Yang menentukan bukan "mana yang lebih modern", melainkan: **di mana rangkaian pemeriksaan
itu bisa dipasang satu kali dan mustahil terlewat.**

## Keputusan

**Server Actions** adalah mekanisme mutasi utama, dibungkus `next-safe-action@8.7.3`.

Route Handler (`app/api/`) dipakai **hanya** untuk empat hal yang secara teknis tidak bisa
menjadi Server Action:

1. Handler Better Auth (`/api/auth/[...all]`)
2. Webhook masuk dari Vercel
3. SSE progres build
4. Endpoint cron

## Alternatif yang Dipertimbangkan

| Alternatif                           | Kelebihan                                                         | Kekurangan                                                                                 | Alasan ditolak                      |
| ------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------- |
| REST Route Handler + fetch           | Familiar; dapat dipakai klien lain                                | Tipe ditulis dua kali; validasi & auth mudah terlewat di satu endpoint; serialisasi manual | Pemeriksaan keamanan tersebar       |
| tRPC                                 | Type-safe penuh, middleware baik                                  | Lapisan tambahan di atas App Router; menduplikasi yang sudah disediakan Server Action      | Kompleksitas tanpa imbalan setimpal |
| Server Action telanjang              | Paling sederhana                                                  | Tanpa validasi terpusat, tanpa middleware, tanpa tipe hasil                                | Tidak aman untuk produk berbayar    |
| **Server Action + next-safe-action** | Satu tipe ujung ke ujung; middleware berantai; validasi Zod wajib | Sulit dikonsumsi klien non-web                                                             | **Dipilih**                         |

## Konsekuensi

**Positif:**

- Rantai `auth → role → impersonasi → rate limit → kuota → jalankan → audit` hidup di
  **satu berkas** (`lib/safe-action.ts`). Action baru mewarisinya secara otomatis; lupa
  memasang pemeriksaan menjadi hampir mustahil.
- Tipe input dan hasil mengalir dari Zod ke komponen tanpa ditulis ulang.
- Progressive enhancement: form tetap bekerja sebelum JavaScript termuat.
- Tidak ada endpoint yang perlu diamankan satu per satu.

**Negatif:**

- Aplikasi mobile atau integrasi pihak ketiga tidak bisa memakai Server Action. Bila API
  publik dibutuhkan (v2.0), ia akan menjadi lapisan REST **terpisah** yang memanggil
  service layer yang sama. Itu sebabnya logika bisnis tinggal di `services/`, bukan di
  dalam action.
- Debugging melalui network tab kurang nyaman dibanding REST.

**Yang menjadi lebih sulit:** menguji mutasi secara terisolasi. Diatasi dengan menaruh
seluruh logika di service layer, yang dapat diuji tanpa Next.js.

## Kapan Ditinjau Ulang

- Muncul kebutuhan API publik atau aplikasi mobile (direncanakan v2.0).
