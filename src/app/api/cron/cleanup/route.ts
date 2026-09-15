import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { closeExpiredImpersonations } from "@/services/admin-user.service";

/**
 * Cron pembersihan — docs/14 §14.8 (tiap jam).
 * Mencatat akhir sesi impersonasi yang kedaluwarsa sendiri (docs/07 §7.5).
 * Wajib diamankan CRON_SECRET.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const impersonationsClosed = await closeExpiredImpersonations();
    return NextResponse.json({ ok: true, impersonationsClosed });
  } catch (error) {
    logger.error("cron.cleanup_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal membersihkan" },
      { status: 500 },
    );
  }
}
