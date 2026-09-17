# 04 — Design System SaCMS

## 4.1 Karakter Visual

> **Hitam pekat, oranye tajam, tipografi bersih.**
> Dark mode adalah _default_ dan identitas utama. Light mode adalah alternatif yang
> tetap rapi, bukan sekadar pembalikan warna.

Prinsip:

1. **Gelap pekat, bukan abu-abu muda.** Latar dark mode adalah `#212121` (diputuskan pemilik
   sistem 16 September 2026, menyamakan dokumen dengan `globals.css`). Kedalaman
   dibentuk oleh _surface_ yang sedikit lebih terang dan border, **bukan** oleh bayangan.
2. **Oranye itu langka.** Oranye menandai satu hal per layar: aksi utama, nav aktif,
   badge status. Kalau semua oranye, tidak ada yang menonjol.
3. **Teks hanya putih dan hitam** (plus turunan abu untuk teks sekunder). Tidak ada teks
   berwarna-warni.
4. **Border, bukan shadow.** Di dark mode shadow tidak terlihat di atas hitam.
5. **Satu radius** (`0.625rem`) untuk seluruh sistem.

## 4.2 Palet Brand — Oranye

Hex adalah sumber kebenaran. Nilai OKLCH adalah padanan (dibulatkan) yang dipakai di CSS.

| Token           | Hex           | OKLCH (~)                   | Dipakai untuk                          |
| --------------- | ------------- | --------------------------- | -------------------------------------- |
| `brand-50`      | `#FFF4ED`     | `oklch(0.968 0.021 55)`     | Latar badge di light mode              |
| `brand-100`     | `#FFE6D5`     | `oklch(0.930 0.045 55)`     | Hover halus light mode                 |
| `brand-200`     | `#FFC8AA`     | `oklch(0.862 0.089 52)`     | Border aksen light mode                |
| `brand-300`     | `#FFA274`     | `oklch(0.790 0.140 48)`     | Teks aksen **di dark mode**            |
| `brand-400`     | `#FF7A3D`     | `oklch(0.745 0.175 45)`     | Hover tombol di dark mode              |
| **`brand-500`** | **`#FF6B00`** | **`oklch(0.705 0.205 45)`** | **PRIMARY — tombol, nav aktif, badge** |
| `brand-600`     | `#E85D00`     | `oklch(0.648 0.196 44)`     | Tombol ditekan (pressed)               |
| `brand-700`     | `#C24A00`     | `oklch(0.560 0.170 43)`     | Teks aksen **di light mode** (a11y)    |
| `brand-800`     | `#9A3B00`     | `oklch(0.468 0.138 42)`     | —                                      |
| `brand-900`     | `#7A3000`     | `oklch(0.395 0.112 42)`     | —                                      |

### Temuan kontras yang WAJIB dipatuhi

Diuji dengan rasio kontras WCAG 2.1:

| Kombinasi                                                        | Rasio       | Status                              | Konsekuensi                                                   |
| ---------------------------------------------------------------- | ----------- | ----------------------------------- | ------------------------------------------------------------- |
| `#FF6B00` di atas `#212121`                                      | **5.6:1**   | Lulus AA (normal), AAA (teks besar) | Aman untuk teks & ikon oranye di dark mode                    |
| `#FF6B00` di atas `#FFFFFF`                                      | **2.9:1**   | **GAGAL**                           | **Jangan pernah** pakai oranye-500 sebagai teks di light mode |
| `#FFFFFF` di atas `#FF6B00`                                      | **2.9:1**   | **GAGAL**                           | **Jangan pernah** pakai teks putih di atas tombol oranye      |
| `#000000` di atas `#FF6B00`                                      | **7.4:1**   | Lulus AAA                           | **Teks tombol oranye WAJIB hitam** (light)                    |
| `#212121` di atas `#FF6B00`                                      | **5.6:1**   | Lulus AA                            | Teks tombol oranye di dark mode                               |
| `#C24A00` di atas `#FFFFFF`                                      | **4.9:1**   | Lulus AA                            | Pakai `brand-700` untuk teks oranye di light mode             |
| `#FFFFFF` di atas `#212121`                                      | **16.1:1**  | Lulus AAA                           | —                                                             |
| `#A8A8A8` di atas `#212121`                                      | **6.8:1**   | Lulus AA                            | Teks sekunder dark mode (`--muted-foreground`)                |
| `#737373` di atas `#FFFFFF`                                      | **4.7:1**   | Lulus AA                            | Teks sekunder light mode                                      |
| `destructive` di atas badge gelap                                | **< 4.5:1** | **GAGAL** (Lighthouse, Fase 7)      | Jangan pakai `text-destructive` untuk teks kecil di dark mode |
| `destructive-text` (`oklch(0.808 0.114 19.6)`) di atas `#212121` | **≥ 7:1**   | Lulus AA                            | Teks merah di dark mode — badge `danger`, pesan galat         |
| `destructive-text` (`oklch(0.505 0.213 27.5)`) di atas `#FFFFFF` | **≥ 6:1**   | Lulus AA                            | Teks merah di light mode                                      |

> **Aturan tegas: `--primary-foreground` adalah hitam di kedua tema** — `#000000` di light,
> `#212121` di dark.
> Ini bukan selera — teks putih di atas oranye gagal aksesibilitas. Hitam di atas oranye
> juga kebetulan terlihat lebih tegas dan modern.

## 4.3 Palet Netral

| Token                           | Dark      | Light     | Peran                         |
| ------------------------------- | --------- | --------- | ----------------------------- |
| `background`                    | `#212121` | `#FFFFFF` | Latar halaman                 |
| `surface-1` (`card`, `popover`) | `#2A2A2A` | `#FFFFFF` | Kartu, dropdown, dialog       |
| `surface-2` (`muted`, `input`)  | `#303030` | `#F5F5F5` | Field, blok kode, baris zebra |
| `surface-3` (`accent`)          | `#383838` | `#F0F0F0` | Hover item menu, baris tabel  |
| `border`                        | `#383838` | `#E5E5E5` | Semua garis pemisah           |
| `border-strong`                 | `#484848` | `#D4D4D4` | Border field saat fokus       |
| `foreground`                    | `#FFFFFF` | `#0A0A0A` | Teks utama                    |
| `muted-foreground`              | `#A8A8A8` | `#737373` | Teks sekunder, label, hint    |
| `destructive`                   | `#EF4444` | `#DC2626` | Hapus, gagal                  |
| `success`                       | `#22C55E` | `#16A34A` | Live, berhasil                |
| `warning`                       | `#F59E0B` | `#D97706` | Peringatan kuota              |
| `info`                          | `#3B82F6` | `#2563EB` | Informasi netral              |

> `success` (hijau) dan `warning` (kuning) **tidak boleh** dipakai sebagai warna aksi.
> Keduanya hanya untuk status. Warna aksi hanya oranye.

## 4.4 `app/globals.css` — Implementasi Penuh

Tailwind v4: seluruh token didefinisikan di CSS. **Tidak ada `tailwind.config.js`.**

```css
@import "tailwindcss";
@import "tw-animate-css";

/* Dark mode digerakkan oleh class, dipasang next-themes */
@custom-variant dark (&:is(.dark *));

/* ---------- LIGHT (default) ---------- */
:root {
  --radius: 0.625rem;

  --background: oklch(1 0 0); /* #FFFFFF */
  --foreground: oklch(0.145 0 0); /* #0A0A0A */

  --card: oklch(1 0 0);
  --card-foreground: oklch(0.145 0 0);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.145 0 0);

  --primary: oklch(0.705 0.205 45); /* #FF6B00 */
  --primary-foreground: oklch(0 0 0); /* HITAM - wajib */
  --primary-hover: oklch(0.648 0.196 44); /* #E85D00 */
  --primary-subtle: oklch(0.968 0.021 55); /* #FFF4ED */
  --primary-text: oklch(0.56 0.17 43); /* #C24A00 - teks oranye light */

  --secondary: oklch(0.97 0 0); /* #F5F5F5 */
  --secondary-foreground: oklch(0.145 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.556 0 0); /* #737373 */
  --accent: oklch(0.962 0 0); /* #F0F0F0 */
  --accent-foreground: oklch(0.145 0 0);

  --destructive: oklch(0.577 0.245 27.3);
  --destructive-foreground: oklch(1 0 0);
  --success: oklch(0.627 0.17 149);
  --warning: oklch(0.705 0.17 70);
  --info: oklch(0.585 0.203 262);

  --border: oklch(0.922 0 0); /* #E5E5E5 */
  --border-strong: oklch(0.87 0 0); /* #D4D4D4 */
  --input: oklch(0.922 0 0);
  --ring: oklch(0.705 0.205 45); /* fokus = oranye */

  --sidebar: oklch(0.985 0 0);
  --sidebar-foreground: oklch(0.145 0 0);
  --sidebar-accent: oklch(0.962 0 0);
  --sidebar-border: oklch(0.922 0 0);
}

/* ---------- DARK (identitas utama: hitam #212121) ---------- */
.dark {
  --background: oklch(0.242 0 0); /* #212121 */
  --foreground: oklch(1 0 0); /* #FFFFFF */

  --card: oklch(0.28 0 0); /* #2A2A2A */
  --card-foreground: oklch(1 0 0);
  --popover: oklch(0.28 0 0); /* #2A2A2A */
  --popover-foreground: oklch(1 0 0);

  --primary: oklch(0.705 0.205 45); /* #FF6B00 — sama */
  --primary-foreground: oklch(0.242 0 0); /* #212121 di atas oranye */
  --primary-hover: oklch(0.745 0.175 45); /* #FF7A3D */
  --primary-subtle: oklch(0.705 0.205 45 / 0.14);
  --primary-text: oklch(0.79 0.14 48); /* #FFA274 */

  --secondary: oklch(0.31 0 0); /* #303030 */
  --secondary-foreground: oklch(1 0 0);
  --muted: oklch(0.31 0 0); /* #303030 */
  --muted-foreground: oklch(0.72 0 0); /* #A8A8A8 */
  --accent: oklch(0.35 0 0); /* #383838 */
  --accent-foreground: oklch(1 0 0);

  --destructive: oklch(0.637 0.208 25.3);
  /* Teks merah di atas permukaan gelap: merah terang agar lulus AA 4.5:1. */
  --destructive-text: oklch(0.808 0.114 19.6);
  --destructive-foreground: oklch(1 0 0);
  --success: oklch(0.723 0.181 148);
  --warning: oklch(0.769 0.165 70);
  --info: oklch(0.646 0.183 262);

  --border: oklch(0.35 0 0); /* #383838 */
  --border-strong: oklch(0.42 0 0); /* #484848 */
  --input: oklch(0.31 0 0); /* #303030 */
  --ring: oklch(0.705 0.205 45);

  --sidebar: oklch(0.215 0 0); /* #1B1B1B */
  --sidebar-foreground: oklch(1 0 0);
  --sidebar-accent: oklch(0.28 0 0); /* #2A2A2A */
  --sidebar-border: oklch(0.35 0 0); /* #383838 */
}

/* ---------- Pemetaan ke utility Tailwind ---------- */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-primary-hover: var(--primary-hover);
  --color-primary-subtle: var(--primary-subtle);
  --color-primary-text: var(--primary-text);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-info: var(--info);
  --color-border: var(--border);
  --color-border-strong: var(--border-strong);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-border: var(--sidebar-border);

  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);

  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground antialiased;
    font-feature-settings:
      "rlig" 1,
      "calt" 1;
  }
  /* Fokus keyboard selalu terlihat - jangan pernah dihapus */
  :focus-visible {
    @apply outline-ring outline-2 outline-offset-2;
  }
}
```

## 4.5 Tipografi

| Peran                  | Ukuran / Berat                 | Kelas                                           |
| ---------------------- | ------------------------------ | ----------------------------------------------- |
| Display (hero landing) | 48–60px / 700 / tracking-tight | `text-5xl md:text-6xl font-bold tracking-tight` |
| H1 halaman             | 30px / 600                     | `text-3xl font-semibold tracking-tight`         |
| H2 seksi               | 20px / 600                     | `text-xl font-semibold`                         |
| H3 kartu               | 16px / 600                     | `text-base font-semibold`                       |
| Body                   | 14px / 400                     | `text-sm`                                       |
| Sekunder / hint        | 13–14px / 400                  | `text-sm text-muted-foreground`                 |
| Label field            | 14px / 500                     | `text-sm font-medium`                           |
| Caption / meta         | 12px / 400                     | `text-xs text-muted-foreground`                 |
| Kode / URL             | 13px mono                      | `font-mono text-[13px]`                         |

Font: **Geist Sans** + **Geist Mono**, dimuat via `next/font` di root layout.
Body aplikasi memakai `text-sm` (14px) sebagai default — bukan 16px — agar kepadatan
informasi dashboard terjaga.

## 4.6 Spacing, Radius, Elevasi

- Skala spacing: **4px** (`1` = 4px). Pakai kelipatan 4 saja: 4, 8, 12, 16, 24, 32, 48, 64.
- Padding kartu: `p-6`. Jarak antar-seksi: `space-y-6`. Padding halaman: `p-6 lg:p-8`.
- Radius: kartu & dialog `rounded-lg`, tombol & input `rounded-md`, badge `rounded-full`.
- **Elevasi di dark mode = perubahan surface + border**, bukan `shadow`.
  `shadow-*` hanya boleh dipakai di light mode, dan hanya `shadow-sm`.

## 4.7 Aturan Pemakaian Oranye

| Boleh                                        | Tidak boleh                                   |
| -------------------------------------------- | --------------------------------------------- |
| Tombol aksi utama (satu per layar)           | Lebih dari satu tombol oranye dalam satu view |
| Indikator nav aktif (bar kiri + teks + ikon) | Semua item nav oranye                         |
| Badge status penting (`Live`, `PRO`, `Baru`) | Semua badge oranye                            |
| Ring fokus                                   | Teks paragraf                                 |
| Bar progres saat build                       | Latar penuh satu halaman                      |
| Logo                                         | Warna latar kartu                             |

### Pola nav aktif (spesifikasi tepat)

```tsx
// components/layout/nav-item.tsx
<Link
  href={href}
  data-active={isActive}
  className={cn(
    "group relative flex items-center gap-3 rounded-md px-3 py-2",
    "text-sm font-medium transition-colors",
    "text-muted-foreground hover:bg-accent hover:text-foreground",
    // Keadaan aktif: bar oranye + teks oranye + latar oranye tipis
    "data-[active=true]:bg-primary-subtle data-[active=true]:text-primary-text",
    "data-[active=true]:before:absolute data-[active=true]:before:left-0",
    "data-[active=true]:before:h-5 data-[active=true]:before:w-0.5",
    "data-[active=true]:before:bg-primary data-[active=true]:before:rounded-r-full",
  )}
>
  <Icon className="size-4 shrink-0" />
  {label}
</Link>
```

> Perhatikan: teks aktif memakai `text-primary-text` (bukan `text-primary`). Token itu
> otomatis menjadi `#FFA274` di dark dan `#C24A00` di light — keduanya lulus kontras.

### Varian badge

```tsx
// components/ui/badge.tsx — varian tambahan SaCMS
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 " +
    "text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground", // hitam di atas oranye
        subtle: "border-primary/25 bg-primary-subtle text-primary-text",
        outline: "border-border text-foreground",
        success: "border-transparent bg-success/15 text-success",
        warning: "border-transparent bg-warning/15 text-warning",
        danger: "border-transparent bg-destructive/15 text-destructive-text",
        neutral: "border-transparent bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);
```

### Pemetaan status ke badge

| Status project | Varian                     | Teks       |
| -------------- | -------------------------- | ---------- |
| `DRAFT`        | `neutral`                  | Draf       |
| `BUILDING`     | `subtle` + titik berdenyut | Membangun  |
| `READY`        | `subtle`                   | Siap       |
| `LIVE`         | `success` + titik          | Live       |
| `FAILED`       | `danger`                   | Gagal      |
| `ARCHIVED`     | `neutral`                  | Diarsipkan |

## 4.8 Komponen shadcn yang Dipasang

Fase 0 (wajib):
`button` `input` `label` `textarea` `card` `badge` `avatar` `dropdown-menu`
`dialog` `alert-dialog` `sheet` `separator` `skeleton` `sonner` `tooltip`
`tabs` `select` `switch` `form` `scroll-area` `progress` `alert`

Fase 2+:
`table` `pagination` `command` `popover` `checkbox` `radio-group`
`breadcrumb` `collapsible` `sidebar` `chart`

> Komponen shadcn menjadi **milik kita**. Boleh diubah, tapi perubahan pada
> `components/ui/` wajib disebut di deskripsi PR, karena berdampak ke seluruh aplikasi.

## 4.9 Dark/Light — Implementasi

```tsx
// app/layout.tsx
import { ThemeProvider } from "next-themes";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className={cn(geistSans.variable, geistMono.variable)}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"     {/* dark adalah identitas SaCMS */}
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

Aturan:

- `suppressHydrationWarning` di `<html>` **wajib**, kalau tidak akan ada error hidrasi.
- `disableTransitionOnChange` **wajib**, kalau tidak seluruh halaman akan "berkedip warna".
- Tombol toggle tema menukar ikon lewat **CSS** (varian `dark:`), bukan lewat state
  React. Markup server dan klien jadi identik — tidak ada ketidakcocokan hidrasi, tidak
  perlu gerbang `mounted`, dan tidak ada lompatan layout. Pola `useEffect(() =>
setMounted(true))` **dilarang**: aturan lint `react-hooks/set-state-in-effect` bawaan
  Next.js 16 menolaknya.
- `<html lang="id">` — bukan `en`.

## 4.10 Aksesibilitas (tidak bisa ditawar)

| Aturan                                             | Pemeriksaan                                                 |
| -------------------------------------------------- | ----------------------------------------------------------- |
| Semua teks lulus WCAG AA (4.5:1 normal, 3:1 besar) | Tabel §4.2                                                  |
| Fokus keyboard selalu terlihat                     | `:focus-visible` di `globals.css`, jangan di-`outline-none` |
| Target sentuh minimal 44x44px di mobile            | Tombol ikon: `size-9` + `p-2.5`                             |
| Setiap tombol ikon punya `aria-label`              | Lint                                                        |
| Warna bukan satu-satunya penanda status            | Badge selalu ada teks, bukan hanya titik                    |
| Form error terhubung ke field                      | `aria-describedby` + `aria-invalid`                         |
| `prefers-reduced-motion` dihormati                 | Animasi build progress wajib punya fallback                 |
| Skip-to-content di app shell                       | Fase 1                                                      |

## 4.11 Bahasa & Penulisan UI

- Seluruh UI **bahasa Indonesia**. Istilah teknis yang lebih dikenal dalam bahasa Inggris
  boleh dipertahankan: _deploy_, _preview_, _domain_, _dashboard_, _prompt_.
- Tombol memakai kata kerja: "Buat Website", "Terbitkan Perubahan", "Hubungkan Domain".
  Bukan "Submit", bukan "OK".
- Pesan error: **apa yang terjadi + apa yang bisa dilakukan.**
  - Buruk: `Error: 429 Too Many Requests`
  - Baik: "AI sedang sibuk. Coba lagi dalam 1 menit." + tombol **Coba Lagi**
- Empty state selalu punya satu ajakan tindakan.
- Angka: pemisah ribuan titik (`1.500`), tanggal `d MMMM yyyy` locale `id`.
