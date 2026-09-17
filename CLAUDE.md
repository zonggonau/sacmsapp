# CLAUDE.md — Guardrail Pengembangan SaCMS

> Berkas ini dibaca otomatis oleh Claude Code di setiap sesi, dan wajib dibaca setiap
> pengembang sebelum menulis baris pertama. Tujuannya satu: **menjaga pengembangan tetap
> di jalur yang sudah dirancang.**

## Sebelum Menulis Kode — Selalu

1. Buka [`docs/00-INDEX.md`](./docs/00-INDEX.md), lihat **fase yang sedang berjalan**.
2. Kerjakan **hanya** yang ada di fase itu ([`docs/13`](./docs/13-ROADMAP-DAN-FASE.md)).
3. Baca dokumen teknis yang relevan sebelum membuat keputusan desain apa pun.
4. Kalau dokumen tidak menjawab pertanyaanmu: **tanyakan, jangan tebak.** Jawabannya lalu
   ditulis ke dokumen.

## Tiga Aturan yang Tidak Bisa Ditawar

**1. Dokumen adalah sumber kebenaran.**
Kalau kode berbeda dari dokumen, salah satunya salah. Perbaiki di PR yang sama — jangan
biarkan keduanya berbeda.

**2. Keputusan arsitektur lewat ADR.**
Mengganti pustaka, mengubah lapisan, mengubah pola data → tulis ADR baru di
[`docs/adr/`](./docs/adr/) dan minta persetujuan **sebelum** mengerjakannya. Tidak ada
"sambil jalan kita ubah saja".

**3. Fase dikerjakan sampai selesai.**
Definition of Done fase berjalan harus terpenuhi **seluruhnya** sebelum fase berikutnya
dibuka. Ide yang muncul di tengah jalan ditulis ke [`docs/BACKLOG.md`](./docs/BACKLOG.md),
tidak dikerjakan.

## Konteks Proyek (30 detik)

**SaCMS** — pengguna mengetik satu prompt bahasa Indonesia, mendapat website Next.js yang
hidup di URL publik, tanpa menyentuh kode.

- **SaCMS** = platform SaaS (yang kita bangun)
- **v0 Platform API** = mesin AI (kita pakai, **tidak** kita bangun)
- **Vercel** = build, hosting, domain (kita pakai)

## Stack Terkunci

`Next.js 16.3.5` · `React 19.3.0` · `TypeScript strict` · `Tailwind 4.3.3` · `shadcn/ui`
`PostgreSQL (Neon)` · `Prisma 7.10.0` · `Better Auth 1.7.4` · `Zod 4.6.5`
`next-safe-action 8.7.3` · `v0-sdk 0.16.7` · `pnpm 10` · `Node 24`

Menaikkan versi mayor apa pun = butuh ADR.
Detail & alasan: [`docs/03`](./docs/03-STACK-DAN-VERSI.md).

## Arsitektur Lapisan — Hafalkan

```
UI (Server Component)  ->  Service          (baca)
UI (Client Component)  ->  Server Action    (mutasi)
Server Action          ->  Service
Service                ->  lib/db, lib/v0, lib/vercel
lib/*                  ->  PostgreSQL, API vendor
```

Setiap lapisan **hanya** memanggil lapisan di bawahnya. Tidak ada lompatan.

- Server Action **tidak** berisi logika bisnis → panggil service.
- Service **tidak** memanggil `revalidatePath` / `redirect` / `cookies()` → itu tugas action.
- Hanya `lib/v0/` yang boleh mengimpor `v0-sdk`. Tanpa pengecualian.

## Design System — Ringkas

- Dark adalah **default** dan identitas. Latar dark = `#212121` (keputusan pemilik 2026-09-16);
  kedalaman dari surface yang lebih terang + border.
- Aksen tunggal: oranye `#FF6B00`. Satu elemen oranye per layar.
- **Teks di atas oranye WAJIB hitam.** Putih di atas oranye gagal kontras (2.9:1).
- Teks oranye: pakai `text-primary-text` (otomatis `#FFA274` di dark, `#C24A00` di light).
- Kedalaman dibentuk **border + surface**, bukan shadow.
- **Dilarang** warna hardcoded (`bg-[#FF6B00]`, `text-orange-500`) → pakai token semantik.

Lengkap: [`docs/04`](./docs/04-DESIGN-SYSTEM.md).

## Daftar Larangan

| Jangan                                   | Pakai                                    |
| ---------------------------------------- | ---------------------------------------- |
| `pages/` router                          | `app/`                                   |
| Route Handler untuk CRUD                 | Server Action                            |
| `useEffect` + `fetch` untuk data awal    | Server Component                         |
| `"use client"` di halaman                | Dorong ke komponen terkecil              |
| Pustaka UI lain (MUI, Chakra, Ant)       | shadcn/ui                                |
| Pustaka ikon lain                        | `lucide-react`                           |
| CSS Modules / styled-components          | Tailwind + token                         |
| `any`                                    | `unknown` + type guard                   |
| `console.log`                            | `lib/logger`                             |
| `useState` untuk filter/tab/pagination   | `nuqs` (state di URL)                    |
| Query tanpa `userId` di `where`          | Selalu sertakan pemilik                  |
| `throw new Error("...")`                 | `AppError` dengan kode + pesan Indonesia |
| Objek Prisma mentah sebagai hasil action | DTO eksplisit                            |
| Teks UI bahasa Inggris                   | Bahasa Indonesia                         |

## Pola Wajib

**Query kepemilikan** — kepemilikan ada **di dalam** query, bukan dicek setelahnya:

```ts
const project = await db.project.findFirst({
  where: { id, userId: user.id, deletedAt: null },
});
if (!project) notFound();
```

**Server Action** — selalu lewat `authActionClient`, selalu `metadata`:

```ts
export const doSomething = authActionClient
  .metadata({ actionName: "domain.verb", audit: true })
  .inputSchema(someSchema)
  .action(async ({ parsedInput, ctx }) => {
    /* panggil service */
  });
```

**Action admin** — wajib `requireRole` **dan** `audit: true`. Tanpa keduanya = bug.

**Kerja panjang** — masuk `after()`, jangan ditunggu di dalam action.

## Bahasa & Pesan

- Seluruh UI, komentar kode, dan pesan commit: **bahasa Indonesia**.
- Nama variabel, fungsi, dan tipe: bahasa Inggris (konvensi kode).
- Pesan error = **apa yang terjadi + apa yang bisa dilakukan**.
  Buruk: `Error: 429`. Baik: "AI sedang sibuk. Coba lagi dalam 1 menit." + tombol.
- Tidak ada kode HTTP, nama tabel, atau stack trace yang sampai ke layar pengguna.

## Sebelum Membuka PR

- [ ] `pnpm lint` · `pnpm typecheck` · `pnpm build` lulus
- [ ] Tidak ada `console.log`, `any`, atau `@ts-ignore` baru
- [ ] Dark **dan** light keduanya sudah dilihat
- [ ] Responsif dicek di 360px
- [ ] Loading, empty, dan error state ada
- [ ] Semua teks bahasa Indonesia
- [ ] Query milik user menyertakan `userId`
- [ ] Action baru punya `metadata` lengkap
- [ ] Dokumen diperbarui bila perilaku berubah
- [ ] Definition of Done fase terkait masih terpenuhi

## Kalau Ragu

| Situasi                             | Lakukan                                 |
| ----------------------------------- | --------------------------------------- |
| Dokumen tidak menjawab              | Tanya, lalu tulis jawabannya ke dokumen |
| Dokumen terasa salah                | Bilang. Jangan diam-diam menyimpang     |
| Ada ide bagus di luar fase          | Tulis ke `docs/BACKLOG.md`              |
| Butuh pustaka baru                  | Tulis ADR dulu                          |
| Tergoda "cepat dulu, rapikan nanti" | Jangan. "Nanti" tidak pernah datang     |

---

**Ringkasnya: baca dokumen, kerjakan fase yang sedang berjalan, jangan menyimpang diam-diam.**

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
