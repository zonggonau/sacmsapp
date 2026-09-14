import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { refundStale } from "@/services/usage.service";

/**
 * Cron refund reservasi tertinggal — docs/11 §11.4 aturan 3, docs/14 §14.8 (tiap jam).
 * Wajib diamankan CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const refunded = await refundStale(30);
    return NextResponse.json({ ok: true, refunded });
  } catch (error) {
    logger.error("cron.refund_stale_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal me-refund reservasi" },
      { status: 500 },
    );
  }
}
