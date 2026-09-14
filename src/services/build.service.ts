import { BUILD_STEPS, progressFromDone, stepsForKind } from "@/config/build-steps";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { sendWebsiteReadyEmail } from "@/lib/mail";
import { v0Engine } from "@/lib/v0/client";
import { buildSystemPrompt, buildUserMessage } from "@/lib/v0/system-prompt";
import { V0Error, type GenerateResult } from "@/lib/v0/types";
import * as planner from "@/services/planner.service";
import * as quotaService from "@/services/quota.service";
import * as systemService from "@/services/system.service";
import * as usageService from "@/services/usage.service";
import type { BuildJobKind, BuildJobStatus } from "@/types/db";

/**
 * Orkestrator pipeline build — docs/09-AI-BUILDER-PIPELINE.md §9.4.
 *
 * Empat aturan yang membentuk seluruh berkas ini:
 * 1. Kredit direservasi SEBELUM kerja dimulai; kegagalan mengembalikannya.
 * 2. Generate tidak pernah otomatis menyentuh production.
 * 3. Setiap langkah punya nama berbahasa Indonesia yang berarti bagi orang awam.
 * 4. Setiap kegagalan menghasilkan satu kalimat yang bisa ditindaklanjuti.
 */

const JOB_TIMEOUT_MS = 15 * 60_000;
const RETRY_BACKOFF_MS = [2_000, 8_000, 20_000];

/**
 * Batas usia job QUEUED sebelum dianggap tidak akan pernah dijalankan.
 *
 * Tanpa batas ini, job yang `after()`-nya tidak sempat berjalan (proses mati,
 * dev server restart) tertinggal QUEUED selamanya: project terus BUILDING,
 * layar progres berputar tanpa akhir, dan kredit pengguna tertahan.
 */
const QUEUE_STALE_MS = 15 * 60_000;

/**
 * Dilempar saat job berhenti di tengah jalan karena statusnya diubah pihak lain
 * (dibatalkan pengguna, disapu cron). Bukan kegagalan: pembatalan sudah
 * mengurus status dan refund, jadi orkestrator cukup berhenti diam-diam.
 */
class JobAbortedError extends Error {
  readonly status: string;

  constructor(status: string) {
    super(`Job berhenti karena status berubah menjadi ${status}`);
    this.name = "JobAbortedError";
    this.status = status;
  }
}

/* ============================================================
 *  PEMBUATAN JOB
 * ============================================================ */

export interface CreateJobInput {
  projectId: string;
  userId: string;
  kind: BuildJobKind;
  prompt: string;
}

/**
 * Membuat job beserta seluruh langkahnya dan mereservasi kredit — satu transaksi.
 *
 * Baris BuildStep dibuat di muka, bukan saat langkahnya berjalan, supaya UI bisa
 * langsung menampilkan seluruh daftar dengan status PENDING. Pengguna melihat
 * apa yang akan terjadi, bukan daftar yang tumbuh perlahan.
 */
export async function createJob(input: CreateJobInput): Promise<{ jobId: string }> {
  if (await systemService.isKillSwitchOn()) {
    throw new AppError(
      "KILL_SWITCH",
      "Pembuatan website sementara dinonaktifkan untuk pemeliharaan.",
    );
  }

  const correlationId = crypto.randomUUID();
  const steps = stepsForKind(input.kind);

  // Job, langkah, status project, dan reservasi kredit dibuat dalam SATU
  // transaksi yang diawali kunci baris pengguna (urutan kunci: user dulu —
  // lihat quota.service). Kuota habis = tidak ada apa pun yang tersimpan, dan
  // dua permintaan bersamaan pada kredit terakhir hanya meloloskan satu.
  const job = await db.$transaction(async (tx) => {
    if (input.kind !== "DEPLOY") {
      await quotaService.lockUserInTx(tx, input.userId);
    }

    const created = await tx.buildJob.create({
      data: {
        projectId: input.projectId,
        kind: input.kind,
        status: "QUEUED",
        prompt: input.prompt,
        correlationId,
        creditsCost: input.kind === "DEPLOY" ? 0 : 1,
        steps: {
          create: steps.map((s) => ({
            key: s.key,
            label: s.label,
            order: s.order,
            status: "PENDING",
          })),
        },
      },
      select: { id: true },
    });

    if (input.kind !== "DEPLOY") {
      await quotaService.reserveCreditsInTx(tx, {
        userId: input.userId,
        kind: input.kind === "INITIAL_GENERATE" ? "AI_GENERATE" : "AI_EDIT",
        credits: 1,
        projectId: input.projectId,
        buildJobId: created.id,
      });
    }

    await tx.project.update({
      where: { id: input.projectId },
      data: { status: "BUILDING", lastBuildAt: new Date() },
    });

    return created;
  });

  logger.info("build.job_created", { jobId: job.id, correlationId, kind: input.kind });
  return { jobId: job.id };
}

/* ============================================================
 *  PEMBANTU LANGKAH
 * ============================================================ */

/**
 * Menjalankan satu langkah.
 *
 * Satu-satunya tempat status langkah berubah. Tidak ada langkah yang boleh
 * mengubah statusnya sendiri di luar fungsi ini — kalau boleh, progres dan
 * durasi akan cepat tidak konsisten.
 */
async function step<T>(
  jobId: string,
  key: string,
  fn: () => Promise<T>,
  doneKeys: string[],
): Promise<T> {
  // Periksa status sebelum setiap langkah. Pembatalan bersifat lokal (tidak
  // menghentikan panggilan v0 yang sedang berjalan), jadi di sinilah hasil
  // job yang sudah dibatalkan dibuang — bukan disimpan lalu ditandai SUCCEEDED.
  const current = await db.buildJob.findUnique({
    where: { id: jobId },
    select: { status: true },
  });
  if (current?.status !== "RUNNING") {
    throw new JobAbortedError(current?.status ?? "HILANG");
  }

  const startedAt = Date.now();

  await db.buildStep.updateMany({
    where: { buildJobId: jobId, key },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  try {
    const result = await fn();

    doneKeys.push(key);
    await db.$transaction([
      db.buildStep.updateMany({
        where: { buildJobId: jobId, key },
        data: {
          status: "DONE",
          finishedAt: new Date(),
          durationMs: Date.now() - startedAt,
        },
      }),
      db.buildJob.update({
        where: { id: jobId },
        data: { progress: progressFromDone(doneKeys) },
      }),
    ]);

    return result;
  } catch (error) {
    await db.buildStep.updateMany({
      where: { buildJobId: jobId, key },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        durationMs: Date.now() - startedAt,
        detail: error instanceof Error ? error.message.slice(0, 500) : null,
      },
    });
    throw error;
  }
}

async function skip(jobId: string, key: string, detail: string, doneKeys: string[]) {
  doneKeys.push(key);
  await db.$transaction([
    db.buildStep.updateMany({
      where: { buildJobId: jobId, key },
      data: { status: "SKIPPED", detail, finishedAt: new Date() },
    }),
    db.buildJob.update({
      where: { id: jobId },
      data: { progress: progressFromDone(doneKeys) },
    }),
  ]);
}

/** Backoff dengan jitter. Tanpa jitter, job yang gagal bersamaan akan mengulang
 * bersamaan dan menabrak rate limit lagi (docs/09 §9.8). */
function jitter(ms: number): number {
  const spread = ms * 0.2;
  return Math.round(ms + (Math.random() * 2 - 1) * spread);
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;

  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      const isRetryable =
        error instanceof V0Error && error.failureClass === "TRANSIENT";

      if (!isRetryable || i === attempts - 1) throw error;

      const wait = jitter(RETRY_BACKOFF_MS[i] ?? 20_000);
      logger.warn("build.retry", { attempt: i + 1, waitMs: wait });
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  throw lastError;
}

/* ============================================================
 *  ORKESTRATOR
 * ============================================================ */

export async function run(jobId: string): Promise<void> {
  const job = await db.buildJob.findUnique({
    where: { id: jobId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          websiteType: true,
          v0ProjectId: true,
          v0ChatId: true,
          status: true,
          userId: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              plan: { select: { allowedModels: true } },
            },
          },
        },
      },
    },
  });

  if (!job) {
    logger.error("build.run.job_missing", { jobId });
    return;
  }

  const log = logger.child({ jobId, correlationId: job.correlationId });

  // KLAIM ATOMIK. run() dipanggil dari beberapa jalur — after() di action,
  // polling status, dan cron run-queued — yang bisa bertabrakan. Hanya satu
  // pemanggil yang berhasil mengubah QUEUED menjadi RUNNING; sisanya berhenti.
  // Tanpa ini, job yang sama bisa berjalan dua kali dan menghasilkan dua versi.
  const claimed = await db.buildJob.updateMany({
    where: { id: jobId, status: "QUEUED" },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      attempt: { increment: 1 },
      timeoutAt: new Date(Date.now() + JOB_TIMEOUT_MS),
    },
  });

  if (claimed.count === 0) {
    log.info("build.run.not_claimed", { status: job.status });
    return;
  }

  // Kill switch diperiksa TIAP job, bukan hanya saat pembuatan — job yang sudah
  // mengantre saat switch dinyalakan juga harus berhenti (docs/09 §9.4).
  if (await systemService.isKillSwitchOn()) {
    await fail(
      job.id,
      "KILL_SWITCH",
      "Pembuatan website sementara dinonaktifkan.",
      null,
    );
    return;
  }

  const doneKeys: string[] = [];
  const project = job.project;

  try {
    const plan = await step(
      jobId,
      "UNDERSTAND",
      async () =>
        planner.plan({
          kind: job.kind === "EDIT_GENERATE" ? "EDIT" : "INITIAL",
          prompt: job.prompt,
          websiteType: project.websiteType,
          allowedModels: project.user.plan.allowedModels,
          requestedModel: await systemService.getDefaultModel(),
        }),
      doneKeys,
    );

    if (plan.suspiciousFlags.length > 0) {
      log.warn("build.prompt_flagged", { flags: plan.suspiciousFlags });
    }

    await step(jobId, "PLAN", async () => plan.spec, doneKeys);

    // Aturan system prompt dibaca SEKALI per job dari pengaturan berversi
    // (docs/10 §10.7), supaya PROVISION dan COMPOSE memakai teks yang sama.
    const rules = await systemService.getSystemPromptRules();

    const v0ProjectId = await step(
      jobId,
      "PROVISION",
      async () => {
        if (project.v0ProjectId) return project.v0ProjectId;

        const created = await withRetry(() =>
          v0Engine.createWorkspace({
            name: project.name,
            description: `Project SaCMS — ${plan.spec.projectTypeLabel}`,
            instructions: buildSystemPrompt(plan, rules),
          }),
        );

        await db.project.update({
          where: { id: project.id },
          data: { v0ProjectId: created },
        });

        return created;
      },
      doneKeys,
    );

    const composed = await step(
      jobId,
      "COMPOSE",
      async () => {
        const system = buildSystemPrompt(plan, rules);
        const message = buildUserMessage(plan);

        // Disimpan untuk investigasi Super Admin (docs/10 §10.5): tanpa ini,
        // "prompt apa yang sebenarnya dikirim?" tidak bisa dijawab setelah
        // aturan diubah.
        await db.buildJob.update({
          where: { id: jobId },
          data: { systemPrompt: system, sentMessage: message, model: plan.model },
        });

        return { system, message };
      },
      doneKeys,
    );

    const generated = await step(
      jobId,
      "GENERATE",
      () =>
        withRetry(() =>
          v0Engine.generate({
            v0ProjectId,
            v0ChatId: project.v0ChatId ?? undefined,
            prompt: composed.message,
            system: composed.system,
            model: plan.model,
          }),
        ),
      doneKeys,
    );

    await step(jobId, "VALIDATE", async () => validate(generated), doneKeys);

    const version = await step(
      jobId,
      "PERSIST",
      () => persistVersion(job.id, project.id, job.prompt, plan.model, generated),
      doneKeys,
    );

    await step(jobId, "PREVIEW", async () => generated.demoUrl, doneKeys);

    // Generate TIDAK PERNAH menerbitkan ke production (docs/09 §9.1 aturan 2,
    // docs/02 §2.4) — termasuk untuk website yang sudah LIVE. Penerbitan adalah
    // tindakan sadar pengguna lewat tombol Terbitkan di Fase 4, supaya satu
    // prompt buruk tidak langsung merusak situs yang sedang dilihat publik.
    await skip(
      jobId,
      "DEPLOY",
      "Penerbitan ke internet dilakukan terpisah lewat tombol Terbitkan.",
      doneKeys,
    );

    await step(
      jobId,
      "FINALIZE",
      () =>
        finalize(job.id, project.id, project.user.id, project.name, generated.demoUrl),
      doneKeys,
    );

    await succeed(job.id);

    log.info("build.succeeded", { versionId: version.id });

    // Email dikirim setelah job final supaya kegagalan pengiriman tidak pernah
    // membuat build yang sudah berhasil terlihat gagal.
    await sendWebsiteReadyEmail({
      to: project.user.email,
      name: project.user.name,
      projectName: project.name,
      url: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/projects/${project.id}/builder`,
    });
  } catch (error) {
    if (error instanceof JobAbortedError) {
      log.info("build.aborted", { status: error.status });
      return;
    }

    log.error("build.failed", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
      failureClass: error instanceof V0Error ? error.failureClass : undefined,
    });
    await handleFailure(job.id, job.attempt + 1, job.maxAttempts, error);
  }
}

/* ============================================================
 *  LANGKAH INDIVIDUAL
 * ============================================================ */

function validate(result: GenerateResult): GenerateResult {
  if (!result.chatId) {
    throw new V0Error("EMPTY", "Mesin AI tidak mengembalikan pengenal chat.");
  }
  if (result.versionStatus === "failed") {
    throw new V0Error("EMPTY", "Mesin AI melaporkan versi gagal dibuat.");
  }
  if (!result.versionId && !result.demoUrl) {
    throw new V0Error("EMPTY", "Mesin AI tidak menghasilkan versi maupun pratinjau.");
  }
  return result;
}

async function persistVersion(
  jobId: string,
  projectId: string,
  userPrompt: string,
  model: string,
  generated: GenerateResult,
) {
  return db.$transaction(async (tx) => {
    const last = await tx.projectVersion.findFirst({
      where: { projectId },
      orderBy: { number: "desc" },
      select: { number: true },
    });

    const version = await tx.projectVersion.create({
      data: {
        projectId,
        number: (last?.number ?? 0) + 1,
        v0VersionId: generated.versionId,
        demoUrl: generated.demoUrl,
        summary: generated.assistantText.slice(0, 2000),
      },
      select: { id: true, number: true },
    });

    // Prompt pengguna disimpan apa adanya; balasan AI disimpan sebagai teks.
    // Keduanya dirender sebagai Markdown tersanitasi, bukan HTML (docs/02 §2.6).
    await tx.aiMessage.createMany({
      data: [
        { projectId, buildJobId: jobId, role: "USER", content: userPrompt },
        {
          projectId,
          buildJobId: jobId,
          role: "ASSISTANT",
          content: generated.assistantText,
        },
      ],
    });

    await tx.project.update({
      where: { id: projectId },
      data: {
        v0ChatId: generated.chatId,
        previewUrl: generated.demoUrl,
        currentVersionId: version.id,
      },
    });

    await tx.usageEvent.updateMany({
      where: { buildJobId: jobId, state: "RESERVED" },
      data: { model },
    });

    return version;
  });
}

async function finalize(
  jobId: string,
  projectId: string,
  userId: string,
  projectName: string,
  demoUrl: string | null,
) {
  const current = await db.project.findUnique({
    where: { id: projectId },
    select: { productionUrl: true },
  });

  await db.project.update({
    where: { id: projectId },
    data: {
      // READY bila belum pernah terbit, LIVE bila sudah. Versi baru ini hanya
      // PRATINJAU — production tetap menayangkan versi lama sampai pengguna
      // menerbitkan ulang. Menurunkan LIVE menjadi READY membuat situs yang
      // sedang tayang terlihat seolah belum pernah terbit.
      status: current?.productionUrl ? "LIVE" : "READY",
      previewUrl: demoUrl,
    },
  });

  await db.notification.create({
    data: {
      userId,
      type: "build.succeeded",
      title: "Website Anda sudah siap",
      body: `"${projectName}" selesai dibangun dan siap dilihat.`,
      href: `/projects/${projectId}/builder`,
    },
  });

  logger.info("build.finalized", { jobId, projectId });
}

/* ============================================================
 *  AKHIR JOB
 * ============================================================ */

async function succeed(jobId: string) {
  const events = await db.usageEvent.findMany({
    where: { buildJobId: jobId, state: "RESERVED" },
    select: { id: true },
  });

  // Bersyarat: job yang dibatalkan di detik terakhir tidak boleh ditimpa
  // menjadi SUCCEEDED, dan kreditnya yang sudah di-refund tidak di-commit.
  const done = await db.buildJob.updateMany({
    where: { id: jobId, status: "RUNNING" },
    data: { status: "SUCCEEDED", finishedAt: new Date(), progress: 100 },
  });

  if (done.count === 0) return;

  for (const e of events) await usageService.commit(e.id);
}

/**
 * Mengembalikan status project setelah job berakhir TANPA versi baru
 * (gagal atau dibatalkan).
 *
 * Status project mencerminkan keadaan WEBSITE-nya, bukan nasib job terakhir.
 * Edit yang gagal pada situs yang sedang tayang tidak mengubah situs itu, jadi
 * statusnya tetap LIVE; kegagalannya sendiri terlihat di job. Hanya project
 * yang belum pernah menghasilkan apa pun yang jatuh ke `fallback`.
 */
async function restoreProjectStatus(projectId: string, fallback: "DRAFT" | "FAILED") {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: { productionUrl: true, previewUrl: true },
  });

  if (!project) return;

  const status = project.productionUrl
    ? "LIVE"
    : project.previewUrl
      ? "READY"
      : fallback;

  await db.project.update({ where: { id: projectId }, data: { status } });
}

/**
 * Menandai job gagal, melewati langkah sisanya, dan mengembalikan kredit.
 *
 * BERSYARAT pada status yang diharapkan: job yang sudah dibatalkan atau selesai
 * tidak pernah ditimpa menjadi FAILED. Mengembalikan false bila tidak ada yang
 * diubah, sehingga refund tidak terjadi dua kali lewat jalur yang berbeda.
 */
async function fail(
  jobId: string,
  errorCode: string,
  errorMessage: string,
  rawError: string | null,
  expected: BuildJobStatus[] = ["QUEUED", "RUNNING"],
): Promise<boolean> {
  const job = await db.buildJob.findUnique({
    where: { id: jobId },
    select: { projectId: true },
  });

  if (!job) return false;

  const updated = await db.buildJob.updateMany({
    where: { id: jobId, status: { in: expected } },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      errorCode,
      errorMessage,
      rawError,
    },
  });

  if (updated.count === 0) return false;

  await db.buildStep.updateMany({
    where: { buildJobId: jobId, status: { in: ["PENDING", "RUNNING"] } },
    data: { status: "SKIPPED", detail: "Dihentikan karena proses gagal" },
  });

  await restoreProjectStatus(job.projectId, "FAILED");

  // Kredit dikembalikan pada SETIAP kegagalan — docs/09 §9.11
  const events = await db.usageEvent.findMany({
    where: { buildJobId: jobId, state: "RESERVED" },
    select: { id: true },
  });
  for (const e of events) await usageService.refund(e.id);

  return true;
}

/**
 * Menerjemahkan kegagalan menjadi perlakuan job — docs/09 §9.8.
 *
 * Pesan yang disimpan di `errorMessage` adalah yang dilihat pengguna, jadi
 * selalu bahasa Indonesia dan selalu menyebut apa yang bisa dilakukan.
 * `rawError` hanya untuk Super Admin.
 */
async function handleFailure(
  jobId: string,
  attempt: number,
  maxAttempts: number,
  error: unknown,
) {
  const raw =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const failureClass = error instanceof V0Error ? error.failureClass : "UNKNOWN";

  // Rate limit: kembali mengantre, lalu dijalankan ulang oleh cron run-queued.
  // Dibatasi maxAttempts supaya job tidak berputar selamanya bila vendor terus
  // membalas 429 — putaran tanpa batas menahan kredit pengguna tanpa hasil.
  if (failureClass === "RATE_LIMIT") {
    if (attempt < maxAttempts) {
      await db.buildJob.updateMany({
        where: { id: jobId, status: "RUNNING" },
        data: { status: "QUEUED", rawError: raw },
      });
      logger.warn("build.requeued_rate_limit", { jobId, attempt, maxAttempts });
      return;
    }

    await fail(
      jobId,
      "RATE_LIMITED",
      "Layanan AI sedang ramai. Silakan coba lagi dalam beberapa menit.",
      raw,
    );
    return;
  }

  if (failureClass === "CONFIG") {
    logger.error("build.config_error", {
      jobId,
      hint: "PERIKSA V0_API_KEY — seluruh build akan gagal sampai diperbaiki.",
      raw,
    });
    await fail(
      jobId,
      "AI_UNAVAILABLE",
      "Layanan AI belum terkonfigurasi dengan benar. Tim kami sudah diberi tahu.",
      raw,
    );
    return;
  }

  if (failureClass === "REJECTED") {
    await fail(
      jobId,
      "VALIDATION",
      "Permintaan Anda ditolak mesin AI. Coba tulis ulang dengan lebih spesifik.",
      raw,
    );
    return;
  }

  if (failureClass === "EMPTY") {
    await fail(
      jobId,
      "AI_UNAVAILABLE",
      "Mesin AI tidak menghasilkan website. Silakan coba lagi.",
      raw,
    );
    return;
  }

  // TRANSIENT yang sampai di sini berarti withRetry SUDAH mencoba 3 kali dengan
  // backoff di dalam proses yang sama. Mengantre ulangnya dulu membuat job
  // macet QUEUED selamanya dan kredit tertahan, karena tidak ada yang
  // menjalankannya lagi. Sekarang langsung FAILED dengan kredit dikembalikan,
  // dan pengguna bisa menekan Coba Lagi.
  await fail(
    jobId,
    "AI_UNAVAILABLE",
    "Layanan AI sedang sibuk. Coba beberapa saat lagi.",
    raw,
  );
}

/* ============================================================
 *  PEMBATALAN, ULANG, STATUS
 * ============================================================ */

export async function cancel({
  jobId,
  userId,
}: {
  jobId: string;
  userId: string;
}): Promise<void> {
  await cancelJob(jobId, { userId });
}

/** Super Admin membatalkan build siapa pun — docs/10 §10.5. */
export async function cancelAsAdmin(jobId: string): Promise<{ projectId: string }> {
  return cancelJob(jobId, null);
}

/**
 * @param owner null = pembatalan oleh admin (tanpa filter pemilik). Selain itu
 *              kepemilikan WAJIB ada di klausa where.
 */
async function cancelJob(
  jobId: string,
  owner: { userId: string } | null,
): Promise<{ projectId: string }> {
  const job = await db.buildJob.findFirst({
    where: {
      id: jobId,
      status: { in: ["QUEUED", "RUNNING"] },
      ...(owner ? { project: { userId: owner.userId, deletedAt: null } } : {}),
    },
    select: { id: true, projectId: true },
  });

  if (!job) {
    throw new AppError("NOT_FOUND", "Proses build tidak ditemukan atau sudah selesai.");
  }

  // Pembatalan bersifat lokal — lihat catatan pada V0Engine di lib/v0/types.ts.
  // Orkestrator yang masih berjalan akan berhenti sendiri di langkah berikutnya
  // (JobAbortedError) dan hasilnya dibuang.
  const updated = await db.buildJob.updateMany({
    where: { id: jobId, status: { in: ["QUEUED", "RUNNING"] } },
    data: { status: "CANCELLED", finishedAt: new Date() },
  });

  if (updated.count === 0) {
    throw new AppError("NOT_FOUND", "Proses build tidak ditemukan atau sudah selesai.");
  }

  await db.buildStep.updateMany({
    where: { buildJobId: jobId, status: { in: ["PENDING", "RUNNING"] } },
    data: {
      status: "SKIPPED",
      detail: owner ? "Dibatalkan pengguna" : "Dibatalkan administrator",
    },
  });

  // Membatalkan edit pada situs yang sudah tayang tidak boleh menjadikannya DRAFT.
  await restoreProjectStatus(job.projectId, "DRAFT");

  const events = await db.usageEvent.findMany({
    where: { buildJobId: jobId, state: "RESERVED" },
    select: { id: true },
  });
  for (const e of events) await usageService.refund(e.id);

  logger.info("build.cancelled", { jobId, byAdmin: owner === null });
  return { projectId: job.projectId };
}

/**
 * Mengulang job gagal.
 *
 * Membuat job BARU, bukan menghidupkan yang lama. Status akhir bersifat final
 * (docs/09 §9.2) — menghidupkan ulang job lama membuat riwayat tidak jujur
 * tentang berapa kali sesuatu gagal.
 */
export async function retry({
  jobId,
  userId,
}: {
  jobId: string;
  userId: string;
}): Promise<{ jobId: string }> {
  const old = await db.buildJob.findFirst({
    where: {
      id: jobId,
      status: { in: ["FAILED", "CANCELLED"] },
      project: { userId, deletedAt: null },
    },
    select: { id: true, projectId: true, kind: true, prompt: true },
  });

  if (!old) {
    throw new AppError(
      "NOT_FOUND",
      "Proses build tidak ditemukan atau tidak bisa diulang.",
    );
  }

  return createJob({
    projectId: old.projectId,
    userId,
    kind: old.kind,
    prompt: old.prompt,
  });
}

/**
 * Super Admin mengulang build siapa pun — docs/10 §10.5.
 *
 * Kredit direservasi dari PEMILIK project, sama seperti bila pemilik menekan
 * Coba Lagi: job ulang memakai kuota yang sama dan tetap di-refund bila gagal.
 */
export async function retryAsAdmin(
  jobId: string,
): Promise<{ jobId: string; projectId: string }> {
  const old = await db.buildJob.findFirst({
    where: {
      id: jobId,
      status: { in: ["FAILED", "CANCELLED"] },
      project: { deletedAt: null },
    },
    select: {
      projectId: true,
      kind: true,
      prompt: true,
      project: { select: { userId: true } },
    },
  });

  if (!old) {
    throw new AppError(
      "NOT_FOUND",
      "Proses build tidak ditemukan atau tidak bisa diulang.",
    );
  }

  const active = await db.buildJob.count({
    where: { projectId: old.projectId, status: { in: ["QUEUED", "RUNNING"] } },
  });
  if (active > 0) {
    throw new AppError("CONFLICT", "Project ini masih punya build yang berjalan.");
  }

  const { jobId: newJobId } = await createJob({
    projectId: old.projectId,
    userId: old.project.userId,
    kind: old.kind,
    prompt: old.prompt,
  });

  return { jobId: newJobId, projectId: old.projectId };
}

export interface BuildStatus {
  jobId: string;
  status: string;
  kind: string;
  progress: number;
  errorCode: string | null;
  errorMessage: string | null;
  startedAt: Date | null;
  finishedAt: Date | null;
  steps: Array<{
    key: string;
    label: string;
    order: number;
    status: string;
    durationMs: number | null;
    detail: string | null;
  }>;
}

export async function getStatus({
  jobId,
  userId,
}: {
  jobId: string;
  userId: string;
}): Promise<BuildStatus | null> {
  const job = await db.buildJob.findFirst({
    where: { id: jobId, project: { userId, deletedAt: null } },
    select: {
      id: true,
      status: true,
      kind: true,
      progress: true,
      errorCode: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
      steps: {
        orderBy: { order: "asc" },
        select: {
          key: true,
          label: true,
          order: true,
          status: true,
          durationMs: true,
          detail: true,
        },
      },
    },
  });

  if (!job) return null;

  return {
    jobId: job.id,
    status: job.status,
    kind: job.kind,
    progress: job.progress,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    steps: job.steps,
  };
}

/** Job terakhir sebuah project, untuk merender keadaan awal halaman builder. */
export async function getLatestJob(projectId: string, userId: string) {
  const job = await db.buildJob.findFirst({
    where: { projectId, project: { userId, deletedAt: null } },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (!job) return null;
  return getStatus({ jobId: job.id, userId });
}

/* ============================================================
 *  CRON: PENYAPU JOB NYANGKUT
 * ============================================================ */

/**
 * Menandai gagal job yang melewati batas waktunya.
 *
 * WAJIB ADA sejak Fase 3, bukan ditambahkan belakangan: `after()` terikat pada
 * siklus hidup fungsi serverless, dan bila fungsinya berakhir lebih awal job
 * akan tertinggal RUNNING selamanya — menahan kredit pengguna dan menampilkan
 * progres yang tidak pernah bergerak (docs/adr/ADR-005).
 */
export async function sweepStuck(): Promise<number> {
  const now = Date.now();

  const stuck = await db.buildJob.findMany({
    where: {
      OR: [
        // Sedang berjalan tapi melewati batas waktunya
        { status: "RUNNING", timeoutAt: { lt: new Date(now) } },
        // Mengantre terlalu lama: after() tidak pernah menjalankannya, atau
        // antrean ulang karena rate limit tidak pernah diambil cron.
        { status: "QUEUED", updatedAt: { lt: new Date(now - QUEUE_STALE_MS) } },
      ],
    },
    select: { id: true, status: true },
  });

  let swept = 0;

  for (const job of stuck) {
    const wasQueued = job.status === "QUEUED";

    // `expected` memakai status saat ditemukan: bila job keburu diklaim atau
    // selesai di antara query dan pembaruan, ia dibiarkan.
    const changed = await fail(
      job.id,
      "AI_TIMEOUT",
      wasQueued
        ? "Pembuatan website tidak sempat dimulai dan dihentikan. Silakan coba lagi."
        : "Pembuatan website memakan waktu terlalu lama dan dihentikan.",
      wasQueued
        ? "Disapu cron: QUEUED melewati batas antre"
        : "Disapu cron: melewati timeoutAt",
      [job.status],
    );

    if (changed) swept += 1;
  }

  if (swept > 0) {
    logger.warn("build.swept_stuck", { count: swept });
  }

  return swept;
}

/**
 * true bila job mengantre tetapi BELUM PERNAH dijalankan.
 *
 * Dipakai jalur polling sebagai jaring pengaman bila after() tidak berjalan.
 * Job yang diantre ulang karena rate limit sudah punya startedAt, jadi tidak
 * dipicu ulang setiap 2 detik — itu tugas cron run-queued, supaya vendor yang
 * sedang membatasi tidak ditembak terus-menerus.
 */
export function needsKick(job: { status: string; startedAt: Date | null }): boolean {
  return job.status === "QUEUED" && job.startedAt === null;
}

/** Mengambil job yang mengantre dan menjalankannya. Dipanggil cron. */
export async function runQueued(limit = 3): Promise<number> {
  const queued = await db.buildJob.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  for (const job of queued) await run(job.id);
  return queued.length;
}

export { BUILD_STEPS };
