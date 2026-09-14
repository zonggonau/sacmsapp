"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { authActionClient } from "@/lib/safe-action";
import {
  jobIdSchema,
  restoreVersionSchema,
  sendBuilderMessageSchema,
  startBuildSchema,
} from "@/schemas/builder.schema";
import * as buildService from "@/services/build.service";

/**
 * Aksi builder — docs/08-SERVER-ACTIONS.md §8.6.
 *
 * Pola yang berulang di seluruh berkas ini: kerja panjang TIDAK ditunggu.
 * Job dibuat lalu dijalankan lewat `after()`, sehingga respons langsung kembali
 * dan pengguna melihat layar progres — bukan tombol yang membeku 3 menit.
 */

function revalidateBuilder(projectId: string) {
  revalidatePath(`/projects/${projectId}/builder`);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

/** Memastikan project milik pengguna. Mengembalikan data yang dibutuhkan aksi. */
async function requireOwnedProject(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true, name: true, initialPrompt: true, v0ChatId: true, status: true },
  });

  if (!project) throw new AppError("NOT_FOUND", "Project tidak ditemukan.");
  return project;
}

/** Menolak bila masih ada build berjalan — dua generate paralel pada satu chat
 * v0 menghasilkan versi yang saling menimpa. */
async function requireNoActiveJob(projectId: string) {
  const active = await db.buildJob.findFirst({
    where: { projectId, status: { in: ["QUEUED", "RUNNING"] } },
    select: { id: true },
  });

  if (active) {
    throw new AppError(
      "CONFLICT",
      "Masih ada proses yang sedang berjalan untuk project ini. Tunggu sampai selesai.",
    );
  }
}

// ============================================================
//  MULAI BUILD PERTAMA
// ============================================================

export const startBuild = authActionClient
  .metadata({
    actionName: "build.start",
    rateLimit: { key: "generateAi" },
    audit: true,
  })
  .inputSchema(startBuildSchema)
  .action(async ({ parsedInput, ctx }) => {
    const project = await requireOwnedProject(parsedInput.projectId, ctx.user.id);
    await requireNoActiveJob(project.id);

    const { jobId } = await buildService.createJob({
      projectId: project.id,
      userId: ctx.user.id,
      kind: "INITIAL_GENERATE",
      prompt: project.initialPrompt,
    });

    // Pipeline jalan setelah respons terkirim.
    after(() => buildService.run(jobId));

    revalidateBuilder(project.id);
    return { jobId };
  });

// ============================================================
//  EDIT LEWAT PROMPT
// ============================================================

export const sendBuilderMessage = authActionClient
  .metadata({
    actionName: "build.message",
    rateLimit: { key: "generateAi" },
    audit: true,
  })
  .inputSchema(sendBuilderMessageSchema)
  .action(async ({ parsedInput, ctx }) => {
    const project = await requireOwnedProject(parsedInput.projectId, ctx.user.id);
    await requireNoActiveJob(project.id);

    if (!project.v0ChatId) {
      throw new AppError(
        "CONFLICT",
        "Website ini belum pernah dibangun. Jalankan pembuatan pertama dulu.",
      );
    }

    const { jobId } = await buildService.createJob({
      projectId: project.id,
      userId: ctx.user.id,
      kind: "EDIT_GENERATE",
      prompt: parsedInput.message,
    });

    after(() => buildService.run(jobId));

    revalidateBuilder(project.id);
    return { jobId };
  });

// ============================================================
//  STATUS (dipanggil polling tiap 2 detik)
// ============================================================

/**
 * Sengaja TANPA rate limit dan TANPA audit.
 *
 * Ini aksi baca yang dipanggil berulang oleh UI progres. Memberinya rate limit
 * akan memblokir pengguna yang menonton build-nya sendiri, dan mencatatnya ke
 * audit akan membanjiri tabel audit dengan ratusan baris tak berguna per build.
 */
export const getBuildStatus = authActionClient
  .metadata({ actionName: "build.status" })
  .inputSchema(jobIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const status = await buildService.getStatus({
      jobId: parsedInput.jobId,
      userId: ctx.user.id,
    });

    // Jaring pengaman: bila after() yang seharusnya menjalankan job tidak
    // pernah berjalan (proses mati, dev server restart), polling pertama yang
    // melihat job belum dimulai akan menjalankannya. Aman dipanggil berulang —
    // run() mengklaim job secara atomik, jadi job tidak pernah berjalan dua kali.
    if (status && buildService.needsKick(status)) {
      after(() => buildService.run(status.jobId));
    }

    return status;
  });

// ============================================================
//  BATALKAN & ULANGI
// ============================================================

export const cancelBuild = authActionClient
  .metadata({ actionName: "build.cancel", audit: true })
  .inputSchema(jobIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    await buildService.cancel({ jobId: parsedInput.jobId, userId: ctx.user.id });

    const job = await db.buildJob.findUnique({
      where: { id: parsedInput.jobId },
      select: { projectId: true },
    });
    if (job) revalidateBuilder(job.projectId);

    return { cancelled: true };
  });

export const retryBuild = authActionClient
  .metadata({
    actionName: "build.retry",
    rateLimit: { key: "generateAi" },
    audit: true,
  })
  .inputSchema(jobIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { jobId } = await buildService.retry({
      jobId: parsedInput.jobId,
      userId: ctx.user.id,
    });

    after(() => buildService.run(jobId));

    const job = await db.buildJob.findUnique({
      where: { id: jobId },
      select: { projectId: true },
    });
    if (job) revalidateBuilder(job.projectId);

    return { jobId };
  });

// ============================================================
//  RIWAYAT VERSI
// ============================================================

export const restoreVersion = authActionClient
  .metadata({ actionName: "build.restore_version", audit: true })
  .inputSchema(restoreVersionSchema)
  .action(async ({ parsedInput, ctx }) => {
    const project = await requireOwnedProject(parsedInput.projectId, ctx.user.id);

    const version = await db.projectVersion.findFirst({
      where: { id: parsedInput.versionId, projectId: project.id },
      select: { id: true, demoUrl: true, number: true },
    });

    if (!version) throw new AppError("NOT_FOUND", "Versi tidak ditemukan.");

    // Memulihkan versi hanya mengubah versi AKTIF dan pratinjau. Production
    // tidak tersentuh sampai pengguna menerbitkan ulang secara sadar.
    await db.project.update({
      where: { id: project.id },
      data: { currentVersionId: version.id, previewUrl: version.demoUrl },
    });

    revalidateBuilder(project.id);
    return { versionNumber: version.number };
  });
