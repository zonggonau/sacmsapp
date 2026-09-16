import { expect } from "vitest";

import { db } from "@/lib/db";
import { AppError, type ErrorCode } from "@/lib/errors";

/**
 * Pembantu uji service. Setiap berkas uji membuat datanya sendiri dengan tag
 * unik dan menghapusnya di akhir — aman dijalankan terhadap database pengembang.
 */

export function makeTag(label: string) {
  return `uji-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function fixtures(tag: string) {
  const userIds: string[] = [];

  async function plan(slug: "free" | "pro" | "business" = "free") {
    return db.plan.findUniqueOrThrow({ where: { slug } });
  }

  async function user(
    label: string,
    data: {
      planSlug?: "free" | "pro" | "business";
      role?: "USER" | "ADMIN" | "SUPER_ADMIN";
      creditsUsed?: number;
      creditsOverride?: number | null;
      maxProjectsOverride?: number | null;
      periodStartedAt?: Date;
    } = {},
  ) {
    const { planSlug, ...rest } = data;
    const p = await plan(planSlug);
    const created = await db.user.create({
      data: {
        name: `Uji ${label}`,
        email: `${tag}-${label}@contoh.test`,
        emailVerified: true,
        planId: p.id,
        ...rest,
      },
    });
    userIds.push(created.id);
    return created;
  }

  function project(userId: string, name: string, data: Record<string, unknown> = {}) {
    return db.project.create({
      data: {
        name: `Uji ${name}`,
        slug: `${tag}-${name}`.toLowerCase(),
        initialPrompt: "Website uji otomatis",
        userId,
        ...data,
      },
    });
  }

  /** Project yang sudah punya versi tiruan, siap diterbitkan. */
  async function deployableProject(userId: string, name: string) {
    const p = await project(userId, name, {
      status: "READY",
      v0ProjectId: `prj_mock_${tag}_${name}`,
      v0ChatId: `chat_mock_${tag}_${name}`,
    });
    const version = await db.projectVersion.create({
      data: { projectId: p.id, number: 1, v0VersionId: `ver_mock_${tag}_${name}` },
    });
    return db.project.update({
      where: { id: p.id },
      data: { currentVersionId: version.id },
    });
  }

  /**
   * Kredit di dompet akun (ADR-012). Tanpa ini generate ditolak, karena
   * kredit tidak lagi berasal dari kuota bulanan paket.
   */
  function credits(userId: string, amount = 10) {
    return db.creditLot.create({
      data: {
        userId,
        amount,
        remaining: amount,
        source: "ADMIN",
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
        note: `${tag}-uji`,
      },
    });
  }

  /**
   * Dompet yang benar-benar KOSONG.
   *
   * `build.createJob` memberi kredit sambutan sekali seumur akun, jadi akun
   * baru tidak pernah nol. Lot WELCOME yang sudah habis membuat pemberian itu
   * tidak jalan, sehingga keadaan "kredit habis" bisa diuji.
   */
  function drainedWelcome(userId: string) {
    return db.creditLot.create({
      data: {
        userId,
        amount: 5,
        remaining: 0,
        source: "WELCOME",
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
        note: `${tag}-habis`,
      },
    });
  }

  /** Paket Project aktif — syarat menerbitkan dan memakai custom domain. */
  async function subscribe(
    projectId: string,
    planSlug: "free" | "pro" | "business" = "pro",
  ) {
    const p = await plan(planSlug);
    return db.websiteSubscription.create({
      data: {
        projectId,
        planId: p.id,
        status: "ACTIVE",
        endsAt: new Date(Date.now() + 365 * 24 * 60 * 60_000),
      },
    });
  }

  async function cleanup() {
    if (userIds.length === 0) return;
    await db.usageEvent.deleteMany({ where: { userId: { in: userIds } } });
    await db.notification.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
  }

  return {
    plan,
    user,
    project,
    deployableProject,
    credits,
    drainedWelcome,
    subscribe,
    cleanup,
  };
}

/** Memastikan pemanggilan gagal dengan AppError berkode tertentu. */
export async function expectAppError(
  run: () => Promise<unknown>,
  code: ErrorCode,
  message?: RegExp,
) {
  let caught: unknown;
  try {
    await run();
  } catch (error) {
    caught = error;
  }
  expect(caught, "seharusnya melempar AppError").toBeInstanceOf(AppError);
  const appError = caught as AppError;
  expect(appError.code).toBe(code);
  if (message) expect(appError.userMessage).toMatch(message);
  return appError;
}
