import { z } from "zod";

/**
 * Validasi environment variable saat startup — docs/12-KEAMANAN.md §12.2.
 *
 * Variabel yang hilang membuat aplikasi GAGAL START, bukan gagal diam-diam
 * di tengah jalan saat sudah ada pengguna.
 *
 * SKIP_ENV_VALIDATION=true dipakai HANYA di CI, tempat build berjalan tanpa
 * rahasia production. Jangan pernah dipakai di runtime production.
 */

const emptyToUndefined = (val: unknown) =>
  typeof val === "string" && val.trim() === "" ? undefined : val;

const optionalString = (min = 1) =>
  z.preprocess(emptyToUndefined, z.string().min(min).optional());

const optionalUrl = () => z.preprocess(emptyToUndefined, z.string().url().optional());

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: optionalUrl(),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: optionalString(1),
  GOOGLE_CLIENT_SECRET: optionalString(1),

  V0_API_KEY: optionalString(1),
  // Id valid: v0-mini | v0-auto | v0-pro | v0-max | v0-max-fast (src/config/ai-models.ts)
  V0_DEFAULT_MODEL: z.string().default("v0-mini"),
  V0_MOCK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  VERCEL_TOKEN: optionalString(1),
  VERCEL_TEAM_ID: optionalString(1),
  VERCEL_WEBHOOK_SECRET: optionalString(1),
  VERCEL_MOCK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  UPSTASH_REDIS_REST_URL: optionalUrl(),
  UPSTASH_REDIS_REST_TOKEN: optionalString(1),
  BLOB_READ_WRITE_TOKEN: optionalString(1),

  RESEND_API_KEY: optionalString(1),
  EMAIL_FROM: z.string().default("SaCMS <noreply@sacms.id>"),

  CRON_SECRET: optionalString(32),
  SENTRY_DSN: optionalUrl(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: optionalUrl(),
});

const schema = serverSchema.merge(clientSchema);

export type Env = z.infer<typeof schema>;

function load(): Env {
  if (process.env.SKIP_ENV_VALIDATION === "true") {
    return process.env as unknown as Env;
  }

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Environment variable tidak valid:\n${missing}\n\n` +
        `Salin .env.example menjadi .env.local lalu isi nilainya.`,
    );
  }

  return parsed.data;
}

export const env = load();
