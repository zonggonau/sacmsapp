# 11 — Kuota, Kredit & Paket

## 11.1 Model

Satu satuan saja: **kredit**.

| Tindakan                         | Biaya                                  |
| -------------------------------- | -------------------------------------- |
| Generate awal (buat website)     | 1 kredit                               |
| Generate edit (prompt perubahan) | 1 kredit                               |
| Deploy / terbitkan               | 0 kredit (dibatasi `maxDeploysPerDay`) |
| Rollback                         | 0 kredit                               |
| Tambah domain                    | 0 kredit (dibatasi `maxCustomDomains`) |

Satu satuan lebih mudah dijelaskan ke pengguna dan lebih sulit disalahhitung daripada
tiga satuan terpisah. Kalau nanti model v0 yang berbeda punya biaya berbeda, yang berubah
adalah **berapa kredit** satu generate, bukan jumlah jenis satuan.

## 11.2 Paket MVP

|               | Free  | Pro        | Business   |
| ------------- | ----- | ---------- | ---------- |
| Harga/bulan   | Rp 0  | Rp 149.000 | Rp 499.000 |
| Project       | 1     | 10         | 50         |
| Kredit/bulan  | 30    | 500        | 3.000      |
| Domain kustom | 0     | 3          | 25         |
| Deploy/hari   | 3     | 30         | 200        |
| Model AI      | dasar | menengah   | terbaik    |

Nilai ini tinggal di tabel `Plan` dan **dapat diubah Super Admin tanpa deploy**
(lihat [10 §10.6](./10-SUPER-ADMIN.md)).

## 11.3 Empat Pemeriksaan Berbeda

Sering tertukar. Keempatnya diperiksa dan berbeda satu sama lain:

| Pemeriksaan      | Yang dibatasi          | Sumber                      | Pesan saat gagal                                 |
| ---------------- | ---------------------- | --------------------------- | ------------------------------------------------ |
| **Rate limit**   | Frekuensi mekanis      | Upstash Redis               | "Terlalu banyak permintaan. Coba lagi sebentar." |
| **Kuota kredit** | Konsumsi bulanan       | `User.creditsUsed` vs plan  | "Kuota bulanan Anda habis." → Lihat Paket        |
| **Batas jumlah** | Project & domain aktif | `COUNT` di database         | "Paket Anda maksimal 1 website." → Lihat Paket   |
| **Batas harian** | Deploy per hari        | `COUNT UsageEvent` hari ini | "Batas penerbitan harian tercapai."              |

## 11.4 Reservasi → Commit / Refund

Ini pola yang mencegah dua bug yang selalu muncul di sistem berkuota: **kuota terpakai
padahal kerja gagal**, dan **kerja berjalan padahal kuota habis**.

```
reserve(userId, kind, credits)
  |- transaksi:
  |     kunci baris User (SELECT ... FOR UPDATE)
  |     hitung limit efektif = creditsOverride ?? plan.monthlyCredits
  |     jika creditsUsed + credits > limit  -> lempar QUOTA_EXCEEDED
  |     creditsUsed += credits
  |     buat UsageEvent(state=RESERVED)
  +- kembalikan reservationId
        |
        +-- kerja BERHASIL -> commit(reservationId)
        |     UsageEvent.state = COMMITTED     (creditsUsed tetap)
        |
        +-- kerja GAGAL    -> refund(reservationId)
              UsageEvent.state = REFUNDED
              creditsUsed -= credits
```

Aturan wajib:

1. Reservasi berjalan **di dalam satu transaksi** dengan penguncian baris. Tanpa itu, dua
   permintaan bersamaan dapat melewati batas (_race condition_ klasik).
2. `refund` bersifat **idempoten** — memanggilnya dua kali tidak mengembalikan dua kali.
   Dijaga oleh pemeriksaan `state === "RESERVED"`.
3. Cron penyapu me-refund `UsageEvent` yang masih `RESERVED` lebih dari 30 menit. Ini
   jaring pengaman untuk proses yang mati mendadak.
4. Reservasi terjadi di middleware Server Action ([08 §8.3](./08-SERVER-ACTIONS.md)),
   bukan tersebar di masing-masing service.

## 11.5 Periode & Reset

- Periode bersifat **bergulir per pengguna**, dihitung dari `User.periodStartedAt`.
  Bukan tanggal 1 kalender.
- Alasan: pengguna yang daftar tanggal 28 tidak mendapat "sisa dua hari" yang terasa
  seperti penipuan.
- Cron harian mereset pengguna yang `periodStartedAt` sudah lewat 30 hari:
  `creditsUsed = 0`, `periodStartedAt = now`.
- **Kredit tidak menumpuk** (tidak carry-over). Dinyatakan jelas di halaman paket.

## 11.6 Menampilkan Kuota ke Pengguna

Kuota harus terlihat **sebelum** dibutuhkan, bukan saat sudah habis.

| Tempat              | Tampilan                                                         |
| ------------------- | ---------------------------------------------------------------- |
| Topbar              | `412 / 500 kredit` — berubah oranye di ≤20%, merah di ≤5%        |
| `/akun/paket`       | Bar untuk kredit, project, domain, deploy + tanggal reset        |
| Dialog buat project | Sisa kredit di bawah tombol                                      |
| Batas tercapai      | Dialog dengan penjelasan + tombol "Lihat Paket"                  |
| Kredit ≤ 20%        | Notifikasi dalam aplikasi (sekali per periode, jangan mengulang) |

Aturan: saat kuota habis, tombol **tetap terlihat** tetapi nonaktif dengan tooltip yang
menjelaskan. Menyembunyikan tombol membuat pengguna mengira fiturnya hilang.

## 11.7 Pembayaran (Rencana v1.1 — TIDAK dikerjakan di MVP)

Di MVP, perubahan paket dilakukan **manual oleh Super Admin** setelah pembayaran di luar
sistem (transfer). Ini keputusan sadar: pembayaran otomatis menambah integrasi, webhook,
rekonsiliasi, faktur, pajak, dan penanganan sengketa — pekerjaan berminggu-minggu yang
tidak membuktikan apa pun tentang kelayakan produk.

Saat tiba waktunya:

- Penyedia: **Midtrans** (paling sesuai untuk Indonesia — QRIS, VA, e-wallet, kartu).
- Tabel baru: `Subscription`, `Invoice`, `PaymentEvent`.
- Webhook Midtrans diverifikasi dengan _signature key_, diproses **idempoten** berdasarkan
  `order_id`.
- Penurunan paket berlaku di akhir periode berjalan, bukan seketika.
- Faktur PDF + NPWP untuk pelanggan instansi/korporat.

Yang perlu disiapkan **sekarang** agar migrasi tidak menyakitkan: `Plan.priceMonthly`
sudah ada, `User.planExpiresAt` sudah ada, dan semua pemeriksaan kuota membaca dari
`Plan` (bukan dari konstanta yang di-hardcode).

## 11.8 Rekonsiliasi Biaya

Kredit adalah satuan **komersial** kita. Biaya vendor adalah angka **nyata**. Keduanya
harus dipertemukan, kalau tidak kita tidak pernah tahu margin sebenarnya.

```
Cron harian 02:00 WIB
  |- ambil laporan pemakaian v0 kemarin
  |- cocokkan ke UsageEvent lewat correlationId / chatId
  |- isi UsageEvent.vendorCostIdr dan .model
  |- agregasi harian -> ringkasan biaya di /admin
  +- jika biaya 7 hari terakhir > ambang -> notifikasi Super Admin
```

Metrik yang wajib tampil di `/admin`:

- Biaya rata-rata per website jadi (biaya vendor ÷ jumlah project `LIVE` baru)
- Biaya per pengguna aktif
- 10 pengguna dengan konsumsi kredit tertinggi
- Margin per paket: pendapatan − biaya vendor

Angka pertama (biaya per website jadi) adalah yang menentukan apakah harga Rp 149.000
masuk akal atau merugi. Tampilkan sejak Fase 6.
