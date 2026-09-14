import { SETTING_KEYS } from "@/config/settings";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { startOfDayWib } from "@/lib/period";
import { getUsageReport, isMockEngine, type V0UsageRecord } from "@/lib/v0/client";
import * as auditService from "@/services/audit.service";

/**
 * Biaya vendor — docs/11 §11.8, docs/09 §9.11.
 *
 * Kredit adalah satuan KOMERSIAL; biaya vendor adalah angka NYATA. Berkas ini
 * mempertemukan keduanya: mengisi UsageEvent.vendorCostIdr dari laporan v0,
 * menyalakan kill switch otomatis bila biaya harian melewati ambang, dan
 * menghitung metrik untuk /admin.
 */

const DAY_MS = 24 * 60 * 60_000;
const DEFAULT_USD_TO_IDR = 16_500;

/* ============================================================
 *  PENCOCOKAN (murni — diuji langsung)
 * ============================================================ */

export interface CostCandidate {
  usageEventId: string;
  chatId: string;
  createdAt: Date;
}

/**
 * Menempelkan setiap biaya v0 ke UsageEvent generate yang memicunya.
 *
 * Satu chat v0 = satu project SaCMS, dan setiap generate/edit adalah satu
 * UsageEvent. Biaya dipasangkan ke UsageEvent terakhir di chat yang sama yang
 * dibuat SEBELUM biaya itu tercatat (toleransi 1 menit untuk selisih jam antar
 * sistem). Biaya tanpa chat, atau di chat yang tidak dikenal, tidak dipasangkan
 * dan dilaporkan sebagai "tak tercocokkan".
 */
export function matchCosts(
  records: V0UsageRecord[],
  candidates: CostCandidate[],
): Map<string, Array<{ recordId: string; usd: number }>> {
  const byChat = new Map<string, CostCandidate[]>();
  for (const c of candidates) {
    const list = byChat.get(c.chatId) ?? [];
    list.push(c);
    byChat.set(c.chatId, list);
  }
  for (const list of byChat.values()) {
    list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  const assigned = new Map<string, Array<{ recordId: string; usd: number }>>();

  for (const r of records) {
    if (!r.chatId) continue;
    const list = byChat.get(r.chatId);
    if (!list || list.length === 0) continue;

    let chosen: CostCandidate | undefined;
    for (const c of list) {
      if (c.createdAt.getTime() <= r.createdAt.getTime() + 60_000) chosen = c;
      else break;
    }
    chosen ??= list[0]!;

    const bucket = assigned.get(chosen.usageEventId) ?? [];
    bucket.push({ recordId: r.id, usd: r.costUsd });
    assigned.set(chosen.usageEventId, bucket);
  }

  return assigned;
}

/* ============================================================
 *  REKONSILIASI
 * ============================================================ */

async function readNumberSetting(key: string, fallback: number): Promise<number> {
  const row = await db.systemSetting.findUnique({
    where: { key },
    select: { value: true },
  });
  const value = typeof row?.value === "number" ? row.value : Number(row?.value);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export interface ReconcileResult {
  skipped: string | null;
  records: number;
  matched: number;
  unmatchedIdr: number;
  totalIdr: number;
}

/**
 * Idempoten: biaya disimpan per id kejadian v0 di `metadata.vendorCosts`, lalu
 * `vendorCostIdr` dihitung ulang dari sana. Menjalankan rentang yang sama dua
 * kali tidak menggandakan biaya.
 */
export async function reconcileRange(start: Date, end: Date): Promise<ReconcileResult> {
  if (isMockEngine) {
    return {
      skipped: "Mesin v0 tiruan aktif — tidak ada biaya vendor.",
      records: 0,
      matched: 0,
      unmatchedIdr: 0,
      totalIdr: 0,
    };
  }

  const [records, rate] = await Promise.all([
    getUsageReport({ start, end }),
    readNumberSetting(SETTING_KEYS.billingUsdToIdr, DEFAULT_USD_TO_IDR),
  ]);

  // Kandidat mulai sehari lebih awal: generate yang dimulai sebelum tengah
  // malam bisa tercatat biayanya setelahnya.
  const rows = await db.usageEvent.findMany({
    where: {
      kind: { in: ["AI_GENERATE", "AI_EDIT"] },
      createdAt: { gte: new Date(start.getTime() - DAY_MS), lte: end },
      buildJob: { project: { v0ChatId: { not: null } } },
    },
    select: {
      id: true,
      createdAt: true,
      metadata: true,
      buildJob: { select: { project: { select: { v0ChatId: true } } } },
    },
  });

  const candidates: CostCandidate[] = rows.flatMap((r) =>
    r.buildJob?.project.v0ChatId
      ? [
          {
            usageEventId: r.id,
            chatId: r.buildJob.project.v0ChatId,
            createdAt: r.createdAt,
          },
        ]
      : [],
  );

  const assigned = matchCosts(records, candidates);
  const toIdr = (usd: number) => Math.round(usd * rate);

  let matchedIdr = 0;
  for (const [usageEventId, costs] of assigned) {
    const row = rows.find((r) => r.id === usageEventId)!;
    const meta =
      typeof row.metadata === "object" &&
      row.metadata !== null &&
      !Array.isArray(row.metadata)
        ? (row.metadata as Record<string, unknown>)
        : {};
    const previous =
      typeof meta.vendorCosts === "object" && meta.vendorCosts !== null
        ? (meta.vendorCosts as Record<string, number>)
        : {};

    const vendorCosts: Record<string, number> = { ...previous };
    for (const c of costs) vendorCosts[c.recordId] = toIdr(c.usd);

    const total = Object.values(vendorCosts).reduce(
      (sum, v) => sum + (Number(v) || 0),
      0,
    );
    matchedIdr += costs.reduce((sum, c) => sum + toIdr(c.usd), 0);

    await db.usageEvent.update({
      where: { id: usageEventId },
      data: { vendorCostIdr: total, metadata: { ...meta, vendorCosts } },
    });
  }

  const totalIdr = records.reduce((sum, r) => sum + toIdr(r.costUsd), 0);
  const matched = [...assigned.values()].reduce((n, list) => n + list.length, 0);
  const result = {
    skipped: null,
    records: records.length,
    matched,
    unmatchedIdr: totalIdr - matchedIdr,
    totalIdr,
  };

  logger.info("cost.reconciled", { start: start.toISOString(), ...result });
  return result;
}

/** Dipanggil cron harian 02:00 WIB: merekonsiliasi hari kalender WIB kemarin. */
export async function reconcileYesterday(): Promise<
  ReconcileResult & { killSwitchTriggered: boolean }
> {
  const today = startOfDayWib();
  const yesterday = new Date(today.getTime() - DAY_MS);
  const result = await reconcileRange(yesterday, today);

  const killSwitchTriggered = result.skipped
    ? false
    : await enforceDailyCostThreshold(result.totalIdr, yesterday);

  return { ...result, killSwitchTriggered };
}

/**
 * Pengaman terakhir — docs/09 §9.11: biaya harian melewati ambang -> kill switch
 * menyala OTOMATIS dan Super Admin diberi tahu. Satu bug perulangan bisa
 * menghabiskan anggaran sebulan dalam satu jam.
 *
 * @returns true bila kill switch baru saja dinyalakan.
 */
export async function enforceDailyCostThreshold(
  totalIdr: number,
  day: Date,
): Promise<boolean> {
  const threshold = await readNumberSetting(SETTING_KEYS.aiDailyCostThreshold, 0);
  if (threshold <= 0 || totalIdr <= threshold) return false;

  const current = await db.systemSetting.findUnique({
    where: { key: SETTING_KEYS.aiKillSwitch },
    select: { value: true },
  });
  if (current?.value === true) return false;

  await db.systemSetting.upsert({
    where: { key: SETTING_KEYS.aiKillSwitch },
    update: { value: true, updatedById: null },
    create: { key: SETTING_KEYS.aiKillSwitch, value: true },
  });

  const detail = { totalIdr, threshold, day: day.toISOString() };

  await auditService.record({
    action: "system.killswitch.auto",
    actorId: null,
    targetType: "SystemSetting",
    targetId: SETTING_KEYS.aiKillSwitch,
    before: { value: false },
    after: { value: true, ...detail },
  });

  const admins = await db.user.findMany({
    where: { role: "SUPER_ADMIN", status: "ACTIVE" },
    select: { id: true },
  });
  if (admins.length > 0) {
    await db.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        type: "cost.threshold",
        title: "Kill switch AI menyala otomatis",
        body: `Biaya vendor kemarin Rp ${totalIdr.toLocaleString("id-ID")} melewati ambang Rp ${threshold.toLocaleString("id-ID")}. Periksa build lalu matikan kill switch dari /admin/ai.`,
        href: "/admin/ai",
      })),
    });
  }

  logger.error("cost.threshold_exceeded", detail);
  return true;
}

/* ============================================================
 *  METRIK /admin
 * ============================================================ */

export interface CostMetrics {
  days: number;
  totalCostIdr: number;
  newLiveWebsites: number;
  /** null bila belum ada website jadi dalam rentang. */
  avgCostPerWebsiteIdr: number | null;
  activeUsers: number;
  costPerActiveUserIdr: number | null;
  unreconciledEvents: number;
  topUsers: Array<{ id: string; email: string; planName: string; creditsUsed: number }>;
  plans: Array<{
    name: string;
    users: number;
    revenueIdr: number;
    costIdr: number;
    marginIdr: number;
  }>;
}

export async function getCostMetrics(days = 30): Promise<CostMetrics> {
  const since = new Date(Date.now() - days * DAY_MS);

  const [cost, unreconciledEvents, liveRows, activeRows, topUsers, plans, costByPlan] =
    await Promise.all([
      db.usageEvent.aggregate({
        _sum: { vendorCostIdr: true },
        where: { createdAt: { gte: since } },
      }),
      db.usageEvent.count({
        where: {
          kind: { in: ["AI_GENERATE", "AI_EDIT"] },
          state: "COMMITTED",
          vendorCostIdr: null,
          createdAt: { gte: since },
        },
      }),
      // "Website jadi" = project yang deployment READY PERTAMA-nya jatuh di rentang.
      db.$queryRaw<Array<{ count: number }>>`
        SELECT COUNT(*)::int AS count FROM (
          SELECT "projectId", MIN("readyAt") AS first_ready
          FROM "deployment"
          WHERE status = 'READY' AND "readyAt" IS NOT NULL
          GROUP BY "projectId"
        ) t
        WHERE t.first_ready >= ${since}
      `,
      db.usageEvent.groupBy({
        by: ["userId"],
        where: { createdAt: { gte: since }, userId: { not: null } },
      }),
      db.user.findMany({
        where: { deletedAt: null, creditsUsed: { gt: 0 } },
        orderBy: { creditsUsed: "desc" },
        take: 10,
        select: {
          id: true,
          email: true,
          creditsUsed: true,
          plan: { select: { name: true } },
        },
      }),
      db.plan.findMany({
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          priceMonthly: true,
          _count: { select: { users: true } },
        },
      }),
      db.$queryRaw<Array<{ planId: string; cost: number }>>`
        SELECT u."planId" AS "planId", COALESCE(SUM(e."vendorCostIdr"), 0)::int AS cost
        FROM "usage_event" e
        JOIN "user" u ON u.id = e."userId"
        WHERE e."createdAt" >= ${since}
        GROUP BY u."planId"
      `,
    ]);

  const totalCostIdr = cost._sum.vendorCostIdr ?? 0;
  const newLiveWebsites = liveRows[0]?.count ?? 0;
  const activeUsers = activeRows.length;

  return {
    days,
    totalCostIdr,
    newLiveWebsites,
    avgCostPerWebsiteIdr:
      newLiveWebsites > 0 ? Math.round(totalCostIdr / newLiveWebsites) : null,
    activeUsers,
    costPerActiveUserIdr:
      activeUsers > 0 ? Math.round(totalCostIdr / activeUsers) : null,
    unreconciledEvents,
    topUsers: topUsers.map((u) => ({
      id: u.id,
      email: u.email,
      planName: u.plan.name,
      creditsUsed: u.creditsUsed,
    })),
    plans: plans.map((p) => {
      // Pendapatan MVP = harga paket × pengguna saat ini (pembayaran manual,
      // docs/11 §11.7). Diskalakan ke rentang metrik.
      const revenueIdr = Math.round(p.priceMonthly * p._count.users * (days / 30));
      const costIdr = costByPlan.find((c) => c.planId === p.id)?.cost ?? 0;
      return {
        name: p.name,
        users: p._count.users,
        revenueIdr,
        costIdr,
        marginIdr: revenueIdr - costIdr,
      };
    }),
  };
}
