import { db } from "@/lib/db";
import type { AuditTrail } from "@/services/audit.service";
import * as buildService from "@/services/build.service";
import type { BuildJobStatus } from "@/types/db";

/**
 * Pusat pemecahan masalah build — docs/10 §10.5.
 *
 * Satu-satunya tempat `rawError`, prompt lengkap, dan system prompt dibaca.
 * Tidak ada fungsi di sini yang boleh dipanggil dari rute pengguna.
 */

const PAGE_SIZE = 30;
const SLOW_JOB_MS = 10 * 60_000;

export const BUILD_STATUSES: BuildJobStatus[] = [
  "QUEUED",
  "RUNNING",
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
];

export interface AdminBuildListItem {
  id: string;
  status: BuildJobStatus;
  kind: string;
  userEmail: string;
  projectId: string;
  projectName: string;
  attempt: number;
  maxAttempts: number;
  durationMs: number | null;
  isSlow: boolean;
  createdAt: Date;
}

function duration(startedAt: Date | null, finishedAt: Date | null): number | null {
  if (!startedAt) return null;
  return (finishedAt ?? new Date()).getTime() - startedAt.getTime();
}

export async function list(f: {
  status?: BuildJobStatus | undefined;
  cursor?: string | undefined;
}): Promise<{
  items: AdminBuildListItem[];
  nextCursor: string | null;
  counts: Record<string, number>;
}> {
  const [rows, grouped] = await Promise.all([
    db.buildJob.findMany({
      where: f.status ? { status: f.status } : {},
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: PAGE_SIZE + 1,
      ...(f.cursor ? { cursor: { id: f.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        status: true,
        kind: true,
        attempt: true,
        maxAttempts: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
        project: {
          select: { id: true, name: true, user: { select: { email: true } } },
        },
      },
    }),
    db.buildJob.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const now = Date.now();
  const hasMore = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE).map((j) => ({
    id: j.id,
    status: j.status,
    kind: j.kind,
    userEmail: j.project.user.email,
    projectId: j.project.id,
    projectName: j.project.name,
    attempt: j.attempt,
    maxAttempts: j.maxAttempts,
    durationMs: duration(j.startedAt, j.finishedAt),
    isSlow:
      j.status === "RUNNING" &&
      j.startedAt !== null &&
      now - j.startedAt.getTime() > SLOW_JOB_MS,
    createdAt: j.createdAt,
  }));

  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));

  return {
    items,
    nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null,
    counts,
  };
}

export async function getDetail(jobId: string) {
  const job = await db.buildJob.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      kind: true,
      status: true,
      progress: true,
      attempt: true,
      maxAttempts: true,
      errorCode: true,
      errorMessage: true,
      rawError: true,
      prompt: true,
      systemPrompt: true,
      sentMessage: true,
      model: true,
      correlationId: true,
      creditsCost: true,
      createdAt: true,
      startedAt: true,
      finishedAt: true,
      timeoutAt: true,
      project: {
        select: {
          id: true,
          name: true,
          deletedAt: true,
          user: { select: { id: true, email: true, name: true } },
        },
      },
      steps: {
        orderBy: { order: "asc" },
        select: {
          key: true,
          label: true,
          order: true,
          status: true,
          detail: true,
          startedAt: true,
          finishedAt: true,
          durationMs: true,
        },
      },
      usageEvents: {
        select: { id: true, kind: true, state: true, credits: true, createdAt: true },
      },
    },
  });

  if (!job) return null;
  return { ...job, durationMs: duration(job.startedAt, job.finishedAt) };
}

export async function cancel(
  jobId: string,
): Promise<AuditTrail & { projectId: string }> {
  const { projectId } = await buildService.cancelAsAdmin(jobId);
  return {
    projectId,
    targetType: "BuildJob",
    targetId: jobId,
    after: { status: "CANCELLED" },
  };
}

export async function retry(
  jobId: string,
): Promise<AuditTrail & { projectId: string; newJobId: string }> {
  const { jobId: newJobId, projectId } = await buildService.retryAsAdmin(jobId);
  return {
    projectId,
    newJobId,
    targetType: "BuildJob",
    targetId: jobId,
    after: { newJobId },
  };
}
