import { NextResponse } from "next/server";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { pingRedis } from "@/lib/ratelimit";

/**
 * Kesehatan layanan — docs/14 §14.6 (uji smoke setelah deploy).
 *
 * Publik dan tanpa data sensitif: hanya status per komponen. 503 bila database
 * atau Redis (di production) tidak menjawab, supaya uptime monitor ikut berbunyi.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();

  let database: "ok" | "gagal" = "ok";
  try {
    await db.$queryRaw`SELECT 1`;
  } catch (error) {
    database = "gagal";
    logger.error("health.database_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
  }

  const redis = await pingRedis();
  const redisHealthy =
    redis === "ok" ||
    redis === "in-memory" ||
    (redis === "tidak-dikonfigurasi" && process.env.NODE_ENV !== "production");
  const healthy = database === "ok" && redisHealthy;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "gagal",
      checks: { database, redis },
      ms: Date.now() - started,
    },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
