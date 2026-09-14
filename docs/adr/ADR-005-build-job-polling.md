# ADR-005 — Tabel Build Job + Polling, Bukan Queue Eksternal

**Status:** Accepted
**Tanggal:** 2026-09-14

## Konteks

Pembuatan website memakan 2–4 menit — jauh melampaui batas satu permintaan HTTP. Pekerjaan
harus berjalan di latar belakang, dan progresnya harus terlihat oleh pengguna secara
langsung.

## Keputusan

**MVP:** tabel `BuildJob` + `BuildStep` di PostgreSQL sebagai state machine, dijalankan
lewat `after()` Next.js, dengan **polling 2 detik** dari klien. Cron penyapu menangani job
yang nyangkut.

SSE dan queue eksternal adalah peningkatan Fase 7 ke atas, **bukan** MVP.

## Alternatif yang Dipertimbangkan

| Alternatif              | Kelebihan                                                         | Kekurangan                                                                        | Alasan ditolak untuk MVP    |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------- | --------------------------- |
| Inngest / Trigger.dev   | Retry, observabilitas, penjadwalan bawaan                         | Vendor tambahan, biaya, konsep baru yang harus dipelajari                         | Berlebihan untuk skala awal |
| BullMQ + Redis worker   | Matang, kuat                                                      | Butuh worker yang berjalan terus — bertentangan dengan serverless                 | Menambah infrastruktur      |
| WebSocket               | Dua arah, seketika                                                | Butuh server stateful; berlebihan untuk progres satu arah                         | Tidak sepadan               |
| SSE sejak awal          | Real-time, satu arah, cocok                                       | Koneksi menggantung di serverless; batas durasi fungsi; reconnect harus ditangani | Ditunda ke Fase 7           |
| **Tabel job + polling** | Nol infrastruktur baru; state terlihat di database; mudah didebug | Latensi sampai 2 detik; ada query berulang                                        | **Dipilih**                 |

## Konsekuensi

**Positif:**

- Status build **terlihat di database**. Super Admin bisa memeriksa job mana pun kapan
  pun tanpa alat lain — ini yang membuat `/admin/build` mungkin dibangun.
- Tidak ada layanan baru yang bisa mati, tidak ada biaya tambahan, tidak ada konsep baru.
- Cron penyapu memberi jaminan: job tidak akan menggantung selamanya, meski proses mati
  di tengah jalan.
- Riwayat build tersimpan permanen untuk analisis, bukan hanya di memori queue.

**Negatif:**

- Latensi progres sampai 2 detik. Dapat diterima untuk proses 2–4 menit.
- Query berulang ke database. Diringankan dengan: berhenti saat status final, berhenti
  saat tab tidak terlihat, dan `select` kolom seperlunya.
- `after()` terikat pada siklus hidup fungsi serverless. Bila fungsi berakhir lebih awal,
  job tertinggal `RUNNING` — dan inilah alasan cron penyapu wajib ada sejak Fase 3,
  bukan ditambahkan belakangan.

## Kapan Ditinjau Ulang

- Build bersamaan rutin melebihi ~50 (beban polling menjadi terasa).
- `after()` terbukti tidak andal untuk durasi 2–4 menit di production.
- Pengguna mengeluhkan progres terasa lambat.

Jalur migrasinya sudah siap: state machine tetap sama; yang berubah hanya **siapa yang
menjalankan** `build.service.run()` dan **bagaimana progres sampai ke klien**.
