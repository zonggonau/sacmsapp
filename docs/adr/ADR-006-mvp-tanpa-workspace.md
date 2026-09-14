# ADR-006 — MVP Tanpa Workspace / Organization

**Status:** Accepted
**Tanggal:** 2026-09-14

## Konteks

Rancangan awal mengusulkan hierarki `Organization → Workspace → Project`, mengikuti pola
platform SaaS dewasa. Namun arahan produk untuk versi pertama tegas: _"sistem dibuat
simpel, yang penting user bisa login, buat project, masukkan prompt, website live."_

Workspace terdengar seperti satu tabel tambahan. Kenyataannya ia menambah satu lapisan
izin di **setiap** query, **setiap** Server Action, dan **setiap** layar: siapa anggota,
apa perannya di workspace ini, siapa yang boleh mengundang, siapa pemilik kuota, apa yang
terjadi saat pemilik keluar, bagaimana project berpindah antar-workspace.

## Keputusan

MVP memakai kepemilikan langsung: **`User` → `Project`** lewat `Project.userId`.

Tidak ada tabel `Workspace`, `Organization`, atau `Membership` di v1.0 — **termasuk dalam
bentuk tabel kosong yang disiapkan lebih dulu.**

## Alternatif yang Dipertimbangkan

| Alternatif                                | Kelebihan                                         | Kekurangan                                                                                   | Alasan ditolak                               |
| ----------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Workspace penuh sejak awal                | Tidak perlu migrasi nanti                         | Menambah lapisan izin di seluruh sistem; memperlambat MVP berminggu-minggu                   | Bertentangan dengan arahan "simpel"          |
| Workspace personal otomatis (tersembunyi) | Migrasi lebih mudah kelak                         | Kompleksitas penuh tanpa manfaat yang terlihat pengguna; tetap harus di-join di setiap query | Membayar ongkosnya tanpa menerima manfaatnya |
| **Kepemilikan langsung**                  | Sederhana; setiap query hanya `where: { userId }` | Perlu migrasi bila fitur tim dibutuhkan                                                      | **Dipilih**                                  |

## Konsekuensi

**Positif:**

- Setiap query kepemilikan menjadi satu klausa `where: { userId }` — mudah ditulis, mudah
  diperiksa, mudah diuji. Ini secara langsung mengurangi risiko kebocoran data antar-user
  (ancaman A1 di [12 §12.1](../12-KEAMANAN.md)).
- Kuota melekat pada pengguna, bukan entitas yang dapat dibagi. Perhitungannya jelas.
- Fase 2 selesai dalam hitungan hari, bukan minggu.

**Negatif:**

- Kolaborasi tim tidak mungkin di v1.0. Ini diterima secara sadar dan tercantum sebagai
  _out of scope_ di [01 §1.6](../01-VISI-DAN-SCOPE.md).
- Akan ada migrasi saat fitur tim dibutuhkan.

## Jalur Migrasi ke v1.1 (sudah dipetakan)

Migrasi ini sengaja dibuat **tiga langkah yang kompatibel mundur**, sesuai aturan
[06 §6.6](../06-DATABASE-SCHEMA.md):

1. Tambahkan tabel `Workspace` dan `Membership`; tambahkan `Project.workspaceId` sebagai
   **nullable**. Kode lama tetap berjalan.
2. Backfill: buat satu workspace personal per pengguna; isi `workspaceId` seluruh project;
   jadikan pemiliknya `OWNER`. Kode baru membaca `workspaceId` bila ada, jika tidak
   jatuh kembali ke `userId`.
3. Setelah semua terisi dan rilis stabil: jadikan `workspaceId` wajib; pindahkan kuota
   dari `User` ke `Workspace`.

Karena `Project.userId` tetap dipertahankan sebagai "pembuat", tidak ada data yang hilang
dan rollback tetap mungkin di setiap langkah.

## Kapan Ditinjau Ulang

- Ada permintaan berbayar untuk kolaborasi tim.
- Pelanggan instansi membutuhkan banyak pengelola untuk satu situs.
