# ADR-009 — CSP Nonce Membuat Seluruh Halaman Dirender Dinamis

**Status:** Diusulkan — menunggu persetujuan pemilik sistem
**Tanggal:** 2026-09-15
**Terkait:** [12 §12.3](../12-KEAMANAN.md), [02 §2.7](../02-ARSITEKTUR-SISTEM.md)

## Konteks

Dua dokumen saling bertentangan:

- [12 §12.3](../12-KEAMANAN.md) dan [13 Fase 7](../13-ROADMAP-DAN-FASE.md) menetapkan
  **CSP dengan nonce**.
- [02 §2.7](../02-ARSITEKTUR-SISTEM.md) dan [05](../05-STRUKTUR-APLIKASI.md) menetapkan
  grup `(marketing)` sebagai **Static + ISR**.

Panduan resmi Next.js 16 (`content-security-policy.md`) menyatakan nonce **hanya**
bekerja pada halaman yang dirender dinamis: halaman statis dibuat saat build, ketika
belum ada permintaan dan belum ada nonce. Keduanya tidak bisa dipenuhi sekaligus.

## Pilihan

1. **Nonce di semua halaman** — seluruh halaman dinamis, termasuk `/`, `/harga`, `/legal`.
2. **Nonce kecuali `(marketing)`** — halaman pemasaran tetap statis dengan CSP longgar
   (`script-src 'unsafe-inline'`). Dua kebijakan berbeda, dan halaman yang paling
   banyak dikunjungi orang asing justru paling lemah.
3. **Subresource Integrity (`experimental.sri`)** — tetap statis dengan CSP berbasis
   hash. Masih experimental; [03 §3.2](../03-STACK-DAN-VERSI.md) membatasi flag
   experimental hanya `authInterrupts`, dan skrip inline next-themes tetap perlu hash
   tersendiri.

## Keputusan (diusulkan)

**Pilihan 1.** Proxy membuat nonce per permintaan; layout akar membaca `x-nonce`.

Alasannya: halaman pemasaran SaCMS hanya tiga dan ringan (harga membaca satu tabel
kecil). Biaya render dinamisnya kecil dibanding satu kebijakan ketat yang seragam.
Bonus: perubahan paket oleh Super Admin langsung tampil di `/harga`, tanpa jeda ISR.

## Konsekuensi

- `(marketing)` di [02 §2.7](../02-ARSITEKTUR-SISTEM.md) dan
  [05](../05-STRUKTUR-APLIKASI.md) berubah menjadi **Dynamic**.
- Tidak ada cache CDN untuk HTML halaman pemasaran. Target Lighthouse ≥ 90 (Fase 7)
  tetap harus dibuktikan dengan render dinamis ini.
- `robots.txt` dan `sitemap.xml` tetap statis (bukan HTML, tidak butuh nonce).
- Bila kelak lalu lintas pemasaran membesar, pilihan 3 dievaluasi ulang lewat ADR baru
  setelah SRI stabil.

## Cara membatalkan

Hapus pembacaan `headers()` di `src/app/layout.tsx` dan pembuatan nonce di
`src/proxy.ts`, lalu pasang CSP tanpa nonce di `next.config.ts`.
