import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { getPlatformSummary } from "@/services/platform-summary.service";

/**
 * Ringkasan hanya-baca untuk panel admin SaCMS — ADR-016.
 *
 * Bukan CRUD, dan dipanggil server SaCMS (bukan browser), jadi berbentuk Route
 * Handler seperti /api/cron. Dilindungi PLATFORM_SUMMARY_KEY; bila kosong,
 * seluruh permintaan ditolak.
 */
export const dynamic = "force-dynamic";

function isAuthorized(header: string | null): boolean {
  const key = env.PLATFORM_SUMMARY_KEY;
  if (!key || !header?.startsWith("Bearer ")) return false;
  // Dibandingkan lewat digest supaya panjang berbeda pun tidak membocorkan waktu.
  const given = createHash("sha256").update(header.slice("Bearer ".length)).digest();
  const expected = createHash("sha256").update(key).digest();
  return timingSafeEqual(given, expected);
}

export async function GET(req: Request) {
  if (!isAuthorized(req.headers.get("authorization"))) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const summary = await getPlatformSummary();
    return NextResponse.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logger.error("platform.summary_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json({ error: "Gagal menyusun ringkasan" }, { status: 500 });
  }
}
