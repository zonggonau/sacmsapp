# ADR-012 — Paket per Project & Dompet Kredit AI per Akun

**Status:** Diusulkan — menunggu persetujuan pemilik sistem
**Tanggal:** 2026-09-16
**Menggantikan (bila disetujui):** [11 §11.1, §11.2, §11.5](../11-QUOTA-DAN-BILLING.md) (paket per akun
dengan kredit bulanan)
**Terkait:** [ADR-003](./ADR-003-postgres-prisma.md), [ADR-010](./ADR-010-pembayaran-midtrans.md),
[ADR-011](./ADR-011-ikuti-perilaku-bawaan-v0.md)

## Konteks

Model sekarang ([11](../11-QUOTA-DAN-BILLING.md)): **paket melekat ke akun** (Free / Pro / Business)
dengan harga bulanan, batas jumlah project, dan **kredit AI bulanan yang di-reset** setiap 30 hari.

Pemilik sistem menginginkan model yang lebih mudah dijual ke UMKM dan Pemda:

1. **1 website = 1 paket** berlangganan **tahunan** dengan **layanan lengkap** dan satu harga.
2. **AI generate tidak termasuk paket.** Kredit AI melekat pada akun, dibeli terpisah (top-up) kapan saja,
   dan bisa dipakai di semua project.

Data biaya nyata akun v0 (9 Agu – 15 Sep 2026, 110 generate, 36 website): rata-rata **Rp 6.900 per
generate**, median Rp 2.800, 90% di bawah Rp 25.100, tertinggi Rp 50.600 (kurs Rp 17.700/USD). Setelah
ADR-011 semua build memakai `v0-auto`, sehingga variasi biaya per generate besar.

**Arsitektur tidak berubah** ([02](../02-ARSITEKTUR-SISTEM.md), [ADR-003](./ADR-003-postgres-prisma.md)):
database Neon dan Vercel Blob hanya dipakai **platform SaCMS** (akun, project, build, kredit, audit, aset
platform). Website pelanggan adalah kode Next.js buatan v0 yang **di-hosting di Vercel** — SaCMS tidak
membuatkan database maupun storage untuk tiap website.

## Keputusan (diusulkan)

**Prinsip:** biaya dipisah menurut **apa yang menimbulkannya**.

| Yang dibayar           | Melekat pada | Alasan                                                                                              |
| ---------------------- | ------------ | --------------------------------------------------------------------------------------------------- |
| **Paket Project**      | 1 project    | Website yang tayang memakai hosting, bandwidth, function Vercel, domain, dan dukungan               |
| **Kredit AI (top-up)** | Akun         | Biaya v0 timbul saat membuat/mengubah, bukan saat situs tayang — bisa dipakai di semua project akun |

### 1. Paket Project — per project, tahunan

Setiap project yang **diterbitkan** membutuhkan satu Paket Project aktif.

| Termasuk dalam Paket Project | Layanan                                            | Batas wajar UMKM                            | Batas wajar Pemda            |
| ---------------------------- | -------------------------------------------------- | ------------------------------------------- | ---------------------------- |
| Hosting & CDN + HTTPS        | Vercel (project Vercel per website)                | 50 GB transfer/bulan                        | 300 GB transfer/bulan        |
| Function bawaan situs        | Vercel Functions (halaman dinamis, form sederhana) | 500 rb pemanggilan/bulan                    | 3 jt pemanggilan/bulan       |
| Domain                       | 1 custom domain + `www`; alamat bawaan             | Domain .com/.id didaftarkan untuk pelanggan | Domain .go.id milik instansi |
| Penerbitan, versi & rollback | Terbit ulang (maks 30/hari), rollback, runbook     | ✓                                           | ✓                            |
| Pemantauan                   | Status situs & penerbitan, notifikasi gagal        | ✓                                           | ✓                            |
| Dukungan                     | Email/WhatsApp                                     | Jam kerja                                   | Prioritas + SLA              |
| **Tidak termasuk**           | **Kredit AI untuk membuat & mengubah website**     | top-up akun                                 | top-up akun                  |

Pemakaian di atas batas wajar: pelanggan diberi tahu di dashboard; kelebihannya ditagih sesuai biaya
vendor + 20% atau pindah ke paket di atasnya. Situs **tidak** dimatikan otomatis karena batas wajar.

| Segmen               | Harga / project / tahun | Tambahan layanan                                                     |
| -------------------- | ----------------------- | -------------------------------------------------------------------- |
| **Umum / UMKM**      | **Rp 3.000.000**        | Dukungan jam kerja                                                   |
| **Instansi / Pemda** | **Rp 12.000.000**       | Dokumen pengadaan & faktur, pelatihan admin, prioritas respons (SLA) |

Harga belum termasuk PPN. Belanja pemerintah memotong PPh 23 dan memungut PPN — ditangani saat penagihan.

**Siklus langganan:**

```
AKTIF ──(H-30, H-7: email & notifikasi)──> berakhir ──> MASA TENGGANG 30 hari
  ^                                                         │ (situs tetap tayang,
  └──────────── perpanjang kapan saja ──────────────────────┤  banner di dashboard)
                                                            v
                                               KEDALUWARSA: situs diturunkan
                                               (project & versi tetap tersimpan 90 hari,
                                                bisa diterbitkan ulang setelah perpanjang)
```

Project **tanpa** Paket Project tetap bisa dibuat dan dibangun di Builder (memakai kredit), tetapi **tidak
bisa diterbitkan**. Batas draf tanpa paket: 10 project per akun (mencegah penyalahgunaan).

### 2. Dompet Kredit AI — per akun, top-up

- Satu **dompet kredit** per **akun**, dipakai untuk **semua project** milik akun itu — tidak dibagi per project.
- Kredit tidak hilang saat Paket Project berakhir atau project dihapus.
- **Tidak ada reset bulanan.** Kredit hasil pembelian **kedaluwarsa 12 bulan** setelah dibeli (selaras
  dengan kredit v0 yang juga kedaluwarsa satu tahun). Pemakaian mengambil kredit yang paling dulu
  kedaluwarsa (FIFO).
- **1 kredit = 1 generate atau edit.** Pola reservasi → commit / refund ([11 §11.4](../11-QUOTA-DAN-BILLING.md))
  tetap berlaku, sekarang terhadap saldo dompet.
- **Kredit sambutan:** akun baru mendapat **5 kredit sekali** (bukan bulanan) untuk mencoba Builder.

| Paket top-up | Harga        | Per kredit | Margin terhadap biaya rata-rata (Rp 6.900) |
| ------------ | ------------ | ---------- | ------------------------------------------ |
| 10 kredit    | Rp 150.000   | Rp 15.000  | 54%                                        |
| 50 kredit    | Rp 650.000   | Rp 13.000  | 47%                                        |
| 100 kredit   | Rp 1.250.000 | Rp 12.500  | 45%                                        |

Pengaman biaya yang sudah ada tetap aktif: ambang biaya harian + kill switch otomatis, dan pemantauan
biaya rata-rata per generate di `/admin`.

### 3. Pembayaran

Sampai Midtrans dibangun ([ADR-010](./ADR-010-pembayaran-midtrans.md), v1.1): **manual** — pelanggan
membayar lewat transfer, lalu Super Admin mengaktifkan Paket Project / menambah kredit dari `/admin`
(tercatat di audit). Kanal kontak sudah tersedia di halaman Paket.

## Perhitungan Biaya per Project per Tahun

Harga vendor sesuai halaman harga resmi yang terakhir diketahui (kurs Rp 17.700/USD). **Wajib dicek ulang
sebelum harga dijual** — vendor mengubah harga beberapa kali setahun.

| Layanan          | Harga vendor (Vercel Pro)                                                 |
| ---------------- | ------------------------------------------------------------------------- |
| Vercel transfer  | Termasuk 1 TB per tim, lalu $0,15/GB                                      |
| Vercel Functions | Termasuk kuota tim; lalu ± $0,60/1 jt pemanggilan, ± $0,128/jam CPU aktif |

Asumsi pemakaian rata-rata: UMKM = situs profil/katalog ± 3.000 kunjungan/bulan; Pemda = portal
informasi ± 30.000 kunjungan/bulan dengan dokumen unduhan.

| Komponen per project      | UMKM / bulan          | Pemda / bulan          |
| ------------------------- | --------------------- | ---------------------- |
| Hosting & transfer        | $0,50                 | $3,00                  |
| Function                  | $0,30                 | $2,00                  |
| Pemantauan & log (bagian) | $0,20                 | $1,00                  |
| **Infrastruktur / bulan** | **$1,00 ≈ Rp 17.700** | **$6,00 ≈ Rp 106.200** |

| Per project per tahun                 | UMKM                   | Pemda                  |
| ------------------------------------- | ---------------------- | ---------------------- |
| Infrastruktur (12 bulan)              | Rp 212.000             | Rp 1.274.000           |
| Domain (.com/.id; .go.id tanpa biaya) | Rp 200.000             | Rp 0                   |
| Dukungan, onboarding, pelatihan       | Rp 100.000             | Rp 1.500.000           |
| Biaya pembayaran                      | Rp 30.000              | Rp 0                   |
| **Biaya langsung**                    | **Rp 542.000**         | **Rp 2.774.000**       |
| **Harga Paket Project**               | **Rp 3.000.000**       | **Rp 12.000.000**      |
| **Kontribusi**                        | **Rp 2.458.000 (82%)** | **Rp 9.226.000 (77%)** |

Biaya tetap platform (seat Vercel Pro, Neon & Upstash platform, Resend, Sentry, operasional —
[14 §14.10](../14-DEPLOYMENT-GO-LIVE.md)) Rp 15–27 juta/tahun tertutup oleh sekitar **7–11 project UMKM**
atau **2–3 project Pemda**.

**Catatan:**

- Biaya terbesar per project adalah **dukungan & pelatihan**, bukan infrastruktur — karena situs pelanggan
  hanya di-hosting.
- Harga terendah dengan untung 100% dari biaya (harga = 2 × biaya langsung): **UMKM ± Rp 1,1 juta**,
  **Pemda ± Rp 5,5 juta**. Harga Rp 3 juta / Rp 12 juta memberi ruang untuk diskon dan biaya akuisisi.
- Kredit AI tidak mengurangi margin Paket Project karena dibayar terpisah dari dompet akun.

## Perubahan Data & Kode

| Area                       | Perubahan                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Plan`                     | Menjadi **Paket Project** per segmen: `priceYearly`, batas wajar (transfer, function), `maxDeploysPerDay`; kolom kredit dihapus |
| Baru `WebsiteSubscription` | `projectId`, `planId`, `startsAt`, `endsAt`, `status` (ACTIVE/GRACE/EXPIRED/CANCELLED), `activatedById`, `paymentRef`           |
| Baru `CreditLot`           | Kredit masuk: `userId`, `amount`, `remaining`, `source` (TOPUP/WELCOME/ADMIN), `expiresAt`, `paymentRef`                        |
| `UsageEvent`               | Reservasi mengambil dari `CreditLot` FIFO; refund mengembalikan ke lot asal                                                     |
| `User`                     | `planId`, `creditsUsed`, `creditsOverride`, `periodStartedAt` dihapus setelah migrasi                                           |
| `quota.service`            | `assertCanDeploy` & `assertCanAddDomain` memeriksa Paket Project; `reserveCreditsInTx` memeriksa saldo dompet                   |
| Cron                       | `reset-periods` diganti `subscription-lifecycle`: pengingat H-30/H-7, masa tenggang, penurunan situs; kedaluwarsa lot           |
| UI pengguna                | Kartu project: status paket; halaman `Paket & Kredit`: saldo dompet, riwayat, paket top-up, perpanjangan                        |
| UI admin                   | Aktifkan / perpanjang Paket Project, tambah kredit manual, laporan paket hampir berakhir                                        |

Tidak ada vendor baru dan tidak ada sumber daya baru per website. Data saat ini masih data uji; migrasi cukup:
kredit sisa paket lama dikonversi menjadi `CreditLot`, dan project yang sedang tayang mendapat paket uji 30 hari.

## Tahap Pengerjaan (setelah disetujui)

| Tahap | Isi                                                                                   | Perkiraan    |
| ----- | ------------------------------------------------------------------------------------- | ------------ |
| 1     | Skema, migrasi, service dompet kredit akun (lot FIFO, reservasi, refund, kedaluwarsa) | 1,5 hari     |
| 2     | Paket Project: langganan per project; terbit & domain butuh paket aktif; uji service  | 1 hari       |
| 3     | Batas wajar: baca pemakaian transfer & function dari Vercel, peringatan di dashboard  | 0,5 hari     |
| 4     | UI pengguna & admin (aktivasi manual, top-up manual, status paket)                    | 1,5 hari     |
| 5     | Cron siklus paket, email pengingat, penurunan situs setelah tenggang                  | 0,5 hari     |
| 6     | Revisi docs 11/14, E2E beli–bangun–terbit–kedaluwarsa, halaman harga                  | 1 hari       |
|       | **Total**                                                                             | **± 6 hari** |

## Alternatif yang Dipertimbangkan

| Alternatif                               | Kelebihan                         | Kekurangan                                                              | Alasan ditolak                                            |
| ---------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------- |
| Paket per akun (model sekarang)          | Sudah dibangun                    | Sulit dijual per website; kredit bulanan hangus                         | Tidak sesuai model penjualan                              |
| Langganan website bulanan                | Pembayaran awal kecil             | Penagihan 12× setahun; Pemda membeli tahunan                            | Pemda & UMKM terbiasa tahunan                             |
| AI termasuk dalam paket                  | Satu harga saja                   | Biaya AI tidak terduga menggerus margin                                 | Pemilik memilih top-up terpisah                           |
| Database Neon & storage Blob per project | Situs bisa menyimpan data sendiri | Biaya infrastruktur ± 5×, vendor bertambah, keluar dari arsitektur awal | Dibatalkan pemilik (2026-09-16) — kembali ke dokumen awal |
| Kredit berbobot biaya nyata v0           | Tidak pernah rugi per generate    | Sulit dijelaskan ke pengguna awam                                       | Ditunda; ditinjau bila perlu                              |

## Konsekuensi

**Positif:** harga mudah dijelaskan ("Rp 3 juta per project per tahun"); arsitektur tetap sesuai dokumen
awal; margin paket tinggi; biaya AI dibayar pemakainya.

**Negatif:** pelanggan harus membeli kredit sebelum website pertama selesai (dibantu kredit sambutan);
perubahan besar pada `quota.service`, UI paket, dan uji yang sudah ada.

**Yang menjadi lebih sulit:** paket gratis tanpa batas waktu tidak lagi ada — hanya kredit sambutan dan draf.

## Keputusan yang Dibutuhkan dari Pemilik

1. Setuju model: **Paket Project** tahunan (hosting & layanan per project) + **kredit AI per akun**?
2. Harga Paket Project: UMKM Rp 3 juta dan Pemda Rp 12 juta — atau lebih murah (batas bawah untung 100%:
   UMKM ± Rp 1,1 juta, Pemda ± Rp 5,5 juta)?
3. Batas wajar per project (tabel §1) dan cara menangani kelebihan: tagih biaya + 20% atau pindah paket.
4. Harga top-up (Rp 15.000 / 13.000 / 12.500 per kredit) dan kredit sambutan 5 kredit.
5. Masa tenggang 30 hari lalu situs diturunkan — atau lebih lama untuk Pemda?
6. Pembayaran tetap manual dulu, atau Midtrans dimajukan sebelum go-live?

## Kapan Keputusan Ini Perlu Ditinjau Ulang

- Biaya rata-rata v0 per generate melebihi Rp 10.000 selama dua minggu berturut-turut.
- Biaya infrastruktur rata-rata satu project melebihi 25% harga paketnya.
- Lebih dari 30% pelanggan tidak memperpanjang setelah tahun pertama.
- Midtrans dibangun — harga top-up dan perpanjangan otomatis ditinjau bersama.
