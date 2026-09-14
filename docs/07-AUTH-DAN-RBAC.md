# 07 — Autentikasi & Kontrol Akses

## 7.1 Pilihan: Better Auth 1.7.4

Alasan singkat (lengkap di [ADR-002](./adr/ADR-002-better-auth.md)):

| Kebutuhan SaCMS                 | Yang diberikan Better Auth                                               |
| ------------------------------- | ------------------------------------------------------------------------ |
| Login email + kata sandi        | Dukungan bawaan kelas satu (bukan tempelan seperti Credentials Provider) |
| Login Google                    | Plugin social provider                                                   |
| **Super Admin**                 | Plugin `admin`: `role`, `banUser`, `listUsers`, **`impersonateUser`**    |
| Verifikasi email & reset sandi  | Bawaan + kaitan ke Resend                                                |
| Sesi di database (bisa dicabut) | Tabel `Session`, bukan JWT yang tak bisa ditarik                         |
| Skema milik kita                | Model Prisma kita sendiri, bukan tabel tersembunyi                       |

`impersonateUser` sangat penting: saat pengguna melapor "build saya gagal", Super Admin
bisa melihat persis apa yang dilihat pengguna itu — dan sesi impersonasi tercatat di
kolom `Session.impersonatedBy` serta di `AuditLog`.

## 7.2 Konfigurasi

```ts
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import { sendVerificationEmail, sendResetPasswordEmail } from "@/lib/mail";

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.NEXT_PUBLIC_APP_URL!,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => sendResetPasswordEmail(user.email, url),
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) =>
      sendVerificationEmail(user.email, url),
  },

  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 hari
    updateAge: 60 * 60 * 24, // perpanjang tiap 24 jam
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "USER", input: false }, // input:false = KUNCI
      status: { type: "string", defaultValue: "ACTIVE", input: false },
      planId: { type: "string", input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Setiap user baru otomatis masuk plan FREE
        before: async (user) => {
          const free = await db.plan.findUniqueOrThrow({ where: { slug: "free" } });
          return { data: { ...user, planId: free.id, role: "USER", status: "ACTIVE" } };
        },
      },
    },
  },

  plugins: [
    // ac + roles WAJIB diisi: plugin admin hanya mengenal peran bawaan
    // "admin"/"user". Tanpa ini Better Auth menolak start dengan
    // "Invalid admin roles: SUPER_ADMIN". Lihat §7.3a.
    admin({ ac, roles, defaultRole: "USER", adminRoles: ["ADMIN", "SUPER_ADMIN"] }),
    nextCookies(),
  ],
});
```

> **`input: false` pada `role`, `status`, dan `planId` adalah baris terpenting di file ini.**
> Tanpa itu, penyerang dapat mengirim `role: "SUPER_ADMIN"` di form pendaftaran dan
> menjadi pemilik sistem. Ini kelas kerentanan _mass assignment_.

## 7.3 Peran & Kewenangan

> **§7.3a — Peran kustom wajib didefinisikan.** Plugin `admin` Better Auth hanya
> mengenal `admin` dan `user`. Karena SaCMS memakai USER/ADMIN/SUPER_ADMIN, ketiganya
> harus dibuat lewat `createAccessControl` (`better-auth/plugins/access`) dan
> `defaultStatements` (`better-auth/plugins/admin/access`), lalu dioper sebagai `ac` dan
> `roles`. Tabel di bawah adalah sumber kebenaran pemetaan izinnya —
> implementasinya ada di `src/lib/auth.ts`.

| Kewenangan                        | USER |   ADMIN    | SUPER_ADMIN |
| --------------------------------- | :--: | :--------: | :---------: |
| Kelola project sendiri            |  ya  |     ya     |     ya      |
| Generate & deploy                 |  ya  |     ya     |     ya      |
| Lihat **semua** project           |  –   | lihat saja |     ya      |
| Lihat **semua** user              |  –   | lihat saja |     ya      |
| Ubah plan / kuota user            |  –   |     –      |     ya      |
| Suspend / aktifkan user           |  –   |     ya     |     ya      |
| Hapus user permanen               |  –   |     –      |     ya      |
| Ubah peran user                   |  –   |     –      |     ya      |
| Impersonasi user                  |  –   |     –      |     ya      |
| Ubah definisi Plan                |  –   |     –      |     ya      |
| Kill switch AI global             |  –   |     –      |     ya      |
| Maintenance mode                  |  –   |     –      |     ya      |
| Ubah system prompt AI             |  –   |     –      |     ya      |
| Lihat audit log                   |  –   |     ya     |     ya      |
| Batalkan / ulangi build siapa pun |  –   |     ya     |     ya      |
| Lihat biaya vendor                |  –   |     –      |     ya      |

Aturan yang tidak bisa dilanggar:

1. **SUPER_ADMIN tidak bisa diberikan lewat UI pendaftaran.** Hanya lewat seed, atau oleh
   SUPER_ADMIN lain.
2. **Super Admin terakhir tidak bisa menurunkan dirinya sendiri.** Sistem harus selalu
   punya minimal satu. Divalidasi di service, bukan hanya di UI.
3. **Super Admin tidak bisa menghapus akunnya sendiri.**
4. Selama impersonasi, tindakan **destruktif** (hapus project, ubah plan, hapus user)
   diblokir. Impersonasi untuk _melihat_, bukan untuk _bertindak_.

## 7.4 Pertahanan Berlapis

Empat lapis, masing-masing berdiri sendiri. Menembus satu tidak cukup.

```
Lapis 1  proxy.ts             -> pemeriksaan cookie murah, redirect awal
Lapis 2  layout grup          -> requireUser() / requireSuperAdmin() di server
Lapis 3  middleware action    -> next-safe-action memverifikasi ulang tiap mutasi
Lapis 4  klausa where query   -> data difilter pemilik di tingkat database
```

> **Lapis 1 saja TIDAK PERNAH cukup.** Middleware hanya membaca cookie; ia bisa dilewati
> oleh permintaan yang tidak melewatinya. Otorisasi sebenarnya terjadi di lapis 2–4.

### Lapis 1 — `src/proxy.ts`

```ts
import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const PUBLIC = ["/", "/harga", "/fitur", "/legal"];
const AUTH_PAGES = ["/masuk", "/daftar", "/lupa-sandi", "/atur-sandi"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Cek keberadaan cookie saja - TIDAK memvalidasi sesi (itu tugas lapis 2)
  const hasCookie = Boolean(getSessionCookie(req));

  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return hasCookie
      ? NextResponse.redirect(new URL("/dashboard", req.url))
      : NextResponse.next();
  }

  if (PUBLIC.includes(pathname)) return NextResponse.next();

  if (!hasCookie) {
    const url = new URL("/masuk", req.url);
    url.searchParams.set("lanjut", pathname); // kembali ke tujuan setelah login
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)",
  ],
};
```

### Lapis 2 — `src/lib/auth-guard.ts`

```ts
import { cache } from "react";
import { headers } from "next/headers";
import { redirect, forbidden } from "next/navigation";
import { auth } from "@/lib/auth";

// cache() -> satu permintaan HTTP = satu query sesi, meski dipanggil di banyak layout
export const getSession = cache(async () => {
  return auth.api.getSession({ headers: await headers() });
});

export async function requireUser() {
  const session = await getSession();
  if (!session) redirect("/masuk");
  if (session.user.status === "SUSPENDED") redirect("/akun-ditangguhkan");
  return session.user;
}

export async function requireRole(roles: Array<"ADMIN" | "SUPER_ADMIN">) {
  const user = await requireUser();
  if (!roles.includes(user.role as never)) forbidden(); // -> forbidden.tsx
  return user;
}

export const requireAdmin = () => requireRole(["ADMIN", "SUPER_ADMIN"]);
export const requireSuperAdmin = () => requireRole(["SUPER_ADMIN"]);
```

`getSession` dibungkus `cache()` karena dipanggil di `(app)/layout.tsx`, di komponen
topbar, dan di setiap Server Action pada permintaan yang sama. Tanpa `cache()`, satu
pemuatan halaman bisa memicu lima query sesi.

### Lapis 3 — middleware Server Action

Lihat [08 — Server Actions](./08-SERVER-ACTIONS.md) §8.3.

### Lapis 4 — filter di query

Lihat [06 §6.7](./06-DATABASE-SCHEMA.md).

## 7.5 Alur Autentikasi

### Daftar

```
Isi nama, email, sandi (min 10 karakter, dicek kekuatannya)
  -> Better Auth membuat User (role=USER, status=ACTIVE, plan=free otomatis)
  -> Email verifikasi terkirim (Resend), berlaku 1 jam
  -> Layar "Cek email Anda" + tombol kirim ulang (rate limit 1x / 60 detik)
  -> Klik tautan -> emailVerified=true -> otomatis masuk -> /dashboard
```

### Masuk

```
Email + sandi
  -> gagal: pesan generik "Email atau kata sandi salah"
     (JANGAN bedakan "email tidak ada" vs "sandi salah" - membocorkan
      daftar email terdaftar)
  -> rate limit: 5 percobaan / 15 menit per email DAN per IP
  -> status SUSPENDED -> /akun-ditangguhkan (bukan pesan error samar)
  -> berhasil -> catat lastLoginAt -> redirect ke ?lanjut= atau /dashboard
```

### Impersonasi (hanya Super Admin)

```
/admin/pengguna/[userId] -> "Masuk sebagai pengguna ini"
  -> dialog konfirmasi yang menyebutkan nama & email target
  -> auth.api.impersonateUser()
  -> Session.impersonatedBy = id super admin
  -> AuditLog: "user.impersonate.start"
  -> Banner oranye menetap di atas layar:
     "Anda sedang masuk sebagai Budi Santoso. [Kembali ke akun saya]"
  -> Aksi destruktif diblokir selama impersonasi
  -> Berakhir otomatis dalam 60 menit
  -> AuditLog: "user.impersonate.end"
```

Banner impersonasi **wajib** terlihat di setiap halaman. Super Admin yang lupa sedang
menyamar lalu melakukan perubahan adalah insiden data yang nyata.

## 7.6 Kebijakan Sesi & Kata Sandi

| Aturan                 | Nilai                                                     |
| ---------------------- | --------------------------------------------------------- |
| Masa sesi              | 30 hari, diperbarui setiap 24 jam aktivitas               |
| Cookie                 | `httpOnly`, `secure` (production), `sameSite=lax`         |
| Panjang sandi minimum  | 10 karakter                                               |
| Hash                   | Bawaan Better Auth (scrypt). **Jangan ganti ke MD5/SHA.** |
| Ganti sandi            | Cabut **semua sesi lain**, kirim email pemberitahuan      |
| Suspend user           | Cabut semua sesi **saat itu juga**                        |
| Ubah peran             | Cabut semua sesi user tersebut                            |
| Masa token verifikasi  | 1 jam                                                     |
| Masa token reset sandi | 1 jam, sekali pakai                                       |

## 7.7 Rate Limit

```ts
// src/lib/ratelimit.ts - ringkasan kebijakan
masuk:          5 / 15 menit   (kunci: email + IP)
daftar:         3 / jam        (kunci: IP)
lupa sandi:     3 / jam        (kunci: email)
kirim ulang:    1 / 60 detik   (kunci: email)
buat project:   10 / jam       (kunci: userId)
generate AI:    20 / jam       (kunci: userId)   <- selain kuota kredit
deploy:         30 / jam       (kunci: userId)
aksi admin:     100 / menit    (kunci: userId)
```

Rate limit dan kuota adalah **dua hal berbeda**: rate limit mencegah penyalahgunaan
mekanis; kuota adalah batas komersial. Keduanya diperiksa.

## 7.8 Checklist Uji Keamanan Akses (wajib lulus sebelum Fase 5 ditutup)

- [ ] `USER` membuka `/admin` langsung → 403, bukan halaman kosong
- [ ] `USER` memanggil Server Action admin lewat DevTools → ditolak
- [ ] `USER` A membuka `/projects/{id-milik-B}` → 404 (bukan 403; jangan konfirmasi ada)
- [ ] `USER` A memanggil `deleteProject(id-milik-B)` → ditolak
- [ ] Kirim `role: "SUPER_ADMIN"` di payload pendaftaran → diabaikan
- [ ] User `SUSPENDED` dengan cookie lama → ditolak di lapis 2
- [ ] Super Admin terakhir mencoba menurunkan dirinya → ditolak dengan pesan jelas
- [ ] Aksi destruktif saat impersonasi → diblokir
- [ ] Sesi lama setelah ganti sandi → tidak berlaku
- [ ] Enumerasi email lewat halaman masuk → tidak mungkin (pesan seragam)
