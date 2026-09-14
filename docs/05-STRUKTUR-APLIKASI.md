# 05 — Struktur Aplikasi Next.js 16

## 5.1 Peta Rute Lengkap

```
src/app/
├── layout.tsx                      # ROOT: <html lang="id">, font, ThemeProvider, Toaster
├── globals.css                     # token design system (dok 04)
├── not-found.tsx
├── error.tsx                       # error boundary global
├── manifest.ts  robots.ts  sitemap.ts
│
├── (marketing)/                    # GRUP 1 — publik, static/ISR
│   ├── layout.tsx                  # header publik + footer
│   ├── page.tsx                    # landing: hero + input prompt besar
│   ├── harga/page.tsx
│   ├── fitur/page.tsx
│   └── legal/[slug]/page.tsx       # syarat, privasi
│
├── (auth)/                         # GRUP 2 — kartu terpusat, tanpa nav
│   ├── layout.tsx                  # redirect ke /dashboard jika SUDAH login
│   ├── masuk/page.tsx
│   ├── daftar/page.tsx
│   ├── lupa-sandi/page.tsx
│   ├── atur-sandi/page.tsx
│   └── verifikasi-email/page.tsx
│
├── (app)/                          # GRUP 3 — area pengguna terautentikasi
│   ├── layout.tsx                  # GUARD sesi + AppShell (sidebar + topbar)
│   ├── template.tsx                # animasi transisi antar-halaman
│   │
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── loading.tsx
│   │
│   ├── projects/
│   │   ├── layout.tsx              # header daftar + tombol "Project Baru"
│   │   ├── page.tsx                # grid kartu project
│   │   ├── loading.tsx
│   │   ├── @modal/                 # PARALLEL ROUTE
│   │   │   ├── default.tsx         # null
│   │   │   └── (.)baru/page.tsx    # INTERCEPTING: dialog "Project Baru"
│   │   ├── baru/page.tsx           # halaman penuh (akses langsung/refresh)
│   │   │
│   │   └── [projectId]/
│   │       ├── layout.tsx          # NESTED: ambil project, cek pemilik, tab nav
│   │       ├── error.tsx
│   │       ├── not-found.tsx
│   │       ├── page.tsx            # Ringkasan
│   │       ├── builder/
│   │       │   ├── layout.tsx      # NESTED: split chat | preview
│   │       │   ├── page.tsx
│   │       │   └── loading.tsx
│   │       ├── deployment/page.tsx
│   │       ├── domain/page.tsx
│   │       └── pengaturan/page.tsx
│   │
│   └── akun/
│       ├── layout.tsx              # NESTED: sidebar pengaturan akun
│       ├── profil/page.tsx
│       ├── keamanan/page.tsx
│       ├── paket/page.tsx          # plan & kuota terpakai
│       └── notifikasi/page.tsx
│
├── (admin)/                        # GRUP 4 — panel pemilik sistem
│   ├── layout.tsx                  # GUARD requireSuperAdmin + AdminShell
│   └── admin/
│       ├── page.tsx                # ringkasan sistem
│       ├── pengguna/
│       │   ├── page.tsx
│       │   └── [userId]/page.tsx
│       ├── project/
│       │   ├── page.tsx
│       │   └── [projectId]/page.tsx
│       ├── build/
│       │   ├── page.tsx
│       │   └── [jobId]/page.tsx    # timeline langkah + log mentah
│       ├── paket/page.tsx          # CRUD Plan & batas kuota
│       ├── ai/page.tsx             # model aktif, system prompt, kill switch
│       ├── sistem/page.tsx         # maintenance mode, feature flag
│       └── audit/page.tsx
│
└── api/                            # Route Handler HANYA untuk kasus non-Server-Action
    ├── auth/[...all]/route.ts      # handler Better Auth (wajib)
    ├── webhooks/vercel/route.ts    # webhook masuk (wajib, verifikasi signature)
    ├── builds/[jobId]/stream/route.ts   # SSE progres build
    └── cron/
        ├── sweep-stuck-jobs/route.ts
        └── sync-deployments/route.ts
```

## 5.2 Kenapa Empat Route Group

Route group `(nama)` **tidak** memengaruhi URL. Fungsinya memberi tiap area layout dan
aturan aksesnya sendiri.

| Grup          | URL                           | Layout                       | Guard                      | Rendering            |
| ------------- | ----------------------------- | ---------------------------- | -------------------------- | -------------------- |
| `(marketing)` | `/`, `/harga`                 | Header publik + footer       | Tidak ada                  | Static + ISR         |
| `(auth)`      | `/masuk`, `/daftar`           | Kartu terpusat, tanpa nav    | Tolak jika **sudah** login | Dynamic              |
| `(app)`       | `/dashboard`, `/projects/...` | Sidebar + topbar             | `requireUser()`            | Dynamic              |
| `(admin)`     | `/admin/...`                  | Shell admin (visual berbeda) | `requireSuperAdmin()`      | Dynamic, tanpa cache |

> `(app)` dan `(admin)` sengaja dipisah agar **mustahil** sebuah halaman admin tanpa
> sengaja mewarisi layout pengguna biasa dan melewati pemeriksaan role. Guard tinggal di
> layout grup, bukan ditempel satu per satu di setiap halaman.

## 5.3 Hierarki Nested Layout

```
app/layout.tsx                                   <- html, font, tema, Toaster
  └─ (app)/layout.tsx                            <- sesi, sidebar, topbar
       └─ projects/layout.tsx                    <- judul daftar, tombol Project Baru
            └─ projects/[projectId]/layout.tsx   <- muat project, cek pemilik, tab nav
                 └─ builder/layout.tsx           <- panel split chat | preview
                      └─ builder/page.tsx        <- isi
```

Keuntungan nyata: saat pengguna berpindah dari **Ringkasan** ke **Builder**, sidebar,
topbar, dan header project **tidak di-render ulang** dan **tidak berkedip**. Hanya isi
terdalam yang berubah.

### `(app)/layout.tsx` — gerbang tunggal

```tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-guard";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session) redirect("/masuk");
  if (session.user.status === "SUSPENDED") redirect("/akun-ditangguhkan");

  return <AppShell user={session.user}>{children}</AppShell>;
}
```

### `[projectId]/layout.tsx` — pemilik diperiksa sekali

```tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth-guard";
import { getProjectForUser } from "@/services/project.service";
import { ProjectHeader } from "@/components/features/project/project-header";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>; // Next.js 16: params adalah Promise
}) {
  const { projectId } = await params;
  const user = await requireUser();

  // Kepemilikan ditegakkan di dalam query, bukan dicek setelahnya
  const project = await getProjectForUser(projectId, user.id);
  if (!project) notFound();

  return (
    <div className="flex h-full flex-col">
      <ProjectHeader project={project} />
      <div className="flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
```

> **Next.js 16:** `params` dan `searchParams` adalah `Promise` dan wajib di-`await`.
> Begitu juga `cookies()`, `headers()`, dan `draftMode()`.

## 5.4 Parallel + Intercepting Routes — Dialog "Project Baru"

Tujuan: klik "Project Baru" di `/projects` membuka **dialog** tanpa meninggalkan halaman;
tapi membuka `/projects/baru` langsung (atau me-refresh) menampilkan **halaman penuh**.

```
projects/
├── layout.tsx          -> menerima props { children, modal }
├── page.tsx
├── baru/page.tsx       -> halaman penuh
└── @modal/
    ├── default.tsx     -> return null  (WAJIB, kalau tidak akan 404 saat refresh)
    └── (.)baru/page.tsx-> dialog, memakai komponen form yang sama
```

```tsx
// projects/layout.tsx
export default function ProjectsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
```

Aturan: **form-nya satu komponen** (`components/features/project/create-project-form.tsx`),
dipakai oleh halaman penuh dan dialog. Jangan menduplikasi form.

## 5.5 Streaming, Loading, Error

Setiap segmen yang mengambil data wajib punya tetangga ini:

| File            | Isi                                                       | Wajib di                                          |
| --------------- | --------------------------------------------------------- | ------------------------------------------------- |
| `loading.tsx`   | Skeleton yang **meniru bentuk akhir** (bukan spinner)     | dashboard, projects, builder, semua halaman admin |
| `error.tsx`     | `"use client"`, pesan bahasa Indonesia + tombol `reset()` | `(app)`, `[projectId]`, `(admin)`                 |
| `not-found.tsx` | "Project tidak ditemukan" + tautan kembali                | `[projectId]`                                     |
| `default.tsx`   | `return null`                                             | setiap slot parallel route                        |

Pola streaming pada halaman gabungan:

```tsx
export default async function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Tampil instan - tidak menunggu data */}
      <PageHeader title="Dashboard" />

      <Suspense fallback={<StatsSkeleton />}>
        <UsageStats /> {/* query sendiri */}
      </Suspense>

      <Suspense fallback={<ProjectGridSkeleton />}>
        <RecentProjects /> {/* query sendiri, paralel dengan di atas */}
      </Suspense>
    </div>
  );
}
```

Larangan: **jangan** mengambil semua data di komponen induk lalu mengoper ke bawah — itu
menciptakan satu titik tunggu tunggal dan membuang manfaat streaming.

## 5.6 Batas Server vs Client Component

Default: **Server Component**. `"use client"` hanya jika salah satu berlaku:

- Butuh `useState` / `useReducer` / `useEffect` / `useRef`
- Butuh event handler (`onClick`, `onChange`, `onSubmit`)
- Butuh API browser (`window`, `localStorage`, `IntersectionObserver`)
- Memakai `useActionState`, `useOptimistic`, `useFormStatus`
- Memakai pustaka yang di dalamnya memanggil hal di atas

Aturan dorong ke bawah (_push client down_):

```tsx
// SALAH - seluruh halaman jadi client hanya karena satu tombol
"use client";
export default function ProjectPage() { ... }

// BENAR - halaman tetap server, hanya tombol yang client
export default async function ProjectPage() {
  const project = await getProject();
  return (
    <>
      <ProjectInfo project={project} />     {/* server */}
      <DeployButton projectId={project.id} /> {/* "use client" */}
    </>
  );
}
```

Peta komponen client yang diizinkan di MVP:

| Komponen                                  | Alasan                               |
| ----------------------------------------- | ------------------------------------ |
| `theme-toggle`                            | `useTheme`                           |
| `create-project-form`                     | `useActionState`                     |
| `builder-chat`                            | state pesan, auto-scroll, optimistic |
| `build-progress`                          | polling / SSE                        |
| `preview-frame`                           | kontrol iframe, tombol viewport      |
| `data-table-toolbar`                      | `nuqs` untuk filter                  |
| `confirm-dialog`                          | state buka/tutup                     |
| `copy-button`, `sidebar-nav`, `user-menu` | interaksi                            |

## 5.7 State di URL, bukan di `useState`

Filter, pencarian, tab, dan pagination **wajib** memakai `nuqs` sehingga tersimpan di URL.
Alasan: bisa dibagikan, bisa di-bookmark, tombol Back berfungsi, dan halaman tetap Server
Component.

```tsx
// components/features/project/project-filters.tsx
"use client";
import { useQueryStates, parseAsString, parseAsStringLiteral } from "nuqs";

const STATUS = ["all", "draft", "building", "live", "failed"] as const;

export function ProjectFilters() {
  const [{ q, status }, setFilters] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      status: parseAsStringLiteral(STATUS).withDefault("all"),
    },
    { shallow: false },
  ); // shallow:false -> server re-fetch
  // ...
}
```

## 5.8 Konvensi Penamaan

| Hal           | Konvensi              | Contoh                           |
| ------------- | --------------------- | -------------------------------- |
| Segmen rute   | Indonesia, kebab-case | `lupa-sandi`, `pengaturan`       |
| File komponen | kebab-case            | `create-project-form.tsx`        |
| Nama komponen | PascalCase            | `CreateProjectForm`              |
| Server Action | camelCase, kata kerja | `createProject`, `deployProject` |
| File action   | `{domain}.actions.ts` | `project.actions.ts`             |
| File service  | `{domain}.service.ts` | `build.service.ts`               |
| Skema Zod     | `{nama}Schema`        | `createProjectSchema`            |
| Konstanta     | SCREAMING_SNAKE       | `BUILD_STEPS`                    |
| Enum Prisma   | SCREAMING_SNAKE       | `ProjectStatus.LIVE`             |

> URL berbahasa Indonesia (`/masuk`, `/projects/[projectId]/pengaturan`) karena target
> pengguna Indonesia. Kata `projects` dan `admin` dipertahankan karena sudah umum.

## 5.9 Metadata & SEO

```tsx
// (marketing)/layout.tsx
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL!),
  title: { default: "SaCMS — Buat Website dengan AI", template: "%s | SaCMS" },
  description: "Ketik satu kalimat, dapatkan website siap pakai. Tanpa koding.",
  openGraph: { locale: "id_ID", type: "website", siteName: "SaCMS" },
};
```

- `(app)` dan `(admin)` wajib `robots: { index: false, follow: false }`.
- OG image dibuat dinamis lewat `opengraph-image.tsx` (ImageResponse), memakai
  hitam + oranye sesuai design system.

## 5.10 Kesiapan i18n (tanpa mengerjakannya sekarang)

i18n multi-bahasa **out of scope** MVP, tetapi dua aturan berikut wajib dipatuhi sejak
Fase 0 supaya penambahannya nanti tidak berarti menulis ulang seluruh UI:

1. **Tidak ada string UI yang di-hardcode di dalam JSX komponen bersama.**
   Teks yang berulang (label status, nama langkah build, pesan error) hidup di
   `src/config/messages.ts` sebagai objek konstanta.
2. Semua format tanggal/angka lewat `lib/format.ts` (locale `id`), bukan
   `toLocaleDateString()` yang ditulis langsung di komponen.

Dengan dua aturan itu, migrasi ke `next-intl` di v1.2 cukup mengganti sumber objek pesan.
