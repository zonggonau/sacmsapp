import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { resetExpiredPeriods } from "@/services/quota.service";

/**
 * Cron reset periode kuota — docs/11 §11.5, docs/14 §14.8 (harian 03:00).
 * Wajib diamankan CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const reset = await resetExpiredPeriods();
    return NextResponse.json({ ok: true, reset });
  } catch (error) {
    logger.error("cron.reset_periods_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal mereset periode" },
      { status: 500 },
    );
  }
}
