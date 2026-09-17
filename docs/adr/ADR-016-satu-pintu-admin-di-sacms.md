# ADR-016 — Satu Pintu Admin di SaCMS; Aksi Tetap di Panel Admin Kita

**Status:** Accepted — disetujui pemilik sistem, 2026-09-16
**Tanggal:** 2026-09-16
**Terkait:** [ADR-015](./ADR-015-backend-data-dari-sacms-developer.md),
[10 — Super Admin](../10-SUPER-ADMIN.md), `sacms-for-developer/docs/16` §5.12
**Catatan fase:** dikerjakan di luar fase berjalan (Fase 7) atas permintaan langsung pemilik
sistem. Cakupannya sengaja kecil — satu service baca dan satu endpoint — agar tidak mengganggu
Definition of Done Fase 7.

## Konteks

Pemilik sistem mengelola dua panel super admin: `/admin` milik kita dan `/admin` milik SaCMS
(`sacms-for-developer`). Usulannya: satukan keduanya di SaCMS.

Pemeriksaan kode menunjukkan keduanya **bukan duplikat** — namanya mirip, datanya berbeda:

| Panel              | Yang dikelola                                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Kita (12 halaman)  | Pengguna, project, build, paket Standar/Pro/Business, kredit, prompt & model AI, kill switch, runbook insiden, **impersonasi** |
| SaCMS (22 halaman) | Tenant, billing Midtrans, laba-rugi & margin, database, domain, lisensi, RBAC                                                  |

Hampir setiap aksi kita bergantung pada bagian dalam aplikasi ini: impersonasi memanggil
`auth.api.impersonateUser` (sesi Better Auth di domain kita — SaCMS memakai NextAuth);
batal/ulang build memanggil v0; rollback memanggil Vercel; kredit melewati ledger
`creditService`. Aksi itu tidak bisa dijalankan dari SaCMS tanpa menulis ulang logikanya
atau menembus service layer kita.

## Keputusan

**Satukan pintunya, bukan kodenya.**

1. **`admin.sacms.cloud` menjadi beranda pemilik sistem.** SaCMS mendapat halaman
   `/admin/nocode` berisi ringkasan **hanya-baca** dari aplikasi ini.
2. **Setiap aksi tetap di `/admin` kita.** Kartu di SaCMS hanya menaut ke halaman kita
   (mis. `/admin/build?status=FAILED`, `/admin/sistem`).
3. **Laba-rugi dan margin SaCMS menampilkan konsolidasi** pendapatan dan biaya AI kita,
   berdampingan dengan angka SaCMS, dengan catatan bahwa jenis angkanya berbeda.
4. **Satu login untuk pemilik — ditunda.** SaCMS punya model `OAuthClient`/`OAuthCode`/
   `OAuthToken`; apakah bisa menjadi penyedia OIDC untuk panel kita belum diperiksa.

### Endpoint

```http
GET /api/platform/ringkasan
Authorization: Bearer <PLATFORM_SUMMARY_KEY>
```

- **Route Handler**, bukan Server Action: pemanggilnya server SaCMS, bukan browser pengguna
  kita — sama seperti `/api/cron/*`. Tidak ada mutasi, jadi larangan "Route Handler untuk CRUD"
  tidak dilanggar.
- `PLATFORM_SUMMARY_KEY` minimal 32 karakter; **kosong = semua permintaan ditolak**
  (gagal tertutup). Dibandingkan lewat digest SHA-256 + `timingSafeEqual`.
- `proxy.ts` kita sudah mengecualikan `/api`, jadi endpoint ini tidak terhalang pemeriksaan sesi.
- `Cache-Control: no-store`.

### Isi ringkasan — `platform-summary.service.ts`

Memakai ulang `adminOverviewService.getOverview()` dan `costService.getCostMetrics(30)`;
tidak ada rumus baru. **Tanpa data pribadi:** peringatan pemakaian kredit dari `getOverview()`
menyebut email pengguna, jadi diganti kalimat tanpa identitas yang menaut ke `/admin/pengguna`.
Diuji: hasil serialisasi tidak mengandung `@`.

## Alternatif yang Dipertimbangkan

| Alternatif                                             | Alasan                                                                                                                                                |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| SaCMS membaca/menulis database `sacms_nocode` langsung | **Ditolak.** Melewati service layer (audit, ledger kredit, efek v0/Vercel); impersonasi mustahil; setiap migrasi kita bisa mematahkan admin SaCMS.    |
| UI admin pindah ke SaCMS, kita menyediakan API admin   | Mungkin, ±8–10 hari: ±20 endpoint + 12 layar dibangun ulang dengan auth dan design system berbeda. Logika tetap di sini — yang pindah hanya tampilan. |
| **Satu pintu, aksi tetap di tempatnya**                | **Dipilih.** ±2 hari. Tidak ada logika yang berpindah.                                                                                                |

## Konsekuensi

**Positif:** pemilik punya satu beranda; laporan keuangan melihat kedua produk; kontrol darurat
kita (kill switch, pemeliharaan, cabut sesi) tidak ikut mati bila SaCMS bermasalah.

**Negatif:** tetap dua login sampai butir 4 dikerjakan; kontrak `/api/platform/ringkasan`
menjadi antarmuka lintas repo — mengubah bentuknya wajib dibarengi perubahan skema Zod di SaCMS
(`src/lib/nocode-summary.ts`), yang menolak bentuk tak dikenal dengan pesan "versi kedua
aplikasi tidak sama".

**Angka pendapatan adalah estimasi.** `getCostMetrics()` menghitung pendapatan sebagai
`priceMonthly × pengguna saat ini` (docs/11 §11.7), belum dari pembayaran tercatat dan belum
mengikuti model per-website tahunan ADR-012. SaCMS menampilkannya dengan label itu.

## Kapan Ditinjau Ulang

- Tim operasional bertambah dan orang berbeda tidak boleh mengakses dua aplikasi → pertimbangkan
  penyatuan penuh.
- Dua login terasa mengganggu → kerjakan butir 4 (SSO).
