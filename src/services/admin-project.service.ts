import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { AuditTrail } from "@/services/audit.service";
import * as deployService from "@/services/deploy.service";
import type { ProjectStatus } from "@/types/db";

/**
 * Semua project lintas pengguna — docs/10 §10.5.
 *
 * Detail menampilkan pengenal vendor yang tidak dilihat pengguna. Satu-satunya
 * tindakan tulis adalah rollback darurat (runbook docs/12 §12.7).
 */

/**
 * Runbook "hasil AI merusak situs pengguna" — docs/12 §12.7.
 *
 * Menerbitkan ulang versi yang pernah berhasil ATAS NAMA pemilik project, lewat
 * jalur deploy yang sama (ADR-008). Semua penjagaan request() tetap berlaku.
 */
export async function rollbackAsAdmin(input: {
  projectId: string;
  deploymentId: string;
}): Promise<AuditTrail & { deploymentId: string }> {
  const project = await db.project.findFirst({
    where: { id: input.projectId, deletedAt: null },
    select: { id: true, userId: true },
  });
  if (!project) {
    throw new AppError("NOT_FOUND", "Project tidak ditemukan atau sudah dihapus.");
  }

  const { deploymentId } = await deployService.rollback({
    projectId: project.id,
    userId: project.userId,
    deploymentId: input.deploymentId,
  });

  return {
    deploymentId,
    targetType: "Project",
    targetId: project.id,
    after: { rollbackTo: input.deploymentId, newDeploymentId: deploymentId },
  };
}

const PAGE_SIZE = 30;

export async function list(f: {
  q?: string | undefined;
  status?: ProjectStatus | undefined;
  cursor?: string | undefined;
}) {
  const rows = await db.project.findMany({
    where: {
      ...(f.status ? { status: f.status } : {}),
      ...(f.q
        ? {
            OR: [
              { name: { contains: f.q, mode: "insensitive" } },
              { user: { email: { contains: f.q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
    select: {
      id: true,
      name: true,
      status: true,
      websiteType: true,
      productionUrl: true,
      deletedAt: true,
      createdAt: true,
      user: { select: { id: true, email: true } },
      _count: { select: { versions: true, buildJobs: true } },
    },
  });

  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE);
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

export async function getDetail(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      websiteType: true,
      initialPrompt: true,
      v0ProjectId: true,
      v0ChatId: true,
      vercelProjectId: true,
      previewUrl: true,
      productionUrl: true,
      currentVersionId: true,
      lastBuildAt: true,
      lastDeployAt: true,
      deletedAt: true,
      createdAt: true,
      user: { select: { id: true, email: true, name: true } },
      // ADR-012: Paket Project website ini, untuk formulir aktivasi admin.
      subscription: {
        select: {
          status: true,
          startsAt: true,
          endsAt: true,
          paymentRef: true,
          plan: { select: { id: true, name: true } },
        },
      },
      versions: {
        orderBy: { number: "desc" },
        select: {
          id: true,
          number: true,
          v0VersionId: true,
          summary: true,
          createdAt: true,
        },
      },
      buildJobs: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: { id: true, status: true, kind: true, createdAt: true },
      },
      deployments: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          status: true,
          url: true,
          vercelDeploymentId: true,
          errorMessage: true,
          createdAt: true,
        },
      },
      domains: { select: { id: true, name: true, status: true } },
    },
  });

  if (!project) return null;

  const [credits, plans] = await Promise.all([
    db.usageEvent.aggregate({
      _sum: { credits: true },
      where: { projectId, state: "COMMITTED" },
    }),
    // ADR-012: pilihan Paket Project untuk formulir aktivasi.
    db.plan.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, priceYearly: true },
    }),
  ]);

  return { ...project, creditsSpent: credits._sum.credits ?? 0, plans };
}
