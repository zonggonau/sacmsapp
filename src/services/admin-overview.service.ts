import { db } from "@/lib/db";
import * as systemService from "@/services/system.service";

/**
 * Ringkasan sistem untuk /admin — docs/10 §10.3.
 *
 * Estimasi biaya vendor sengaja BELUM ada: angkanya berasal dari rekonsiliasi
 * biaya v0 yang dikerjakan di Fase 6. Menampilkan angka karangan lebih buruk
 * daripada tidak menampilkannya.
 */

export interface AttentionItem {
  message: string;
  href: string;
}

const SLOW_JOB_MS = 10 * 60_000;

export async function getOverview() {
  const now = Date.now();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const startOfMonth = new Date(startOfDay);
  startOfMonth.setDate(1);
  const weekAgo = new Date(now - 7 * 24 * 60 * 60_000);
  const hourAgo = new Date(now - 60 * 60_000);

  const [
    users,
    newUsers,
    projects,
    newProjects,
    succeededToday,
    failedToday,
    runningNow,
    credits,
    failedLastHour,
    slowJobs,
    heavyUsers,
    settings,
  ] = await Promise.all([
    db.user.count({ where: { deletedAt: null } }),
    db.user.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
    db.project.count({ where: { deletedAt: null } }),
    db.project.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
    db.buildJob.count({
      where: { status: "SUCCEEDED", finishedAt: { gte: startOfDay } },
    }),
    db.buildJob.count({ where: { status: "FAILED", finishedAt: { gte: startOfDay } } }),
    db.buildJob.count({ where: { status: { in: ["QUEUED", "RUNNING"] } } }),
    db.usageEvent.aggregate({
      _sum: { credits: true },
      where: { state: "COMMITTED", createdAt: { gte: startOfMonth } },
    }),
    db.buildJob.count({ where: { status: "FAILED", finishedAt: { gte: hourAgo } } }),
    db.buildJob.count({
      where: { status: "RUNNING", startedAt: { lt: new Date(now - SLOW_JOB_MS) } },
    }),
    // Pengguna yang sudah memakai >= 90% kreditnya. Batas dihitung dari paket
    // saat ini, sama dengan usageService.getQuota().
    db.$queryRaw<
      Array<{ id: string; email: string; creditsUsed: number; limit: number }>
    >`
      SELECT u.id, u.email, u."creditsUsed", COALESCE(u."creditsOverride", p."monthlyCredits") AS "limit"
      FROM "user" u
      JOIN "plan" p ON p.id = u."planId"
      WHERE u."deletedAt" IS NULL
        AND COALESCE(u."creditsOverride", p."monthlyCredits") > 0
        AND u."creditsUsed" >= 0.9 * COALESCE(u."creditsOverride", p."monthlyCredits")
      ORDER BY u."creditsUsed" DESC
      LIMIT 3
    `,
    systemService.getSettings(),
  ]);

  const finishedToday = succeededToday + failedToday;

  // "Perlu Perhatian" hanya berisi hal yang benar-benar ada. Panel yang selalu
  // penuh peringatan akan diabaikan (docs/10 §10.3).
  const attention: AttentionItem[] = [];
  if (failedLastHour > 0) {
    attention.push({
      message: `${failedLastHour} build gagal dalam 1 jam terakhir`,
      href: "/admin/build?status=FAILED",
    });
  }
  if (slowJobs > 0) {
    attention.push({
      message: `${slowJobs} build berjalan lebih dari 10 menit`,
      href: "/admin/build?status=RUNNING",
    });
  }
  for (const u of heavyUsers) {
    attention.push({
      message: `${u.email} sudah memakai ${u.creditsUsed} dari ${u.limit} kredit`,
      href: `/admin/pengguna/${u.id}`,
    });
  }

  return {
    users,
    newUsers,
    projects,
    newProjects,
    buildsToday: finishedToday,
    failedToday,
    successRate:
      finishedToday > 0 ? Math.round((succeededToday / finishedToday) * 100) : null,
    runningNow,
    creditsThisMonth: credits._sum.credits ?? 0,
    attention,
    settings,
  };
}
