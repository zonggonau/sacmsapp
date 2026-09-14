# SaCMS — Smart Content Management System

**AI Website Builder Platform**
Prompt → Generate → Preview → Edit → Deploy → Live

> Ketik satu kalimat dalam bahasa Indonesia, dapatkan website Next.js yang hidup di URL
> publik. Tanpa menyentuh kode, terminal, database, atau konfigurasi deployment.

---

## Status

**Tahap: Fase 0 selesai di lokal.** Aplikasi berjalan (`pnpm dev`), lint/typecheck/build
lulus, design system terpasang. Tiga item menunggu kredensial pemilik (Neon, GitHub,
Vercel) — rinciannya di [`docs/00-INDEX.md`](./docs/00-INDEX.md).

```
v  FASE 0 - Fondasi & Setup        [ SELESAI LOKAL ]
>  FASE 1 - Auth & App Shell       [ SIAP DIMULAI ]
   FASE 2 - Project CRUD           [ terkunci ]
   FASE 3 - AI Builder Core        [ terkunci ]
   FASE 4 - Deploy & Domain        [ terkunci ]
   FASE 5 - Super Admin            [ terkunci ]
   FASE 6 - Kuota & Paket          [ terkunci ]
   FASE 7 - Hardening & Go-Live    [ terkunci ]
```

## Mulai dari Sini

1. **[`CLAUDE.md`](./CLAUDE.md)** — guardrail pengembangan. Baca lebih dulu.
2. **[`docs/00-INDEX.md`](./docs/00-INDEX.md)** — peta seluruh dokumen perancangan.
3. **[`docs/13`](./docs/13-ROADMAP-DAN-FASE.md)** — fase yang sedang berjalan.

## Apa Ini, Singkatnya

| Lapisan             | Peran                                                                | Siapa yang membangun |
| ------------------- | -------------------------------------------------------------------- | -------------------- |
| **SaCMS**           | Platform SaaS: akun, project, orkestrasi build, kuota, panel pemilik | **Kita**             |
| **v0 Platform API** | Mesin AI penghasil kode                                              | Vercel (kita pakai)  |
| **Vercel**          | Build, hosting, CDN, domain, TLS                                     | Vercel (kita pakai)  |

Kita **tidak** membangun model AI atau code generation engine. Nilai SaCMS ada di lapisan
platform di atasnya. Alasannya: [ADR-001](./docs/adr/ADR-001-v0-sebagai-ai-engine.md).

## Stack

`Next.js 16` · `React 19` · `TypeScript` · `Tailwind CSS 4` · `shadcn/ui`
`PostgreSQL (Neon)` · `Prisma 7` · `Better Auth` · `Zod` · `next-safe-action`
`v0 Platform API` · `Vercel` · `Upstash Redis` · `Resend`

Versi terkunci & alasan pemilihan: [`docs/03`](./docs/03-STACK-DAN-VERSI.md).

## Dokumen Perancangan

| #   | Dokumen                                                 | Isi                                           |
| --- | ------------------------------------------------------- | --------------------------------------------- |
| 01  | [Visi & Scope](./docs/01-VISI-DAN-SCOPE.md)             | Masalah, persona, scope MVP, **out of scope** |
| 02  | [Arsitektur Sistem](./docs/02-ARSITEKTUR-SISTEM.md)     | Lapisan, batas kepercayaan, alur inti         |
| 03  | [Stack & Versi](./docs/03-STACK-DAN-VERSI.md)           | Versi terkunci, larangan, struktur folder     |
| 04  | [Design System](./docs/04-DESIGN-SYSTEM.md)             | Hitam bold + oranye, token, aksesibilitas     |
| 05  | [Struktur Aplikasi](./docs/05-STRUKTUR-APLIKASI.md)     | Route group, nested layout, parallel route    |
| 06  | [Database Schema](./docs/06-DATABASE-SCHEMA.md)         | Prisma schema lengkap, indeks, migrasi        |
| 07  | [Auth & RBAC](./docs/07-AUTH-DAN-RBAC.md)               | Better Auth, peran, empat lapis pertahanan    |
| 08  | [Server Actions](./docs/08-SERVER-ACTIONS.md)           | Kontrak action, middleware, error             |
| 09  | [AI Builder Pipeline](./docs/09-AI-BUILDER-PIPELINE.md) | State machine, system prompt, biaya           |
| 10  | [Super Admin](./docs/10-SUPER-ADMIN.md)                 | Panel pemilik sistem                          |
| 11  | [Quota & Billing](./docs/11-QUOTA-DAN-BILLING.md)       | Kredit, reservasi, paket                      |
| 12  | [Keamanan](./docs/12-KEAMANAN.md)                       | Ancaman, mitigasi, checklist                  |
| 13  | [Roadmap & Fase](./docs/13-ROADMAP-DAN-FASE.md)         | Fase 0–7, Definition of Done                  |
| 14  | [Deployment & Go-Live](./docs/14-DEPLOYMENT-GO-LIVE.md) | Lingkungan, CI/CD, go-live                    |

Keputusan arsitektur: [`docs/adr/`](./docs/adr/)

## Menjalankan Secara Lokal

> Berlaku setelah Fase 0 selesai.

```bash
pnpm install
cp .env.example .env.local     # isi nilainya
pnpm prisma migrate dev
pnpm prisma db seed
pnpm dev
```

Untuk pengembangan tanpa membakar kredit AI: set `V0_MOCK=true`.

## Aturan Kontribusi

1. Kerjakan **hanya** fase yang sedang berjalan.
2. Perubahan arsitektur → tulis ADR dulu.
3. Perilaku berubah → perbarui dokumen di PR yang sama.
4. Ide di luar fase → [`docs/BACKLOG.md`](./docs/BACKLOG.md).

Lengkap: [`CLAUDE.md`](./CLAUDE.md).
