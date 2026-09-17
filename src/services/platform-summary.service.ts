import * as overviewService from "@/services/admin-overview.service";
import * as costService from "@/services/cost.service";

/**
 * Ringkasan nocode untuk panel admin SaCMS — ADR-016.
 *
 * SaCMS hanya MENAMPILKAN angka ini; setiap aksi tetap dikerjakan di /admin milik
 * kita, karena aksi itu bergantung pada Better Auth, v0, Vercel, dan ledger kredit
 * yang hanya ada di sini.
 *
 * Data pribadi sengaja tidak ikut dikirim: peringatan pemakaian kredit dari
 * getOverview() menyebut email pengguna, jadi diganti kalimat tanpa identitas.
 * Detailnya dibuka lewat tautan ke /admin kita.
 */

export interface PlatformSummaryPlan {
  name: string;
  users: number;
  revenueIdr: number;
  costIdr: number;
  marginIdr: number;
}

export interface PlatformSummary {
  generatedAt: string;
  users: { total: number; newLast7Days: number };
  projects: { total: number; newLast7Days: number };
  builds: {
    finishedToday: number;
    failedToday: number;
    /** null bila belum ada build selesai hari ini. */
    successRatePercent: number | null;
    runningNow: number;
  };
  creditsUsedThisMonth: number;
  finance30Days: {
    /** Estimasi: harga paket bulanan × pengguna saat ini — sama dengan getCostMetrics(). */
    revenueIdr: number;
    aiCostIdr: number;
    marginIdr: number;
    newLiveWebsites: number;
    /** Event AI yang biaya vendornya belum direkonsiliasi — angka biaya belum final. */
    unreconciledEvents: number;
    plans: PlatformSummaryPlan[];
  };
  system: { killSwitch: boolean; maintenance: boolean; signupEnabled: boolean };
  /** `path` relatif terhadap aplikasi nocode, mis. "/admin/build?status=FAILED". */
  attention: Array<{ message: string; path: string }>;
}

type Overview = Awaited<ReturnType<typeof overviewService.getOverview>>;

const USER_DETAIL_PATH = "/admin/pengguna/";

export function toPlatformSummary(
  overview: Overview,
  cost: costService.CostMetrics,
  now: Date,
): PlatformSummary {
  const plans = cost.plans.map((p) => ({
    name: p.name,
    users: p.users,
    revenueIdr: p.revenueIdr,
    costIdr: p.costIdr,
    marginIdr: p.marginIdr,
  }));
  const revenueIdr = plans.reduce((sum, p) => sum + p.revenueIdr, 0);

  const attention: PlatformSummary["attention"] = [];
  let heavyUsers = false;
  for (const item of overview.attention) {
    if (item.href.startsWith(USER_DETAIL_PATH)) {
      heavyUsers = true;
      continue;
    }
    attention.push({ message: item.message, path: item.href });
  }
  if (heavyUsers) {
    attention.push({
      message: "Ada pengguna yang sudah memakai 90% atau lebih dari kreditnya",
      path: "/admin/pengguna",
    });
  }

  return {
    generatedAt: now.toISOString(),
    users: { total: overview.users, newLast7Days: overview.newUsers },
    projects: { total: overview.projects, newLast7Days: overview.newProjects },
    builds: {
      finishedToday: overview.buildsToday,
      failedToday: overview.failedToday,
      successRatePercent: overview.successRate,
      runningNow: overview.runningNow,
    },
    creditsUsedThisMonth: overview.creditsThisMonth,
    finance30Days: {
      revenueIdr,
      aiCostIdr: cost.totalCostIdr,
      marginIdr: revenueIdr - cost.totalCostIdr,
      newLiveWebsites: cost.newLiveWebsites,
      unreconciledEvents: cost.unreconciledEvents,
      plans,
    },
    system: {
      killSwitch: overview.settings.killSwitch,
      maintenance: overview.settings.maintenance,
      signupEnabled: overview.settings.signupEnabled,
    },
    attention,
  };
}

export async function getPlatformSummary(): Promise<PlatformSummary> {
  const [overview, cost] = await Promise.all([
    overviewService.getOverview(),
    costService.getCostMetrics(30),
  ]);
  return toPlatformSummary(overview, cost, new Date());
}
