# 03 — Stack & Versi Terkunci

> Versi di bawah diverifikasi dari npm registry pada **2026-09-14**.
> **Kunci versi ini.** Menaikkan versi mayor = butuh ADR baru.

## 3.1 Runtime & Package Manager

| Item            | Versi         | Catatan                                                                         |
| --------------- | ------------- | ------------------------------------------------------------------------------- |
| Node.js         | **24.x LTS**  | Terpasang: v24.12.0. Kunci di `.nvmrc` dan `package.json#engines`               |
| Package manager | **pnpm 10.x** | Terpasang: 10.32.0. `packageManager` di `package.json`, commit `pnpm-lock.yaml` |

## 3.2 Inti

| Paket                 | Versi           | Peran     | Kenapa                                                                     |
| --------------------- | --------------- | --------- | -------------------------------------------------------------------------- |
| `next`                | **16.3.5**      | Framework | App Router, Server Actions, nested layout, route groups, `after()`, PPR    |
| `react` / `react-dom` | **19.3.0**      | UI        | `useActionState`, `useOptimistic`, `useFormStatus` — dipakai penuh di form |
| `typescript`          | **5.x terbaru** | Tipe      | `strict: true`, **`noUncheckedIndexedAccess: true`**                       |

## 3.3 Styling & UI

| Paket                                                | Versi      | Peran                                                                                  |
| ---------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------- |
| `tailwindcss`                                        | **4.3.3**  | CSS engine. Config di CSS (`@theme`), **bukan** `tailwind.config.js`                   |
| `shadcn` (CLI)                                       | **4.21.0** | Generator komponen. Komponen jadi milik kita di `components/ui/`                       |
| `next-themes`                                        | **0.4.6**  | Dark/Light tanpa flash                                                                 |
| `lucide-react`                                       | **1.45.0** | Ikon — satu-satunya pustaka ikon                                                       |
| `sonner`                                             | **2.0.8**  | Toast                                                                                  |
| `class-variance-authority`, `clsx`, `tailwind-merge` | terbaru    | Varian & penggabungan class                                                            |
| `tw-animate-css`                                     | terbaru    | Utility animasi. Pengganti `tailwindcss-animate` yang **tidak** kompatibel Tailwind v4 |

> Tailwind v4: **tidak ada** `tailwind.config.js`. Token didefinisikan di
> `app/globals.css` dengan `@theme inline`. Lihat [04 — Design System](./04-DESIGN-SYSTEM.md).

## 3.4 Data & Auth

| Paket                                   | Versi      | Peran                    | Catatan                                                                                                                                                            |
| --------------------------------------- | ---------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `postgresql`                            | **16+**    | Database                 | Neon (serverless, branching untuk staging)                                                                                                                         |
| `prisma` / `@prisma/client`             | **7.10.0** | ORM                      | v8 masih RC per 2026-09-14 — **jangan dipakai**. Prisma 7 memakai `prisma.config.ts` dan generator `prisma-client` dengan `output` wajib; verifikasi saat scaffold |
| `better-auth`                           | **1.7.4**  | Autentikasi              | Plugin `admin` memberi role/ban/impersonate — persis kebutuhan Super Admin. Lihat [ADR-002](./adr/ADR-002-better-auth.md)                                          |
| `zod`                                   | **4.6.5**  | Validasi                 | Satu skema dipakai di client & server                                                                                                                              |
| `next-safe-action`                      | **8.7.3**  | Pembungkus Server Action | Type-safe, middleware berantai (auth → rbac → quota → audit)                                                                                                       |
| `@upstash/ratelimit` + `@upstash/redis` | **2.0.8**  | Rate limit               | Sliding window per user & per IP                                                                                                                                   |

## 3.5 Integrasi Eksternal

| Paket / Layanan  | Versi      | Peran                                               |
| ---------------- | ---------- | --------------------------------------------------- |
| `v0-sdk`         | **0.16.7** | AI engine. Dipakai **hanya** di `lib/v0/`           |
| Vercel REST API  | v2/v13     | Deployment, domain, TLS. Dibungkus di `lib/vercel/` |
| `resend`         | **6.28.0** | Email transaksional                                 |
| `@vercel/blob`   | terbaru    | Avatar, logo, aset user                             |
| `@sentry/nextjs` | terbaru    | Error tracking                                      |

## 3.6 Utilitas

| Paket                                | Peran                                                     |
| ------------------------------------ | --------------------------------------------------------- |
| `nuqs` **2.10.1**                    | State di URL (filter, tab, pagination) — bukan `useState` |
| `date-fns` + locale `id`             | Format tanggal Indonesia                                  |
| `react-markdown` + `rehype-sanitize` | Render balasan AI dengan aman                             |

## 3.7 Kualitas & CI

| Paket                                      | Peran            | Gate                                                |
| ------------------------------------------ | ---------------- | --------------------------------------------------- |
| `eslint` + `eslint-config-next`            | Lint             | Wajib lulus di CI                                   |
| `prettier` + `prettier-plugin-tailwindcss` | Format           | Wajib lulus di CI                                   |
| `vitest` + `@testing-library/react`        | Unit & integrasi | Coverage service layer ≥ 70%                        |
| `@playwright/test`                         | E2E              | 5 alur kritis wajib hijau sebelum deploy production |
| `husky` + `lint-staged`                    | Pre-commit       | Lint + format + typecheck                           |

## 3.8 Daftar Larangan

| Dilarang                                            | Alasan                                       | Pakai ini                          |
| --------------------------------------------------- | -------------------------------------------- | ---------------------------------- |
| `pages/` router                                     | Proyek ini App Router murni                  | `app/`                             |
| `getServerSideProps` / `getStaticProps`             | Tidak ada di App Router                      | Async Server Component             |
| Route Handler untuk mutasi CRUD biasa               | Kehilangan type-safety & middleware terpusat | Server Action                      |
| `useEffect` + `fetch` untuk ambil data awal         | Waterfall, tidak perlu                       | Server Component                   |
| Pustaka UI lain (MUI, Chakra, Ant, Bootstrap)       | Menghancurkan konsistensi design system      | shadcn/ui                          |
| Pustaka ikon lain                                   | Bundle membengkak, gaya tidak seragam        | `lucide-react`                     |
| CSS Modules / styled-components / emotion           | Dua sistem styling = kekacauan               | Tailwind + token                   |
| `any` di TypeScript                                 | Menghilangkan seluruh manfaat tipe           | `unknown` + type guard             |
| Warna hardcoded (`bg-[#FF6B00]`, `text-orange-500`) | Merusak dark/light                           | Token semantik (`bg-primary`)      |
| Memanggil `v0-sdk` di luar `lib/v0/`                | Kebocoran anti-corruption layer              | Service memanggil `lib/v0`         |
| State server disimpan di `useState`                 | Sumber kebenaran ganda                       | Server Component + `nuqs`          |
| `localStorage` untuk data penting                   | Hilang, tidak tersinkron                     | Database                           |
| Query tanpa filter `userId`                         | Kebocoran data antar-user                    | Selalu sertakan pemilik di `where` |
| `console.log` di kode production                    | Tidak terstruktur, bocor data                | `lib/logger`                       |

## 3.9 Struktur Folder Wajib

```
sacms/
├── prisma/
│   ├── schema.prisma
│   ├── migrations/
│   └── seed.ts
├── prisma.config.ts
├── src/
│   ├── app/                    # rute saja — lihat dokumen 05
│   ├── actions/                # Server Actions ("use server")
│   ├── services/               # logika bisnis (murni, dapat diuji)
│   ├── lib/
│   │   ├── db.ts               # singleton Prisma
│   │   ├── auth.ts             # config Better Auth
│   │   ├── auth-guard.ts       # requireUser / requireSuperAdmin
│   │   ├── safe-action.ts      # klien next-safe-action + middleware
│   │   ├── logger.ts
│   │   ├── ratelimit.ts
│   │   ├── v0/                 # ACL ke v0 — SATU-SATUNYA tempat import v0-sdk
│   │   └── vercel/             # ACL ke Vercel API
│   ├── components/
│   │   ├── ui/                 # shadcn — jangan diedit manual kecuali terencana
│   │   ├── layout/             # sidebar, topbar, nav
│   │   └── features/           # komponen per domain
│   ├── schemas/                # skema Zod (dipakai bersama client & server)
│   ├── types/
│   └── config/                 # konstanta: plan, tipe website, langkah build
├── e2e/
├── docs/                       # dokumen ini
└── CLAUDE.md
```

Aturan: sebuah komponen tinggal di `app/` hanya jika ia adalah file rute
(`page`, `layout`, `loading`, `error`, `not-found`, `route`, `default`, `template`).
Selain itu tinggal di `components/`.
