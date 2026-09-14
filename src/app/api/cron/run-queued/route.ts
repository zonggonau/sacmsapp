import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { runQueued } from "@/services/build.service";

/**
 * Cron penjalan antrean — docs/14-DEPLOYMENT-GO-LIVE.md §14.8.
 *
 * Menjalankan job QUEUED yang tidak diambil jalur lain: job yang diantre ulang
 * karena rate limit vendor, dan job yang after()-nya tidak pernah berjalan
 * sementara tidak ada pengguna yang membuka halaman builder.
 *
 * Aman bertabrakan dengan polling maupun eksekusi cron sebelumnya: run()
 * mengklaim job secara atomik. Wajib diamankan dengan CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const picked = await runQueued();
    return NextResponse.json({ ok: true, picked });
  } catch (error) {
    logger.error("cron.run_queued_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal menjalankan antrean build" },
      { status: 500 },
    );
  }
}
