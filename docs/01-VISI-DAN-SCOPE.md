# 01 — Visi & Scope

## 1.1 Satu Kalimat

> SaCMS adalah platform di mana pengguna non-teknis mengetik satu prompt bahasa Indonesia,
> lalu mendapatkan website Next.js yang **hidup di URL publik** tanpa pernah menyentuh kode,
> terminal, database, atau konfigurasi deployment.

## 1.2 Masalah yang Dipecahkan

| Masalah hari ini                                                    | Cara SaCMS menyelesaikannya                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Bikin website butuh developer, waktu, dan biaya                     | Prompt → website live dalam hitungan menit                                  |
| Tool AI builder yang ada berbahasa Inggris & berorientasi developer | UI bahasa Indonesia, template prompt per sektor (pemerintah, sekolah, UMKM) |
| Hasil AI sering "liar" — struktur beda-beda tiap generate           | System prompt terkunci + arsitektur yang dipaksakan oleh SaCMS              |
| Setelah live, mengubah konten harus panggil developer lagi          | Edit lewat prompt di chat yang sama, lalu redeploy                          |
| Owner sistem tidak punya kendali atas biaya AI & penyalahgunaan     | Panel Super Admin: kuota, kredit, kill switch, audit log                    |

## 1.3 Posisi Produk (PENTING — jangan salah paham)

```
┌──────────────────────────────────────────────────────────┐
│  SaCMS  =  Platform SaaS / Orchestrator / Kontrol Bisnis │
│            (INI YANG KITA BANGUN)                        │
├──────────────────────────────────────────────────────────┤
│  v0 Platform API  =  AI Coding Engine                    │
│                      (KITA PAKAI, BUKAN KITA BANGUN)     │
├──────────────────────────────────────────────────────────┤
│  Vercel  =  Build, Hosting, CDN, Domain, TLS             │
│             (KITA PAKAI)                                 │
└──────────────────────────────────────────────────────────┘
```

**Kita TIDAK membangun:** model AI, code generation engine, streaming code diff,
auto-fix engine, generator Next.js, infrastruktur hosting.

**Kita MEMBANGUN:** identitas & akses, manajemen project, orkestrasi build, kuota &
kredit, panel kontrol owner, audit, UX end-to-end berbahasa Indonesia.

Referensi keputusan: [ADR-001](./adr/ADR-001-v0-sebagai-ai-engine.md).

## 1.4 Persona

### P1 — Pengguna Akhir ("Bu Yanti", Kabag Humas Pemda)

- Tidak paham teknis. Pernah pakai WhatsApp dan Word.
- Ingin: website resmi dinas dengan berita, agenda, profil, kontak.
- Ekspektasi: ketik keinginan → jadi. Tidak mau lihat kode.
- Yang membuatnya gagal: jargon Inggris, form panjang, error teknis mentah.

### P2 — Pengguna Teknis Ringan ("Andi", freelancer/agency kecil)

- Paham web tapi tidak mau setup dari nol.
- Ingin: banyak project, iterasi cepat, connect domain klien.
- Ekspektasi: kontrol lebih (edit prompt, lihat versi, rollback).

### P3 — Super Admin / System Owner (pemilik SaCMS)

- Perlu melihat **seluruh** sistem: user, project, konsumsi kredit AI, biaya.
- Perlu bisa: suspend user, reset kuota, ubah plan, matikan generate global,
  menyelidiki kenapa build gagal, melihat audit log.
- Ini **bukan** sekadar "admin dashboard cantik" — ini alat mengendalikan biaya & risiko.

## 1.5 Scope MVP (v1.0) — Wajib Ada

| ID   | Kemampuan                                      | Kriteria lulus                                         |
| ---- | ---------------------------------------------- | ------------------------------------------------------ |
| F-01 | Register & login (email+password, Google)      | User baru bisa masuk < 60 detik                        |
| F-02 | Verifikasi email & reset password              | Email terkirim, link berlaku 1 jam                     |
| F-03 | Dashboard daftar project                       | Menampilkan status & URL live tiap project             |
| F-04 | Buat project baru: pilih tipe + tulis prompt   | Tersimpan, job build terbentuk                         |
| F-05 | Pipeline build dengan progres langkah terlihat | 10 langkah, progres update < 3 detik                   |
| F-06 | Preview hasil di iframe                        | Preview muncul tanpa reload halaman                    |
| F-07 | Edit lewat prompt (chat lanjutan)              | Versi baru terbentuk, preview berubah                  |
| F-08 | Deploy ke production (URL `*.vercel.app`)      | URL publik bisa dibuka orang lain                      |
| F-09 | Riwayat deployment + rollback                  | Bisa kembali ke versi sebelumnya                       |
| F-10 | Connect custom domain + instruksi DNS          | Domain aktif dengan HTTPS                              |
| F-11 | Kuota per plan (project, generate, deploy)     | Melebihi kuota → ditolak dengan pesan jelas            |
| F-12 | Panel Super Admin                              | Lihat & kendalikan user, project, plan, kredit, sistem |
| F-13 | Audit log semua aksi sensitif                  | Setiap aksi admin tercatat, tidak bisa dihapus dari UI |
| F-14 | Dark / Light mode                              | Default dark, pilihan tersimpan, tanpa flash           |
| F-15 | Bahasa Indonesia di seluruh UI                 | Tidak ada teks Inggris di alur utama                   |

## 1.6 OUT OF SCOPE — Jangan Dikerjakan di MVP

> Ini daftar paling penting di dokumen ini. Setiap jam yang dipakai di sini adalah
> jam yang dicuri dari F-01..F-15.

| Ditunda                                                | Alasan                                                     | Target                                                 |
| ------------------------------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------ |
| Workspace / Organization / multi-tenant tim            | Menambah 1 layer izin di **setiap** query                  | v1.1 ([ADR-006](./adr/ADR-006-mvp-tanpa-workspace.md)) |
| Pembayaran otomatis (Midtrans/Stripe)                  | Plan bisa di-set manual oleh Super Admin dulu              | v1.1                                                   |
| CMS bawaan SaCMS (content type builder, media library) | Ini produk terpisah dengan bobot sendiri                   | v2.0                                                   |
| MCP server SaCMS                                       | Butuh CMS dulu                                             | v2.0                                                   |
| Editor kode / file tree                                | Bertentangan dengan "user tidak sentuh kode"               | v2.0                                                   |
| Kolaborasi realtime, komentar, presence                | Tidak ada tim di MVP                                       | v2.0                                                   |
| White-label / custom branding per user                 | Belum ada permintaan berbayar                              | v2.0                                                   |
| Marketplace template                                   | Template prompt bawaan sudah cukup                         | v1.2                                                   |
| Mobile app                                             | PWA responsif cukup                                        | —                                                      |
| i18n multi-bahasa                                      | Bahasa Indonesia saja, tapi **arsitektur siap** (lihat 05) | v1.2                                                   |

## 1.7 Prinsip Desain yang Mengikat

1. **Prompt-first.** Kalau sebuah kebutuhan bisa diselesaikan dengan prompt, jangan buat form.
2. **Jangan pernah tampilkan error mentah.** Semua kegagalan diterjemahkan ke bahasa manusia
   - satu tindakan yang bisa dilakukan user.
3. **Server-first.** Default Server Component. Client Component hanya untuk interaksi.
4. **Satu jalur, bukan banyak pilihan.** Setiap layar punya satu aksi utama yang jelas.
5. **Owner selalu bisa mengambil kendali.** Tidak ada state sistem yang tidak bisa
   dilihat/diubah Super Admin.
6. **Biaya AI adalah biaya nyata.** Setiap pemanggilan v0 harus tercatat dan terhitung
   ke kuota sebelum dieksekusi, bukan sesudah.

## 1.8 Metrik Sukses v1.0

| Metrik                                        | Target                          |
| --------------------------------------------- | ------------------------------- |
| Waktu dari register sampai website live       | < 10 menit                      |
| Tingkat keberhasilan build (tanpa intervensi) | ≥ 85%                           |
| p95 waktu build end-to-end                    | ≤ 4 menit                       |
| Error tak tertangani sampai ke user           | 0                               |
| Biaya AI per website jadi                     | terukur & tampil di panel owner |
