import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import * as creditService from "@/services/credit.service";
import * as deployService from "@/services/deploy.service";
import * as subscriptionService from "@/services/subscription.service";

/**
 * Cron siklus Paket Project — ADR-012, docs/14 §14.8 (sekali sehari).
 *
 * DI SINI letak penurunan situs, bukan di subscription.service: service itu
 * sengaja tidak mengimpor deploy.service supaya tidak ada impor melingkar
 * (deploy.service memeriksa langganan sebelum menerbitkan). Cron yang
 * menjembatani keduanya.
 *
 * Urutan penting: status diubah lebih dulu, baru situsnya diturunkan. Bila
 * penurunan gagal, statusnya sudah benar dan percobaan berikutnya tinggal
 * mengulang penurunan — bukan sebaliknya.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");

  if (!env.CRON_SECRET || auth !== `Bearer ${env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const swept = await subscriptionService.sweep();

    let takenDown = 0;
    for (const projectId of swept.takeDown) {
      try {
        await deployService.takeDown(projectId);
        takenDown += 1;
      } catch (error) {
        // Satu situs yang gagal diturunkan tidak boleh menghentikan sisanya.
        logger.error("cron.subscription_takedown_failed", {
          projectId,
          reason: error instanceof Error ? error.message : "tidak diketahui",
        });
      }
    }

    const creditsExpiring = await creditService.notifyExpiringLots();

    return NextResponse.json({
      ok: true,
      reminded: swept.reminded,
      graced: swept.graced,
      expired: swept.expired,
      takenDown,
      creditsExpiring,
    });
  } catch (error) {
    logger.error("cron.subscription_lifecycle_failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return NextResponse.json(
      { ok: false, error: "Gagal menjalankan siklus langganan" },
      { status: 500 },
    );
  }
}
