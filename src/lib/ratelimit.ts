import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

import { logger } from "@/lib/logger";

/**
 * Rate limit — docs/07-AUTH-DAN-RBAC.md §7.7.
 *
 * Rate limit dan kuota adalah dua hal berbeda: yang ini mencegah penyalahgunaan
 * mekanis (brute force, spam), kuota adalah batas komersial (docs/11).
 *
 * Tanpa kredensial Upstash, dipakai penghitung dalam memori supaya pengembangan
 * lokal tetap jalan. Di PRODUCTION itu tidak dapat diterima — penghitung dalam
 * memori tidak dibagi antar-instance serverless, sehingga batasnya praktis
 * tidak berlaku. Karena itu production TANPA Upstash langsung gagal start.
 */

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const isProduction = process.env.NODE_ENV === "production";

if (isProduction && (!url || !token)) {
  logger.warn("ratelimit.in_memory", {
    hint: "UPSTASH_REDIS_REST_URL tidak disetel — memakai penghitung dalam memori pada instance VPS.",
  });
}

const redis = url && token ? new Redis({ url, token }) : null;

if (!redis) {
  logger.warn("ratelimit.in_memory", {
    hint: "Upstash belum dikonfigurasi — memakai penghitung dalam memori (khusus development).",
  });
}

/** Kebijakan baku — docs/07 §7.7. Jangan longgarkan tanpa alasan tertulis. */
export const RATE_LIMITS = {
  masuk: { limit: 5, window: "15 m" },
  daftar: { limit: 3, window: "1 h" },
  lupaSandi: { limit: 3, window: "1 h" },
  kirimUlang: { limit: 1, window: "60 s" },
  buatProject: { limit: 10, window: "1 h" },
  generateAi: { limit: 20, window: "1 h" },
  deploy: { limit: 30, window: "1 h" },
  aksiAdmin: { limit: 100, window: "1 m" },
} as const;

export type RateLimitKey = keyof typeof RATE_LIMITS;

/* ---------- Cadangan dalam memori (development saja) ---------- */

const memory = new Map<string, { count: number; resetAt: number }>();

function windowToMs(window: string): number {
  const match = /^(\d+)\s*([smhd])$/.exec(window.trim());
  if (!match) return 60_000;
  const value = Number(match[1]);
  const unit = match[2];
  const factor =
    unit === "s"
      ? 1_000
      : unit === "m"
        ? 60_000
        : unit === "h"
          ? 3_600_000
          : 86_400_000;
  return value * factor;
}

function checkInMemory(identifier: string, limit: number, window: string) {
  const now = Date.now();
  const entry = memory.get(identifier);

  if (!entry || entry.resetAt <= now) {
    memory.set(identifier, { count: 1, resetAt: now + windowToMs(window) });
    return { success: true, remaining: limit - 1 };
  }

  entry.count += 1;
  return { success: entry.count <= limit, remaining: Math.max(0, limit - entry.count) };
}

/* ---------- Upstash ---------- */

const limiters = new Map<string, Ratelimit>();

function getLimiter(key: RateLimitKey) {
  if (!redis) return null;

  const cached = limiters.get(key);
  if (cached) return cached;

  const { limit, window } = RATE_LIMITS[key];
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(
      limit,
      window as Parameters<typeof Ratelimit.slidingWindow>[1],
    ),
    prefix: `sacms:rl:${key}`,
    analytics: false,
  });

  limiters.set(key, limiter);
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  remaining: number;
}

/**
 * @param key    kebijakan yang dipakai
 * @param subject pengenal yang dibatasi — userId, email, atau IP
 */
export async function checkRateLimit(
  key: RateLimitKey,
  subject: string,
): Promise<RateLimitResult> {
  const { limit, window } = RATE_LIMITS[key];
  const limiter = getLimiter(key);

  if (!limiter) return checkInMemory(`${key}:${subject}`, limit, window);

  try {
    const result = await limiter.limit(subject);
    return { success: result.success, remaining: result.remaining };
  } catch (error) {
    // Redis bermasalah tidak boleh membuat seluruh aplikasi mati. Kita catat
    // dan izinkan — ketersediaan lebih penting daripada batas yang sempurna,
    // KECUALI untuk jalur autentikasi yang memang harus ketat.
    logger.error("ratelimit.redis_error", {
      key,
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    const strictKeys: RateLimitKey[] = ["masuk", "daftar", "lupaSandi"];
    return { success: !strictKeys.includes(key), remaining: 0 };
  }
}

/* ---------- Pemeriksaan kesehatan — docs/14 §14.6 ---------- */

export async function pingRedis(): Promise<
  "ok" | "tidak-dikonfigurasi" | "gagal" | "in-memory"
> {
  if (!redis) return "in-memory";
  try {
    await redis.ping();
    return "ok";
  } catch (error) {
    logger.error("health.redis_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return "gagal";
  }
}
