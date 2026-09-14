import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { checkPending } from "@/services/domain.service";

/**
 * Cron verifikasi custom domain — docs/14-DEPLOYMENT-GO-LIVE.md §14.8.
 *
 * Tiap 10 menit memeriksa domain PENDING_DNS / VERIFYING yang ditambahkan dalam
 * 24 jam terakhir. Wajib diamankan CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const result = await checkPending();
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("cron.verify_domains_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal memverifikasi domain" },
      { status: 500 },
    );
  }
}
