# Backlog — Ide di Luar Fase Berjalan

> **Kenapa berkas ini ada.** Ide bagus yang muncul di tengah fase adalah penyebab paling
> umum proyek keluar jalur. Tulis di sini, lanjutkan pekerjaan yang sedang berjalan.
> Setiap akhir fase, isi berkas ini ditinjau dan diputuskan: kerjakan, jadwalkan, atau buang.

## Cara Menulis Entri

```markdown
### [Judul singkat]

- **Ditemukan saat:** Fase N, tanggal
- **Masalah nyata yang diselesaikan:** (kalau tidak ada, jangan ditulis)
- **Perkiraan usaha:** jam / hari
- **Target versi usulan:** v1.1 / v1.2 / v2.0 / buang
```

Entri tanpa "masalah nyata" adalah keinginan, bukan kebutuhan. Jangan dicatat.

---

## Belum Ditinjau

_(kosong — isi saat ide muncul)_

---

## Sudah Dijadwalkan

Ini yang sudah diputuskan sejak perancangan awal
([01 §1.6](./01-VISI-DAN-SCOPE.md), [13 §13.4](./13-ROADMAP-DAN-FASE.md)):

### v1.1

- Workspace & kolaborasi tim — jalur migrasi di [ADR-006](./adr/ADR-006-mvp-tanpa-workspace.md)
- Pembayaran otomatis (Midtrans) — rencana di [11 §11.7](./11-QUOTA-DAN-BILLING.md)
- UI untuk peran `ADMIN` (staf pendukung) — batasan di [10 §10.11](./10-SUPER-ADMIN.md)
- 2FA wajib untuk `SUPER_ADMIN`

### v1.2

- Marketplace template
- i18n multi-bahasa — kesiapan sudah diatur di [05 §5.10](./05-STRUKTUR-APLIKASI.md)
- Analitik pengunjung untuk situs hasil pengguna

### v2.0

- CMS bawaan SaCMS (content type builder, media library)
- MCP server SaCMS
- API publik + aplikasi mobile — akan memakai service layer yang sama
  ([ADR-004](./adr/ADR-004-server-actions-first.md))
- Editor kode / file tree

---

## Ditolak

| Ide                                   | Alasan ditolak                                                                                                   |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Workspace personal tersembunyi di MVP | Membayar seluruh ongkos kompleksitas tanpa menerima manfaatnya ([ADR-006](./adr/ADR-006-mvp-tanpa-workspace.md)) |
| SSE sejak MVP                         | Polling cukup untuk proses 2–4 menit; ditunda ke Fase 7 ([ADR-005](./adr/ADR-005-build-job-polling.md))          |
| Queue eksternal (Inngest/BullMQ)      | Berlebihan untuk skala awal ([ADR-005](./adr/ADR-005-build-job-polling.md))                                      |
| Membangun AI engine sendiri           | Berbulan-bulan kerja riset tanpa keunggulan ([ADR-001](./adr/ADR-001-v0-sebagai-ai-engine.md))                   |
| CSP ketat sejak Fase 0                | Tim akan terbiasa melonggarkannya; dipasang di Fase 7 ([12 §12.3](./12-KEAMANAN.md))                             |
