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

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url().optional(),

  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  GOOGLE_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),

  V0_API_KEY: z.string().min(1).optional(),
  V0_DEFAULT_MODEL: z.string().default("v0-1.5-sm"),
  V0_MOCK: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),

  VERCEL_TOKEN: z.string().min(1).optional(),
  VERCEL_TEAM_ID: z.string().min(1).optional(),

  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),

  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().default("SaCMS <noreply@sacms.id>"),

  CRON_SECRET: z.string().min(32).optional(),
  SENTRY_DSN: z.string().url().optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
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
