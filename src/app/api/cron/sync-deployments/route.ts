import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { syncActive } from "@/services/deploy.service";

/**
 * Cron penyelaras deployment — docs/14-DEPLOYMENT-GO-LIVE.md §14.8.
 *
 * Jaring pengaman bila tidak ada yang membuka halaman deployment dan webhook
 * tidak terkirim: memulai deployment QUEUED yang after()-nya tidak berjalan,
 * dan menyamakan deployment BUILDING dengan Vercel. Wajib diamankan CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const processed = await syncActive();
    return NextResponse.json({ ok: true, processed });
  } catch (error) {
    logger.error("cron.sync_deployments_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal menyelaraskan deployment" },
      { status: 500 },
    );
  }
}
