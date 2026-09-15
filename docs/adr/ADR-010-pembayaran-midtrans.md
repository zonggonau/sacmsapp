# ADR-010 — Pembayaran Lewat Midtrans

**Status:** Accepted
**Tanggal:** 2026-09-15
**Disetujui:** pemilik sistem
**Terkait:** [11 §11.7](../11-QUOTA-DAN-BILLING.md), [13 §13.4](../13-ROADMAP-DAN-FASE.md)

## Konteks

Di MVP, paket diubah manual oleh Super Admin setelah pengguna membayar di luar sistem
([11 §11.7](../11-QUOTA-DAN-BILLING.md)). Pembayaran otomatis dijadwalkan di v1.1.

Dokumen sebelumnya belum konsisten: [11 §11.7](../11-QUOTA-DAN-BILLING.md) sudah
menyebut Midtrans, sedangkan [01 §1.6](../01-VISI-DAN-SCOPE.md) masih menulis
"Midtrans/Stripe". Penyedia harus dipastikan sebelum skema `Subscription`, `Invoice`, dan
`PaymentEvent` dirancang, karena bentuk webhook dan status transaksi berbeda antar-penyedia.

Pengguna sasaran SaCMS adalah instansi, sekolah, dan UMKM di Indonesia, termasuk Papua,
yang paling banyak membayar lewat QRIS, transfer virtual account, dan e-wallet, bukan kartu
kredit internasional.

## Keputusan

**Pembayaran otomatis memakai Midtrans.** Penyedia lain tidak diintegrasikan.

- Integrasi dibungkus di `lib/midtrans/` (anti-corruption layer, sama seperti `lib/v0` dan
  `lib/vercel`). Tidak ada impor SDK Midtrans di luar folder itu.
- Metode: QRIS, virtual account bank, e-wallet (GoPay, ShopeePay), kartu.
- Webhook (notifikasi HTTP) diverifikasi dengan `signature_key`, diproses **idempoten**
  berdasarkan `order_id` + `transaction_status`, dan statusnya dibaca ulang dari API
  Midtrans. Payload webhook hanya pemicu, sama seperti webhook Vercel (ancaman A7).
- Mode Sandbox di development & staging; Production hanya di lingkungan production.
- Kunci server Midtrans hanya di server, tidak pernah `NEXT_PUBLIC_`. Kunci klien Snap boleh
  publik.

**Waktu pengerjaan tidak berubah: v1.1**, setelah MVP go-live. ADR ini hanya memastikan
penyedianya.

## Alternatif yang Dipertimbangkan

| Alternatif   | Kelebihan                                     | Kekurangan                                                     | Alasan ditolak                                   |
| ------------ | --------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------ |
| Stripe       | SDK & dokumentasi sangat baik, langganan siap | Dukungan metode lokal (QRIS, VA) terbatas untuk akun Indonesia | Tidak cocok dengan cara bayar pengguna sasaran   |
| Xendit       | Metode lokal lengkap, API modern              | Setara Midtrans untuk kebutuhan kita                           | Tidak ada keunggulan yang membenarkan pergantian |
| Tetap manual | Tanpa integrasi                               | Tidak berskala, rawan salah catat, lambat bagi pengguna        | Hanya layak untuk MVP                            |

## Konsekuensi

**Positif:** metode bayar sesuai kebiasaan pengguna Indonesia; satu penyedia, satu jalur
webhook yang harus diamankan.

**Negatif:** langganan berulang otomatis tidak sematang Stripe. Perpanjangan bulanan
kemungkinan memakai tagihan baru per periode, bukan penagihan kartu otomatis.

**Yang menjadi lebih sulit setelah keputusan ini:** menerima pembayaran dari luar
Indonesia dengan kartu internasional.

## Kapan Keputusan Ini Perlu Ditinjau Ulang

- Lebih dari 20% calon pelanggan berbayar berasal dari luar Indonesia.
- Biaya transaksi Midtrans naik sehingga margin paket termurah di bawah 30%.
- Midtrans menghentikan metode yang dipakai mayoritas pengguna (mis. QRIS).
