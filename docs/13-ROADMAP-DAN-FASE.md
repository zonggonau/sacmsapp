# 13 — Roadmap & Fase Pengembangan

## 13.1 Aturan Fase

> **Satu fase dikerjakan sampai selesai. Fase berikutnya tidak dibuka sebelum
> Definition of Done fase sekarang terpenuhi seluruhnya.**

Kenapa aturan ini ada: proyek yang mengerjakan lima hal setengah jadi secara bersamaan
akan terlihat produktif selama enam minggu, lalu tidak punya satu pun alur yang benar-benar
bekerja. Aturan ini adalah pertahanan utama terhadap "keluar dari jalur pengembangan".

Bila muncul ide di tengah fase: tulis di `docs/BACKLOG.md`, **jangan kerjakan**.

## 13.2 Ringkasan Fase

| Fase | Nama                | Durasi    | Hasil yang bisa ditunjukkan                               |
| ---- | ------------------- | --------- | --------------------------------------------------------- |
| 0    | Fondasi & Setup     | 3–4 hari  | Aplikasi kosong berjalan di Vercel dengan tema SaCMS      |
| 1    | Auth & App Shell    | 5–6 hari  | Bisa daftar, masuk, melihat dashboard kosong              |
| 2    | Project CRUD        | 4–5 hari  | Bisa buat, lihat, ubah nama, hapus project (belum ada AI) |
| 3    | AI Builder Core     | 8–10 hari | **Prompt → website ter-generate → pratinjau tampil**      |
| 4    | Deploy & Domain     | 5–6 hari  | **Website hidup di URL publik**                           |
| 5    | Super Admin         | 5–6 hari  | Pemilik bisa mengendalikan seluruh sistem                 |
| 6    | Kuota & Paket       | 3–4 hari  | Batas berlaku, kredit terhitung, biaya terlihat           |
| 7    | Hardening & Go-Live | 5–7 hari  | **Production**                                            |

Total: **8–10 minggu** untuk satu pengembang penuh waktu.
Fase 3 dan 4 adalah inti produk — jangan dipercepat dengan mengorbankan Fase 0–2.

---

## FASE 0 — Fondasi & Setup

**Tujuan:** semua keputusan teknis terpasang, sehingga tidak ada lagi perdebatan alat di
tengah pengembangan fitur.

Pekerjaan:

1. `pnpm create next-app` — TypeScript, Tailwind v4, App Router, `src/`
2. Kunci versi: `.nvmrc`, `engines`, `packageManager`
3. `tsconfig.json` — `strict`, `noUncheckedIndexedAccess`, alias `@/*`
4. ESLint + Prettier + `prettier-plugin-tailwindcss` + Husky + lint-staged
5. `globals.css` lengkap sesuai [04 §4.4](./04-DESIGN-SYSTEM.md) — **token final, bukan sementara**
6. `shadcn init` + pasang komponen Fase 0 ([04 §4.8](./04-DESIGN-SYSTEM.md))
7. `next-themes` + `ThemeProvider` + tombol toggle
8. Neon: database `dev` dan `staging`
9. Prisma init + skema lengkap [06](./06-DATABASE-SCHEMA.md) + migrasi awal + seed
10. `lib/db.ts`, `lib/env.ts`, `lib/logger.ts`, `lib/errors.ts`, `lib/utils.ts`
11. Struktur folder lengkap sesuai [03 §3.9](./03-STACK-DAN-VERSI.md) (folder kosong + `.gitkeep`)
12. GitHub repo, branch `main`/`develop`, CI: lint + typecheck + build
13. Deploy pertama ke Vercel (staging)

**Definition of Done:**

- [ ] `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm typecheck` semua lulus
- [ ] Halaman contoh menampilkan tombol/kartu/badge dengan warna SaCMS yang benar
- [ ] Toggle dark/light bekerja **tanpa flash** saat muat ulang
- [ ] `prisma studio` menampilkan seluruh tabel; seed menghasilkan 3 plan + 1 super admin
- [ ] Staging dapat dibuka publik
- [ ] CI hijau pada PR

---

## FASE 1 — Auth & App Shell

**Tujuan:** identitas dan kerangka aplikasi selesai total. Tidak akan disentuh lagi.

Pekerjaan:

1. Better Auth sesuai [07 §7.2](./07-AUTH-DAN-RBAC.md), termasuk `input: false`
2. Route handler `/api/auth/[...all]`
3. Halaman `(auth)`: masuk, daftar, lupa sandi, atur sandi, verifikasi email
4. Google OAuth
5. Email lewat Resend: verifikasi, reset sandi (template hitam-oranye)
6. `middleware.ts` + `lib/auth-guard.ts` (empat lapis, [07 §7.4](./07-AUTH-DAN-RBAC.md))
7. `lib/safe-action.ts` — rantai middleware lengkap ([08 §8.3](./08-SERVER-ACTIONS.md))
8. `lib/ratelimit.ts` + Upstash
9. `AppShell`: sidebar, topbar, menu pengguna, toggle tema, skip-to-content
10. Halaman dashboard (masih kosong), `loading.tsx`, `error.tsx`, `not-found.tsx`, `forbidden.tsx`
11. Halaman `/akun/profil`, `/akun/keamanan`
12. `services/audit.service.ts` + pencatatan pada aksi auth
13. Sentry

**Definition of Done:**

- [ ] Daftar → terima email → verifikasi → masuk → dashboard, tanpa hambatan
- [ ] Google OAuth bekerja
- [ ] Reset sandi bekerja penuh; sesi lama tercabut setelah ganti sandi
- [ ] `/dashboard` tanpa sesi → redirect ke `/masuk?lanjut=/dashboard`, dan kembali ke tujuan setelah masuk
- [ ] `/masuk` dengan sesi → redirect ke `/dashboard`
- [ ] Rate limit terbukti: 6 kali gagal masuk → diblokir
- [ ] Kirim `role: "SUPER_ADMIN"` saat daftar → **diabaikan** (uji manual, wajib)
- [ ] Sidebar aktif memakai pola oranye yang benar
- [ ] Semua teks bahasa Indonesia

---

## FASE 2 — Project CRUD

**Tujuan:** seluruh siklus hidup project bekerja — **sebelum** AI masuk. Ini membuat
Fase 3 hanya perlu memikirkan AI.

Pekerjaan:

1. `services/project.service.ts`
2. `actions/project.actions.ts`: create, rename, archive, delete, duplicate
3. `schemas/project.schema.ts`
4. `config/website-types.ts` — 12 tipe dengan `requirements` lengkap ([09 §9.6](./09-AI-BUILDER-PIPELINE.md))
5. `/projects` — grid kartu + filter/pencarian via `nuqs` + empty state
6. `/projects/baru` + `@modal/(.)baru` (parallel + intercepting)
7. `/projects/[projectId]/layout.tsx` + tab nav
8. Halaman ringkasan project
9. `/projects/[projectId]/pengaturan` — ubah nama, hapus (ketik-untuk-yakin)
10. Dashboard: kartu statistik + project terbaru
11. Skeleton yang meniru bentuk akhir

**Definition of Done:**

- [ ] Buat project dengan prompt tersimpan (status `DRAFT`, belum ada AI)
- [ ] Dialog dari `/projects` dan halaman penuh dari URL langsung — keduanya bekerja, form-nya satu komponen
- [ ] Refresh saat dialog terbuka → halaman penuh, bukan 404
- [ ] Pengguna A membuka project pengguna B → 404
- [ ] Filter & pencarian tersimpan di URL dan bertahan saat refresh
- [ ] Empty state, loading state, error state ada di semua daftar
- [ ] Tombol Back browser berperilaku benar di seluruh alur

---

## FASE 3 — AI Builder Core (inti produk)

**Tujuan:** prompt menjadi website yang bisa dilihat.

Pekerjaan:

1. `lib/v0/client.ts` — ACL dengan tipe milik SaCMS
2. **`lib/v0/mock.ts`** — implementasi tiruan. **Kerjakan ini duluan**, sebelum integrasi nyata
3. `lib/v0/system-prompt.ts` + `sanitizeUserPrompt()`
4. `config/build-steps.ts` — 10 langkah + bobot
5. `services/build.service.ts` — orkestrator, `step()`, `withRetry()`, klasifikasi kegagalan
6. `services/planner.service.ts` — prompt → spesifikasi JSON
7. `actions/builder.actions.ts` — sendMessage, getBuildStatus, cancel, retry
8. Integrasi `after()` untuk menjalankan pipeline
9. `/projects/[projectId]/builder` + layout split
10. `BuildProgress` — polling 2 detik, berhenti saat final/tab tersembunyi
11. `BuilderChat` — riwayat pesan, `useOptimistic`, auto-scroll
12. `PreviewFrame` — iframe sandbox + tombol desktop/tablet/ponsel
13. Riwayat versi + `restoreVersion`
14. Email "website Anda sudah siap"
15. Cron penyapu job nyangkut

**Definition of Done:**

- [ ] Dengan `V0_MOCK=true`: seluruh pipeline berjalan, 10 langkah berubah status, progres naik
- [ ] Dengan v0 nyata: prompt "Buat website sekolah SMA di Jayapura" menghasilkan website yang bisa dilihat
- [ ] Pesan lanjutan menghasilkan versi baru pada chat v0 yang sama
- [ ] Progres tidak pernah macet; `GENERATE` menyumbang porsi bobot terbesar
- [ ] Batalkan build → status `CANCELLED`, kredit kembali
- [ ] Simulasi kegagalan v0 → retry 3× → `FAILED` + pesan Indonesia + tombol Ulangi
- [ ] Job melewati timeout → disapu cron → `FAILED` + refund
- [ ] Pratinjau tampil di iframe `sandbox`
- [ ] Prompt berisi "abaikan instruksi sebelumnya" tidak mengubah perilaku sistem
- [ ] Tidak ada import `v0-sdk` di luar `lib/v0/`

---

## FASE 4 — Deploy & Domain

**Tujuan:** website benar-benar hidup di internet.

Pekerjaan:

1. `lib/vercel/client.ts` — ACL
2. `services/deploy.service.ts`
3. `actions/deploy.actions.ts` — deploy, rollback
4. Langkah `DEPLOY` di pipeline
5. Webhook `/api/webhooks/vercel` + verifikasi signature
6. `/projects/[projectId]/deployment` — riwayat, status, log, rollback
7. `services/domain.service.ts` + `actions/domain.actions.ts`
8. `/projects/[projectId]/domain` — tambah, instruksi DNS dengan tombol salin, verifikasi
9. Panduan DNS untuk Niagahoster, Rumahweb, Domainesia, Cloudflare
10. Cron verifikasi domain (10 menit, 24 jam)
11. Kartu project menampilkan status live + URL

**Definition of Done:**

- [ ] Terbitkan → URL `*.vercel.app` dapat dibuka dari perangkat lain
- [ ] Deploy gagal → production lama **tetap hidup**, pengguna melihat pesan yang jelas
- [ ] Rollback mengembalikan versi sebelumnya
- [ ] Tambah domain menampilkan rekaman DNS yang benar dan dapat disalin
- [ ] Domain terverifikasi menjadi `ACTIVE` dengan HTTPS
- [ ] Webhook dengan signature salah → ditolak
- [ ] **Alur penuh: daftar → prompt → generate → pratinjau → terbitkan → buka di ponsel**

---

## FASE 5 — Super Admin

**Tujuan:** pemilik memegang kendali penuh.

Pekerjaan: seluruh isi [10 — Super Admin](./10-SUPER-ADMIN.md) — layout `(admin)`,
ringkasan sistem, pengguna + detail investigasi, project, build + detail timeline, paket,
AI & model + kill switch, sistem + maintenance, audit log.

**Definition of Done:**

- [ ] `USER` membuka `/admin` → 403
- [ ] `USER` memanggil action admin lewat DevTools → ditolak
- [ ] Ubah paket pengguna → kuota berlaku seketika
- [ ] Tangguhkan pengguna → sesi tercabut, tidak bisa masuk
- [ ] Impersonasi → banner tampil, aksi destruktif diblokir, audit mulai & selesai tercatat
- [ ] Kill switch menyala → generate ditolak dengan pesan sopan
- [ ] Maintenance mode → pengguna biasa melihat halaman pemberitahuan, admin tetap masuk
- [ ] Detail build menampilkan `rawError`, prompt lengkap, dan `correlationId`
- [ ] Audit mencatat **setiap** aksi admin; tidak ada cara menghapusnya dari UI
- [ ] Super Admin terakhir tidak bisa menurunkan dirinya sendiri
- [ ] Checklist [07 §7.8](./07-AUTH-DAN-RBAC.md) lulus seluruhnya

---

## FASE 6 — Kuota, Paket & Biaya

Pekerjaan: `services/quota.service.ts` (reserve/commit/refund dengan penguncian baris),
pemasangan di middleware action, tampilan kuota di topbar + `/akun/paket`, penegakan
batas project/domain/deploy, cron reset periode, cron refund reservasi tertinggal,
cron rekonsiliasi biaya, metrik biaya di `/admin`, notifikasi kuota menipis.

**Definition of Done:**

- [ ] Free habis kuota → generate ditolak dengan tawaran upgrade
- [ ] Build gagal → kredit **kembali** (diverifikasi di database)
- [ ] Dua permintaan bersamaan pada kredit terakhir → hanya satu lolos
- [ ] Free mencoba project kedua → ditolak dengan pesan jelas
- [ ] Reset periode bekerja; `periodStartedAt` maju 30 hari
- [ ] Super Admin menaikkan kuota satu pengguna → berlaku tanpa deploy
- [ ] `/admin` menampilkan biaya rata-rata per website jadi

---

## FASE 7 — Hardening & Go-Live

Pekerjaan:

1. Landing page `(marketing)` + halaman harga + Syarat & Privasi
2. Uji E2E Playwright — 5 alur kritis (§13.3)
3. Uji unit service layer ≥ 70%
4. Audit aksesibilitas (kontras, keyboard, screen reader, `prefers-reduced-motion`)
5. Kinerja: Lighthouse ≥ 90, LCP < 2,5 dtk, CLS < 0,1
6. CSP dengan nonce
7. Uji beban: 50 build bersamaan
8. **Uji pemulihan database dari cadangan** — bukan sekadar memastikan cadangan ada
9. SSE menggantikan polling (opsional)
10. Seluruh checklist [12 §12.8](./12-KEAMANAN.md) dan [14](./14-DEPLOYMENT-GO-LIVE.md)
11. Uji beta dengan 5 pengguna nyata non-teknis

**Definition of Done:**

- [ ] 5 alur E2E hijau di CI
- [ ] Lighthouse ≥ 90 di landing dan dashboard
- [ ] Checklist keamanan lulus seluruhnya
- [ ] Pemulihan database terbukti berhasil
- [ ] 5 penguji beta berhasil membuat website live **tanpa bantuan**
- [ ] Runbook insiden tertulis dan dapat dijalankan dari `/admin`

## 13.3 Lima Alur E2E Wajib

1. **Daftar → verifikasi → masuk → dashboard**
2. **Buat project → generate → pratinjau tampil**
3. **Edit lewat prompt → versi baru → terbitkan → URL publik hidup**
4. **Batas kuota ditegakkan → pesan upgrade muncul**
5. **Super Admin: tangguhkan pengguna → pengguna tidak bisa masuk → audit tercatat**

Kelimanya berjalan dengan `V0_MOCK=true` di CI agar cepat, deterministik, dan tidak
membakar kredit. Satu uji _smoke_ terhadap v0 nyata dijalankan manual sebelum setiap
rilis production.

## 13.4 Setelah v1.0

| Versi | Isi                                                                     |
| ----- | ----------------------------------------------------------------------- |
| v1.1  | Workspace & tim, pembayaran Midtrans, UI peran `ADMIN`, 2FA super admin |
| v1.2  | Marketplace template, i18n, analitik pengunjung situs hasil             |
| v2.0  | CMS SaCMS (content type builder, media library), MCP server, API publik |

Tidak ada satu pun dari daftar ini yang boleh menyusup ke v1.0.
