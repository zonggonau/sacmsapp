# ADR-018 — Enterprise Tanpa VPS per Workspace; Semua Pelanggan di Infrastruktur Bersama

**Status:** Accepted — diputuskan pemilik sistem, 2026-09-17
**Tanggal:** 2026-09-17
**Mengubah:** [ADR-017](./ADR-017-nocode-di-vps-sacms.md) (baris storage dan Enterprise),
[ADR-014](./ADR-014-sacms-di-vps-sendiri-dan-paket-enterprise.md) (jalur Enterprise dihapus),
[ADR-015](./ADR-015-backend-data-dari-sacms-developer.md) §7 (tabel paket)
**Tidak mengubah:** aplikasi SaCMS dan nocode tetap di VPS SaCMS (ADR-017); website pengguna nocode
tetap terbit lewat [ADR-008](./ADR-008-terbit-lewat-v0-deployments.md)
**Rincian sisi SaCMS:** `sacms-for-developer/docs/16-Pemisahan-Platform-dan-Penghapusan-AI-Builder.md` §5.13

## Konteks

Rencana sebelumnya memberi setiap workspace Enterprise di SaCMS sebuah VPS sendiri, lengkap dengan
PostgreSQL dan storage di dalamnya. Pemeriksaan 17 September 2026 menunjukkan jalur itu belum pernah
dipakai (belum ada satu pun VPS Enterprise di production), dan beberapa bagiannya tidak akan pernah
berhasil tanpa pekerjaan besar. Merawatnya berarti menjalankan produk infrastruktur tersendiri.

## Keputusan

| Paket                  | Ada di | Hosting website | Database konten  | Storage media                                      |
| ---------------------- | ------ | --------------- | ---------------- | -------------------------------------------------- |
| Standar, Pro, Business | nocode | Vercel          | Shared, di SaCMS | Object storage bersama, kuota paket                |
| Enterprise             | SaCMS  | Vercel          | Shared, di SaCMS | Object storage bersama, kuota lebih besar + add-on |

- **Tidak ada VPS terpisah per pelanggan.**
- **Pemakaian storage dihitung per pelanggan.** Yang melewati kuota bisa membeli storage tambahan.
- **Object storage = MinIO di VPS SaCMS**; media setiap workspace di folder bernama id workspace.
- **Add-on storage berulang bulanan.**
- **Pengguna nocode bisa membeli storage tambahan**: penagihan di nocode, kuota dinaikkan di SaCMS.
- **Kuota dihitung per workspace** — setiap project nocode punya kuota sendiri.
- Database/storage milik pelanggan tetap tersedia sebagai **layanan yang di-setup manual oleh tim IT SaCMS**,
  bukan provisioning otomatis.

## Dampak ke nocode

- Tenant nocode sudah shared sejak ADR-015; tidak ada perubahan jalur provisioning atau terbit.
- **Kuota storage kini benar-benar berlaku** untuk tenant nocode. Media API SaCMS menolak unggahan yang
  melewati kuota; `lib/sacms/` harus meneruskannya sebagai pesan bahasa Indonesia yang jelas
  ("Ruang penyimpanan website ini penuh…"), bukan galat umum.
- Pembelian storage tambahan oleh pengguna nocode butuh jalur: penagihannya di nocode, kuotanya di SaCMS.

## Konsekuensi

**Positif:** satu arsitektur untuk semua pelanggan; tidak ada provisioning server, SSH, firewall, atau
image per pelanggan untuk dirawat; biaya storage terukur dan bisa ditagihkan.

**Negatif:** tidak ada isolasi database atau lokasi data khusus per pelanggan; satu VPS dan satu
database menanggung semua pelanggan, sehingga backup ke luar VPS dan uji pemulihan wajib; seluruh
website pelanggan tertagih di tim Vercel milik SaCMS.

## Keputusan yang Dibutuhkan

1. ~~Kuota dan harga storage tambahan~~ — diputuskan di SaCMS: Enterprise 50 GB; tambahan Rp50.000 per 10 GB per bulan.
   Terbuka: apakah paket nocode memakai angka yang sama.
