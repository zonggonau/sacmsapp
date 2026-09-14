# 08 — Kontrak Server Actions

## 8.1 Kenapa Server Action, Bukan REST

Lihat [ADR-004](./adr/ADR-004-server-actions-first.md). Ringkasnya: satu tipe dari
server ke form, satu tempat memasang auth/RBAC/kuota/audit, tanpa lapisan
serialisasi manual, dan progressive enhancement gratis.

Route Handler (`app/api/`) **hanya** dipakai untuk empat hal:

1. Handler Better Auth (`/api/auth/[...all]`)
2. Webhook masuk dari Vercel
3. SSE progres build
4. Endpoint cron

Selain itu: Server Action.

## 8.2 Bentuk Baku Sebuah Action

```ts
// src/actions/project.actions.ts
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { authActionClient } from "@/lib/safe-action";
import { createProjectSchema } from "@/schemas/project.schema";
import * as projectService from "@/services/project.service";
import * as buildService from "@/services/build.service";

export const createProject = authActionClient
  .metadata({
    actionName: "project.create",
    rateLimit: { key: "project-create", limit: 10, window: "1h" },
    quota: { kind: "PROJECT_CREATE", credits: 1 },
    audit: true,
  })
  .inputSchema(createProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { project, job } = await projectService.createWithInitialBuild({
      userId: ctx.user.id,
      input: parsedInput,
    });

    // Pipeline jalan setelah respons terkirim - user tidak menunggu
    after(() => buildService.run(job.id));

    revalidatePath("/projects");
    revalidatePath("/dashboard");
    redirect(`/projects/${project.id}/builder`);
  });
```

Aturan bentuk:

1. `"use server"` di **baris pertama file**, bukan per fungsi.
2. Satu file action per domain; `export const`, bukan `export default`.
3. Selalu lewat client `next-safe-action` — **tidak pernah** `export async function`
   telanjang.
4. Action **tidak** berisi logika bisnis. Ia memanggil service.
5. `revalidatePath` / `redirect` hanya boleh di action, **tidak pernah** di service.
6. Kerja panjang masuk `after()`, bukan ditunggu.

## 8.3 Klien Action & Rantai Middleware

> **Kode di bawah adalah rancangan sasaran.** Implementasi nyata di
> `src/lib/safe-action.ts` sudah memuat langkah 1–4, 6, dan 7. Tiga selisih yang
> disengaja:
>
> 1. **Kuota (langkah 5) belum ada** — masuk di Fase 6, pada titik yang sudah ditandai
>    komentar di berkas tersebut ([11 §11.4](./11-QUOTA-DAN-BILLING.md)).
> 2. Field metadata memakai `.optional()`, **bukan** `.default()`. next-safe-action
>    mengetik argumen `.metadata()` dengan tipe _keluaran_ skema, sehingga `.default()`
>    justru mewajibkan field itu diisi di setiap pemanggilan.
> 3. Ada **`publicActionClient`** terpisah untuk aksi tanpa sesi (masuk, daftar, lupa
>    sandi) — rate limit dan audit tetap berlaku, tetapi pemeriksaan sesi dilewati.

```ts
// src/lib/safe-action.ts
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { z } from "zod";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth-guard";
import { checkRateLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import * as quotaService from "@/services/quota.service";
import * as auditService from "@/services/audit.service";
import { AppError } from "@/lib/errors";

export const actionClient = createSafeActionClient({
  defineMetadataSchema: () =>
    z.object({
      actionName: z.string(),
      rateLimit: z
        .object({ key: z.string(), limit: z.number(), window: z.string() })
        .optional(),
      quota: z.object({ kind: z.string(), credits: z.number() }).optional(),
      audit: z.boolean().default(false),
      requireRole: z.enum(["ADMIN", "SUPER_ADMIN"]).optional(),
    }),

  // Satu-satunya tempat error menjadi teks yang dilihat user
  handleServerError(e, { metadata }) {
    if (e instanceof AppError) return e.userMessage; // sudah bahasa Indonesia
    logger.error("action.unhandled", {
      action: metadata?.actionName,
      err: e.message,
      stack: e.stack,
    });
    return DEFAULT_SERVER_ERROR_MESSAGE; // JANGAN bocorkan detail
  },
});

// --- 1. AUTENTIKASI ---
export const authActionClient = actionClient.use(async ({ next, metadata }) => {
  const session = await getSession();
  if (!session)
    throw new AppError("UNAUTHORIZED", "Sesi Anda berakhir. Silakan masuk lagi.");
  if (session.user.status === "SUSPENDED")
    throw new AppError("SUSPENDED", "Akun Anda ditangguhkan. Hubungi dukungan.");

  // --- 2. PERAN ---
  if (metadata.requireRole) {
    const allowed =
      metadata.requireRole === "SUPER_ADMIN"
        ? ["SUPER_ADMIN"]
        : ["ADMIN", "SUPER_ADMIN"];
    if (!allowed.includes(session.user.role))
      throw new AppError("FORBIDDEN", "Anda tidak punya akses ke tindakan ini.");
  }

  // --- 3. IMPERSONASI: blokir aksi destruktif ---
  if (
    session.session.impersonatedBy &&
    metadata.actionName.match(/\.(delete|suspend|purge)$/)
  )
    throw new AppError(
      "FORBIDDEN",
      "Tindakan ini tidak tersedia saat menyamar sebagai pengguna.",
    );

  const h = await headers();
  const ctx = {
    user: session.user,
    session: session.session,
    ip: h.get("x-forwarded-for")?.split(",")[0] ?? "unknown",
    userAgent: h.get("user-agent") ?? "unknown",
    correlationId: crypto.randomUUID(),
  };

  // --- 4. RATE LIMIT ---
  if (metadata.rateLimit) {
    const ok = await checkRateLimit(
      `${metadata.rateLimit.key}:${ctx.user.id}`,
      metadata.rateLimit,
    );
    if (!ok)
      throw new AppError(
        "RATE_LIMITED",
        "Terlalu banyak permintaan. Coba lagi sebentar.",
      );
  }

  // --- 5. KUOTA (reservasi di muka) ---
  let reservation: { id: string } | null = null;
  if (metadata.quota)
    reservation = await quotaService.reserve(ctx.user.id, metadata.quota);

  // --- 6. JALANKAN + 7. AUDIT ---
  try {
    const result = await next({ ctx: { ...ctx, reservation } });
    if (reservation) await quotaService.commit(reservation.id);
    if (metadata.audit)
      await auditService.record({
        action: metadata.actionName,
        actor: ctx.user,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    return result;
  } catch (err) {
    if (reservation) await quotaService.refund(reservation.id); // gagal = kredit kembali
    throw err;
  }
});

// --- Klien khusus admin ---
export const adminActionClient = authActionClient.use(async ({ next, metadata }) =>
  next({ ctx: {} }),
); // metadata.requireRole diisi di tiap action
export const superAdminActionClient = adminActionClient;
```

Urutan **1 → 7 tidak boleh diubah**. Contoh kesalahan berbahaya: memeriksa kuota sebelum
autentikasi berarti pengguna anonim dapat menghabiskan kuota orang lain.

## 8.4 Penanganan Error

```ts
// src/lib/errors.ts
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "DEPLOY_FAILED"
  | "DOMAIN_INVALID"
  | "SUSPENDED"
  | "MAINTENANCE"
  | "KILL_SWITCH"
  | "CONFLICT"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public userMessage: string, // bahasa Indonesia, dilihat user
    public action?: { label: string; href: string }, // satu jalan keluar
    public cause?: unknown,
  ) {
    super(userMessage);
    this.name = "AppError";
  }
}
```

Kamus pesan (satu tempat, `src/config/messages.ts`):

| Kode             | Pesan ke pengguna                                               | Tindakan yang ditawarkan    |
| ---------------- | --------------------------------------------------------------- | --------------------------- |
| `QUOTA_EXCEEDED` | "Kuota bulanan Anda sudah habis."                               | Lihat Paket → `/akun/paket` |
| `AI_UNAVAILABLE` | "Layanan AI sedang sibuk. Coba beberapa saat lagi."             | Coba Lagi                   |
| `AI_TIMEOUT`     | "Pembuatan website memakan waktu terlalu lama dan dihentikan."  | Coba Lagi                   |
| `DEPLOY_FAILED`  | "Penerbitan gagal. Website Anda yang sekarang tidak berubah."   | Lihat Detail                |
| `RATE_LIMITED`   | "Terlalu banyak permintaan. Coba lagi sebentar."                | —                           |
| `KILL_SWITCH`    | "Pembuatan website sementara dinonaktifkan untuk pemeliharaan." | —                           |
| `DOMAIN_INVALID` | "Domain tidak valid atau sudah dipakai project lain."           | Panduan DNS                 |
| `INTERNAL`       | "Terjadi kesalahan. Tim kami sudah diberi tahu."                | Kembali                     |

> Larangan tegas: **tidak ada** kode status HTTP, nama tabel, stack trace, atau pesan
> berbahasa Inggris dari vendor yang sampai ke layar pengguna.

## 8.5 Pemakaian di Form (React 19)

```tsx
"use client";
import { useAction } from "next-safe-action/hooks";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { createProject } from "@/actions/project.actions";

export function CreateProjectForm() {
  const { execute, result, isPending } = useAction(createProject, {
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal membuat project"),
  });

  return (
    <form action={formAction(execute)} className="space-y-6">
      <WebsiteTypeSelect name="websiteType" />

      <div className="space-y-2">
        <Label htmlFor="prompt">Ceritakan website yang Anda inginkan</Label>
        <Textarea
          id="prompt"
          name="prompt"
          rows={6}
          placeholder="Contoh: Buat website Pemerintah Kabupaten Intan Jaya dengan halaman beranda, berita, agenda, profil daerah, OPD, galeri, dan kontak."
          aria-invalid={!!result.validationErrors?.prompt}
          aria-describedby="prompt-error"
        />
        {result.validationErrors?.prompt && (
          <p id="prompt-error" className="text-destructive text-sm">
            {result.validationErrors.prompt._errors?.[0]}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Membuat…
          </>
        ) : (
          <>
            <Sparkles className="size-4" /> Buat Website
          </>
        )}
      </Button>
    </form>
  );
}
```

Aturan form:

- **`<form action>` selalu dibungkus `formAction()`** dari `@/lib/form-action`.
  `useAction().execute` menerima objek input bertipe, sedangkan atribut `action`
  menyerahkan `FormData`. Helper itu menjembatani keduanya dan merupakan satu-satunya
  tempat di basis kode yang menegaskan tipe input formulir — validasi sebenarnya tetap
  di server lewat `.inputSchema()`.
- Metode builder adalah **`.inputSchema()`**, bukan `.schema()` (sudah deprecated di
  next-safe-action 8).
- Selalu ada keadaan _pending_ (`isPending` atau `useFormStatus`). Tombol tanpa umpan
  balik menyebabkan klik ganda.
- Error validasi tampil **di bawah field**, bukan di toast.
- Error server tampil di **toast**, karena bukan kesalahan field tertentu.
- `useOptimistic` dipakai di chat builder: pesan pengguna muncul seketika sebelum server
  menjawab.

## 8.6 Daftar Action MVP (kontrak lengkap)

### `project.actions.ts`

| Action             | Input                          | Efek                                            | Kuota                |
| ------------------ | ------------------------------ | ----------------------------------------------- | -------------------- |
| `createProject`    | `{name?, websiteType, prompt}` | Project + BuildJob + 10 step, jalankan pipeline | 1 project + 1 kredit |
| `renameProject`    | `{projectId, name}`            | Ubah nama & slug                                | –                    |
| `archiveProject`   | `{projectId}`                  | `status=ARCHIVED`                               | –                    |
| `deleteProject`    | `{projectId, confirmName}`     | Soft delete (ketik nama untuk konfirmasi)       | –                    |
| `duplicateProject` | `{projectId}`                  | Salin sebagai draf baru                         | 1 project            |

> **`name` opsional.** Prinsip produk [01 §1.7](./01-VISI-DAN-SCOPE.md) berbunyi "kalau
> sebuah kebutuhan bisa diselesaikan dengan prompt, jangan buat form". Nama diturunkan
> dari jenis website dan tanggal bila kosong (mis. "Website Pemerintahan — 14 Sep 2026"),
> dan bisa diganti kapan saja di pengaturan project. Satu field lebih sedikit di layar
> pertama berarti lebih banyak pengguna menyelesaikannya.
>
> Selama Fase 2 `createProject` **belum** membuat BuildJob — AI masuk di Fase 3. Action
> mengarahkan ke halaman ringkasan project, bukan ke builder.

### `builder.actions.ts`

| Action               | Input                    | Efek                                     | Kuota    |
| -------------------- | ------------------------ | ---------------------------------------- | -------- |
| `sendBuilderMessage` | `{projectId, message}`   | Pesan ke chat v0 yang sama, versi baru   | 1 kredit |
| `getBuildStatus`     | `{jobId}`                | Baca status + langkah (untuk polling)    | –        |
| `cancelBuild`        | `{jobId}`                | Batalkan job berjalan, kembalikan kredit | –        |
| `retryBuild`         | `{jobId}`                | Ulangi job gagal                         | 1 kredit |
| `restoreVersion`     | `{projectId, versionId}` | Jadikan versi lama sebagai versi aktif   | –        |

### `deploy.actions.ts`

| Action               | Input                       | Efek                                      | Kuota    |
| -------------------- | --------------------------- | ----------------------------------------- | -------- |
| `deployProject`      | `{projectId, target}`       | Terbitkan ke preview / production         | 1 deploy |
| `rollbackDeployment` | `{projectId, deploymentId}` | Kembalikan production ke versi sebelumnya | 1 deploy |

### `domain.actions.ts`

| Action         | Input                 | Efek                                 |
| -------------- | --------------------- | ------------------------------------ |
| `addDomain`    | `{projectId, domain}` | Daftarkan + kembalikan instruksi DNS |
| `verifyDomain` | `{domainId}`          | Periksa DNS, aktifkan bila siap      |
| `removeDomain` | `{domainId}`          | Lepas dari project                   |

### `account.actions.ts`

`updateProfile`, `changePassword`, `deleteAccount`, `markNotificationsRead`

### `admin.actions.ts` — semua `requireRole: "SUPER_ADMIN"`, semua `audit: true`

| Action                  | Input                                              | Catatan                                        |
| ----------------------- | -------------------------------------------------- | ---------------------------------------------- |
| `adminUpdateUserRole`   | `{userId, role}`                                   | Tolak jika menurunkan Super Admin terakhir     |
| `adminUpdateUserPlan`   | `{userId, planId, expiresAt?}`                     |                                                |
| `adminSetUserQuota`     | `{userId, creditsOverride?, maxProjectsOverride?}` |                                                |
| `adminResetUserUsage`   | `{userId}`                                         | Kembalikan `creditsUsed=0`                     |
| `adminSuspendUser`      | `{userId, reason}`                                 | Cabut semua sesi                               |
| `adminReactivateUser`   | `{userId}`                                         |                                                |
| `adminDeleteUser`       | `{userId, confirmEmail}`                           | Hard delete; audit tetap tinggal               |
| `adminImpersonateUser`  | `{userId}`                                         |                                                |
| `adminUpsertPlan`       | `{...Plan}`                                        |                                                |
| `adminCancelBuild`      | `{jobId}`                                          | Berlaku untuk build siapa pun                  |
| `adminRetryBuild`       | `{jobId}`                                          |                                                |
| `adminSetSystemSetting` | `{key, value}`                                     | Kill switch, maintenance, model, system prompt |

## 8.7 Kebijakan Revalidasi

| Setelah action                                     | Revalidasi                                                  |
| -------------------------------------------------- | ----------------------------------------------------------- |
| `createProject`, `deleteProject`, `archiveProject` | `/projects`, `/dashboard`                                   |
| `sendBuilderMessage`, `retryBuild`                 | `/projects/[projectId]/builder`                             |
| `deployProject`                                    | `/projects/[projectId]`, `/projects/[projectId]/deployment` |
| `addDomain`, `verifyDomain`                        | `/projects/[projectId]/domain`                              |
| `updateProfile`                                    | `/akun/profil`, `layout` (nama di topbar)                   |
| Action admin apa pun                               | Path admin terkait                                          |

Pakai `revalidatePath` bertarget. **Jangan** `revalidatePath("/", "layout")` — itu
membuang seluruh cache aplikasi untuk satu perubahan kecil.

## 8.8 Larangan Spesifik Server Action

| Jangan                                 | Kenapa                                           | Gantinya                 |
| -------------------------------------- | ------------------------------------------------ | ------------------------ |
| Percaya `userId` dari argumen action   | Klien bisa mengarangnya                          | Ambil dari `ctx.user.id` |
| Kembalikan objek Prisma mentah         | Bocor kolom (`password`, `rawError`)             | Petakan ke DTO eksplisit |
| `throw new Error("...")` langsung      | Bocor ke user / tidak informatif                 | `AppError` dengan kode   |
| Panggil action dari action lain        | Middleware jalan dua kali, kuota terpotong ganda | Panggil service bersama  |
| Kerja > 10 detik di dalam action       | Timeout, user menatap layar beku                 | `after()` + job          |
| `revalidatePath` di dalam service      | Service jadi terikat Next.js, tak bisa diuji     | Di action                |
| Lupa `metadata.audit` untuk aksi admin | Tidak ada jejak                                  | Wajib `audit: true`      |
