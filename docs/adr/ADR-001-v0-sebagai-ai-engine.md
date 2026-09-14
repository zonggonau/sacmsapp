# ADR-001 — v0 Platform API sebagai AI Engine

**Status:** Accepted
**Tanggal:** 2026-09-14

## Konteks

SaCMS perlu mengubah prompt bahasa alami menjadi aplikasi Next.js yang benar-benar
berjalan. Kemampuan ini adalah inti produk. Ada dua jalan: membangun sendiri, atau
memakai mesin yang sudah ada.

Membangun _code generation engine_ sendiri berarti menyediakan: orkestrasi LLM, penalaran
kode lintas berkas, streaming diff, validasi hasil, auto-fix ketika build gagal, dan
sandbox untuk menjalankan hasilnya. Itu pekerjaan tim riset berbulan-bulan — dan hasilnya
tetap akan tertinggal dari mesin yang dikembangkan penuh waktu oleh pihak lain.

## Keputusan

Memakai **v0 Platform API** sebagai satu-satunya mesin penghasil kode.
**SaCMS tidak membangun kemampuan generasi kode apa pun.**

Nilai SaCMS ada di lapisan di atasnya: identitas dan akses, manajemen project, orkestrasi
build, kuota dan kredit, kontrol pemilik sistem, serta pengalaman berbahasa Indonesia
untuk pengguna non-teknis.

## Alternatif yang Dipertimbangkan

| Alternatif                    | Kelebihan                                         | Kekurangan                                                     | Alasan ditolak                            |
| ----------------------------- | ------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------- |
| Bangun engine sendiri         | Kendali penuh, tanpa vendor                       | Berbulan-bulan, butuh keahlian riset, kualitas sulit menyamai  | Tidak sebanding dengan nilai yang didapat |
| Mesin template (bukan AI)     | Murah, hasil terduga                              | Kaku; bukan produk yang dijanjikan                             | Bertentangan dengan visi                  |
| LLM umum + orkestrasi sendiri | Bebas memilih model                               | Validasi, sandbox, dan deployment tetap harus dibangun sendiri | Sebagian besar kerja beratnya tetap ada   |
| **v0 Platform API**           | Cepat, hasil siap produksi, menyatu dengan Vercel | Ketergantungan vendor, biaya per pemanggilan                   | **Dipilih**                               |

## Konsekuensi

**Positif:**

- Waktu ke pasar hitungan minggu, bukan bulan.
- Kualitas hasil ikut membaik seiring v0 berkembang, tanpa kerja tambahan dari kita.
- Deployment ke Vercel sudah menjadi bagian alurnya.

**Negatif:**

- Ketergantungan pada satu vendor untuk kemampuan paling inti.
- Biaya menjadi **variabel per pemakaian**. Inilah yang melahirkan seluruh mekanisme
  kuota, reservasi kredit, ambang biaya, dan kill switch di dokumen
  [09](../09-AI-BUILDER-PIPELINE.md) dan [11](../11-QUOTA-DAN-BILLING.md).
- Perubahan API vendor dapat merusak kita.

**Mitigasi ketergantungan:** seluruh interaksi dibungkus _anti-corruption layer_ di
`lib/v0/` dengan tipe milik SaCMS sendiri (`GenerateInput`, `GenerateResult`). Mengganti
mesin di kemudian hari berarti menulis ulang **satu folder**, bukan seluruh aplikasi.

**Yang menjadi lebih sulit:** kita tidak bisa menjanjikan kemampuan yang v0 tidak punya,
dan tidak bisa memperbaiki kualitas hasil selain lewat system prompt.

## Kapan Ditinjau Ulang

- Biaya per website jadi melampaui margin sehat pada harga yang berlaku.
- v0 mengubah API secara memutus, atau menghentikan layanan.
- Muncul alternatif dengan kualitas setara dan biaya jauh lebih rendah.
