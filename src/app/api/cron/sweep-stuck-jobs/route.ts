import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { sweepStuck } from "@/services/build.service";

/**
 * Cron penyapu job nyangkut — docs/14-DEPLOYMENT-GO-LIVE.md §14.8 & docs/09 §9.8.
 *
 * Menandai FAILED job yang melewati batas timeoutAt dan mengembalikan kredit.
 * Wajib diamankan dengan CRON_SECRET agar tidak dapat dipicu pihak luar.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const swept = await sweepStuck();
    return NextResponse.json({ ok: true, swept });
  } catch (error) {
    logger.error("cron.sweep_stuck_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal menyapu job nyangkut" },
      { status: 500 },
    );
  }
}
