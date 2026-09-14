import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { reconcileYesterday } from "@/services/cost.service";

/**
 * Cron rekonsiliasi biaya vendor — docs/11 §11.8, docs/14 §14.8 (harian 02:00 WIB).
 * Mengisi UsageEvent.vendorCostIdr dari laporan v0 dan menyalakan kill switch
 * otomatis bila biaya kemarin melewati ambang. Wajib diamankan CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await reconcileYesterday();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("cron.reconcile_costs_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal merekonsiliasi biaya" },
      { status: 500 },
    );
  }
}
