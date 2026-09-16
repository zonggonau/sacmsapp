# ADR-013 — Formulir Project Baru Tanpa Dialog

**Status:** Accepted
**Tanggal:** 2026-09-16
**Disetujui:** pemilik sistem (permintaan langsung)
**Menggantikan:** [05 §5.4](../05-STRUKTUR-APLIKASI.md) (parallel + intercepting route
`@modal/(.)baru`)

## Konteks

`/projects/baru` sebelumnya punya dua tampilan untuk satu URL:

- diklik dari `/projects` → **dialog** di atas daftar (intercepting route `(.)baru`);
- dibuka langsung atau di-refresh → **halaman penuh**.

Pemilik sistem melihatnya sebagai perilaku yang tidak konsisten: "muncul modal, tapi saat refresh
modalnya hilang dan formnya ada di dalam halaman". Dua tampilan untuk satu alamat membuat pengguna
ragu apakah halamannya berpindah atau tidak.

Formulirnya juga bertambah panjang setelah ADR-011 dan permintaan 2026-09-16: jenis website (12
kartu), nama project, prompt yang kini terisi contoh sepanjang 10–14 baris, dan website referensi.
Di dalam dialog, isi sepanjang itu harus digulir di dalam kotak yang tingginya dibatasi
`max-h-[90dvh]`.

## Keputusan

1. **Hapus dialog.** `/projects/baru` selalu halaman penuh.
2. Berkas yang dihapus: `src/app/(app)/projects/@modal/` (`default.tsx` dan `(.)baru/page.tsx`)
   serta `src/components/features/project/create-project-dialog.tsx`.
3. `projects/layout.tsx` hanya meneruskan `children` — tidak lagi menerima slot `modal`.
4. **Satu komponen form tetap berlaku**: `create-project-form.tsx` dipakai halaman itu, dan wajib
   dipakai ulang bila nanti ada jalur lain untuk membuat project.

## Alternatif yang Dipertimbangkan

| Alternatif                                     | Kelebihan                                          | Kekurangan                                                       | Alasan ditolak                     |
| ---------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------- |
| Pertahankan dialog + halaman penuh             | Daftar project tetap terlihat di belakang dialog   | Satu URL dua tampilan; formulir panjang tergulir di kotak sempit | Pemilik menilainya tidak konsisten |
| Dialog untuk semua kondisi (juga saat refresh) | Tampilan selalu sama                               | Dialog di atas layar kosong; Back dan berbagi tautan jadi aneh   | Menambah kerumitan tanpa manfaat   |
| **Halaman penuh untuk semua kondisi**          | Satu URL satu tampilan; ruang cukup untuk formulir | Daftar project tidak terlihat saat mengisi formulir              | **Dipilih**                        |

## Konsekuensi

**Positif:** satu URL satu tampilan; formulir yang panjang punya ruang; tiga berkas rute dan satu
komponen dialog hilang dari kode; tombol Back kembali ke `/projects` seperti navigasi biasa.

**Negatif:** daftar project tidak lagi terlihat di belakang formulir, dan pengguna kehilangan kesan
"tidak meninggalkan halaman" saat membuat project.

**Yang menjadi lebih mudah:** menambah field baru di formulir project — tidak ada lagi kotak dialog
yang tingginya harus dijaga.

## Kapan Keputusan Ini Perlu Ditinjau Ulang

- Formulir project baru kembali sesingkat satu-dua field, sehingga dialog terasa lebih ringan.
- Muncul kebutuhan membuat project dari layar lain (mis. di dalam ruang kerja project) di mana
  meninggalkan halaman merugikan pengguna.
