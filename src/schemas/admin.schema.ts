import { z } from "zod";

import { V0_MODELS } from "@/config/ai-models";
import { TOGGLE_KEYS } from "@/config/settings";

/**
 * Skema aksi & filter admin — docs/08 §8.6.
 *
 * Nilai dari <form> selalu string; angka dan boolean dikonversi di sini.
 */

const id = (label: string) => z.string().min(1, `${label} wajib diisi`);

/** "" atau spasi -> null; selain itu bilangan bulat >= 0. */
const optionalCount = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? null : v),
  z.coerce
    .number()
    .int("Harus bilangan bulat")
    .min(0, "Tidak boleh negatif")
    .max(1_000_000)
    .nullable(),
);

const count = z.coerce
  .number()
  .int("Harus bilangan bulat")
  .min(0, "Tidak boleh negatif")
  .max(1_000_000);

export const USER_ROLES = ["USER", "ADMIN", "SUPER_ADMIN"] as const;
export const USER_STATUSES = ["ACTIVE", "SUSPENDED"] as const;

export const userIdSchema = z.object({ userId: id("ID pengguna") });

export const changePlanSchema = z.object({
  userId: id("ID pengguna"),
  planId: id("Paket"),
});

export const setQuotaSchema = z.object({
  userId: id("ID pengguna"),
  creditsOverride: optionalCount,
  maxProjectsOverride: optionalCount,
});

export const suspendSchema = z.object({
  userId: id("ID pengguna"),
  reason: z
    .string()
    .trim()
    .min(10, "Tulis alasan minimal 10 karakter — alasan ini dikirim ke pengguna.")
    .max(500, "Alasan maksimal 500 karakter."),
});

export const changeRoleSchema = z.object({
  userId: id("ID pengguna"),
  role: z.enum(USER_ROLES, { message: "Peran tidak dikenal" }),
});

export const deleteUserSchema = z.object({
  userId: id("ID pengguna"),
  confirmEmail: z.string().min(1, "Ketik email pengguna untuk konfirmasi"),
});

export const adminJobIdSchema = z.object({ jobId: id("ID build") });

export const adminRollbackSchema = z.object({
  projectId: id("ID project"),
  deploymentId: id("ID deployment"),
});

export const planSchema = z.object({
  id: z.string().min(1).optional(),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9-]{2,30}$/,
      "Slug hanya huruf kecil, angka, dan tanda hubung (2–30 karakter)",
    ),
  name: z.string().trim().min(2, "Nama minimal 2 karakter").max(50),
  description: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable(),
  priceMonthly: count,
  isPublic: z.boolean(),
  sortOrder: count,
  maxProjects: count,
  monthlyCredits: count,
  maxCustomDomains: count,
  maxDeploysPerDay: count,
  allowedModels: z.array(z.enum(V0_MODELS)).min(1, "Pilih minimal satu model"),
});

export const toggleSettingSchema = z.object({
  key: z.enum(TOGGLE_KEYS),
  value: z.boolean(),
});

export const defaultModelSchema = z.object({
  model: z.enum(V0_MODELS, { message: "Model tidak dikenal" }),
});

export const saveRulesSchema = z.object({
  text: z.string().min(1, "Aturan tidak boleh kosong").max(8000),
});

export const restoreRulesSchema = z.object({
  version: z.coerce.number().int().min(1),
});

/** ADR-012: aktivasi Paket Project setelah pembayaran manual. */
export const activateSubscriptionSchema = z.object({
  projectId: id("ID project"),
  planId: id("Paket"),
  months: z.coerce
    .number({ message: "Isi jumlah bulan" })
    .int("Harus bilangan bulat")
    .min(1, "Minimal 1 bulan")
    .max(60, "Maksimal 60 bulan"),
  paymentRef: z
    .string()
    .trim()
    .max(100, "Maksimal 100 karakter")
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export const projectIdSchema = z.object({ projectId: id("ID project") });

/** ADR-012: top-up kredit manual ke dompet akun. */
export const grantCreditsSchema = z.object({
  userId: id("ID pengguna"),
  amount: z.coerce
    .number({ message: "Isi jumlah kredit" })
    .int("Harus bilangan bulat")
    .min(1, "Minimal 1 kredit")
    .max(100_000, "Maksimal 100.000 kredit"),
  paymentRef: z
    .string()
    .trim()
    .max(100, "Maksimal 100 karakter")
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  note: z
    .string()
    .trim()
    .max(200, "Maksimal 200 karakter")
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
});

export const dailyCostThresholdSchema = z.object({
  valueIdr: z.coerce
    .number({ message: "Isi angka rupiah" })
    .int("Harus bilangan bulat")
    .min(0, "Tidak boleh negatif")
    .max(1_000_000_000, "Maksimal Rp 1.000.000.000"),
});

/* ---------- Filter halaman (dibaca dari searchParams) ---------- */

const optionalText = z
  .string()
  .trim()
  .max(100)
  .optional()
  .transform((v) => (v ? v : undefined));

export const userFiltersSchema = z.object({
  q: optionalText,
  plan: optionalText,
  status: z.enum(USER_STATUSES).optional().catch(undefined),
  role: z.enum(USER_ROLES).optional().catch(undefined),
  cursor: optionalText,
});

export const auditFiltersSchema = z.object({
  action: optionalText,
  actor: optionalText,
  targetType: optionalText,
  targetId: optionalText,
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .catch(undefined),
  cursor: optionalText,
});

/** Mengambil satu nilai string dari searchParams Next.js. */
export function pickParams(
  raw: Record<string, string | string[] | undefined>,
  keys: readonly string[],
): Record<string, string | undefined> {
  return Object.fromEntries(
    keys.map((k) => {
      const v = raw[k];
      return [k, typeof v === "string" ? v : undefined];
    }),
  );
}
