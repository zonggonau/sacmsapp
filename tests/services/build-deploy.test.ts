import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as adminBuild from "@/services/admin-build.service";
import * as build from "@/services/build.service";
import * as deploy from "@/services/deploy.service";
import * as domain from "@/services/domain.service";
import { plan as planBuild } from "@/services/planner.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** docs/09 & ADR-008 — siklus build, penerbitan, dan domain dengan mesin tiruan. */

const tag = makeTag("bangun");
const f = fixtures(tag);

afterAll(() => f.cleanup());

/** Menunggu deployment mencapai status akhir lewat jalur polling pengguna. */
async function waitForDeployment(deploymentId: string, userId: string) {
  for (let i = 0; i < 40; i += 1) {
    const status = await deploy.getStatus({ deploymentId, userId });
    if (status && ["READY", "ERROR", "CANCELED"].includes(status.status)) return status;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Deployment tidak selesai tepat waktu");
}

describe("siklus build", () => {
  it("generate awal sukses: versi, status, dan kredit final", async () => {
    const u = await f.user("sukses");
    const p = await f.project(u.id, "sukses");

    const { jobId } = await build.createJob({
      projectId: p.id,
      userId: u.id,
      kind: "INITIAL_GENERATE",
      prompt: "Website sekolah dengan profil dan berita",
    });
    expect(build.needsKick({ status: "QUEUED", startedAt: null })).toBe(true);

    await build.run(jobId);

    const status = await build.getStatus({ jobId, userId: u.id });
    expect(status?.status).toBe("SUCCEEDED");
    expect(status?.progress).toBe(100);
    expect(status?.steps).toHaveLength(10); // docs/09: 10 langkah build
    expect((await build.getLatestJob(p.id, u.id))?.jobId).toBe(jobId);

    const saved = await db.project.findUniqueOrThrow({ where: { id: p.id } });
    expect(saved.status).toBe("READY");
    expect(saved.currentVersionId).toBeTruthy();
    expect(
      (await db.usageEvent.findFirstOrThrow({ where: { buildJobId: jobId } })).state,
    ).toBe("COMMITTED");

    // Pemilik lain tidak bisa membaca status job ini.
    const other = await f.user("asing");
    expect(await build.getStatus({ jobId, userId: other.id })).toBeNull();

    // Menjalankan ulang job final tidak mengubah apa pun.
    await build.run(jobId);
    expect((await build.getStatus({ jobId, userId: u.id }))?.status).toBe("SUCCEEDED");
  });

  it("gagal lalu diulang oleh pengguna dan admin membuat job baru", async () => {
    const u = await f.user("ulang", { maxProjectsOverride: 3 });
    const p = await f.project(u.id, "ulang");
    const { jobId } = await build.createJob({
      projectId: p.id,
      userId: u.id,
      kind: "EDIT_GENERATE",
      prompt: "SIMULASI_GAGAL_KONFIG",
    });
    await build.run(jobId);

    const failed = await build.getStatus({ jobId, userId: u.id });
    expect(failed?.status).toBe("FAILED");
    expect(failed?.errorMessage).toBeTruthy();

    const { jobId: retried } = await build.retry({ jobId, userId: u.id });
    expect(retried).not.toBe(jobId);
    await expectAppError(() => adminBuild.retry(jobId), "CONFLICT");

    await adminBuild.cancel(retried);
    await expectAppError(
      () => build.cancel({ jobId: retried, userId: u.id }),
      "NOT_FOUND",
    );

    const again = await adminBuild.retry(retried);
    expect(again.projectId).toBe(p.id);
    await build.cancelAsAdmin(again.newJobId);

    await expectAppError(
      () => build.retry({ jobId: "tidak-ada", userId: u.id }),
      "NOT_FOUND",
    );
    await expectAppError(() => build.retryAsAdmin("tidak-ada"), "NOT_FOUND");

    const detail = await adminBuild.getDetail(jobId);
    expect(detail).toBeTruthy();
    const listed = await adminBuild.list({ status: "CANCELLED" });
    expect(listed.items.length).toBeGreaterThan(0);
  });

  it("penyapu cron menggagalkan job nyangkut dan mengembalikan kredit", async () => {
    const u = await f.user("nyangkut");
    const p = await f.project(u.id, "nyangkut");
    const { jobId } = await build.createJob({
      projectId: p.id,
      userId: u.id,
      kind: "INITIAL_GENERATE",
      prompt: "x",
    });
    await db.buildJob.update({
      where: { id: jobId },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        timeoutAt: new Date(Date.now() - 60_000),
      },
    });

    expect(await build.sweepStuck()).toBeGreaterThanOrEqual(1);
    const job = await db.buildJob.findUniqueOrThrow({ where: { id: jobId } });
    expect(job.status).toBe("FAILED");
    expect(job.errorCode).toBe("AI_TIMEOUT");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).creditsUsed).toBe(
      0,
    );
  });

  it("runQueued mengambil job antrean", async () => {
    const u = await f.user("antre");
    const p = await f.project(u.id, "antre");
    await build.createJob({
      projectId: p.id,
      userId: u.id,
      kind: "INITIAL_GENERATE",
      prompt: "x",
    });

    expect(await build.runQueued(50)).toBeGreaterThanOrEqual(1);
  });

  it("planner menyusun rencana dari prompt", () => {
    const result = planBuild({
      kind: "INITIAL",
      websiteType: "CUSTOM",
      prompt: "Website sekolah dasar dengan berita dan galeri",
      allowedModels: ["v0-mini"],
    });
    expect(result.kind).toBe("INITIAL");
    expect(result.sanitizedPrompt).toContain("sekolah");
  });
});

describe("penerbitan", () => {
  it("terbit, rollback, dan menolak penerbitan ganda", async () => {
    const u = await f.user("terbit", { planSlug: "business" });
    const p = await f.deployableProject(u.id, "terbit");

    const { deploymentId } = await deploy.request({ projectId: p.id, userId: u.id });
    await expectAppError(
      () => deploy.request({ projectId: p.id, userId: u.id }),
      "CONFLICT",
      /masih berjalan/,
    );

    await deploy.start(deploymentId);
    await deploy.start(deploymentId); // klaim atomik: aman dipanggil ulang
    const done = await waitForDeployment(deploymentId, u.id);
    expect(done.status).toBe("READY");

    const live = await db.project.findUniqueOrThrow({ where: { id: p.id } });
    expect(live.status).toBe("LIVE");
    expect(live.productionUrl).toMatch(/^https:\/\//);

    const page = await deploy.getPageData(p.id, u.id);
    expect(page).toBeTruthy();

    await expectAppError(
      () => deploy.rollback({ projectId: p.id, userId: u.id, deploymentId }),
      "CONFLICT",
      /sedang tayang/,
    );
    await expectAppError(
      () =>
        deploy.rollback({ projectId: p.id, userId: u.id, deploymentId: "tidak-ada" }),
      "NOT_FOUND",
    );

    expect(await deploy.syncActive()).toBeGreaterThanOrEqual(0);
    await deploy.syncFromWebhook({ vercelDeploymentId: null, vercelProjectId: null });

    const stranger = await f.user("terbit-asing");
    await expectAppError(
      () => deploy.request({ projectId: p.id, userId: stranger.id }),
      "NOT_FOUND",
    );
    expect(await deploy.getStatus({ deploymentId, userId: stranger.id })).toBeNull();
  });

  it("menolak project tanpa versi dan project arsip", async () => {
    const u = await f.user("tanpa-versi", { maxProjectsOverride: 3 });
    const empty = await f.project(u.id, "kosong");
    await expectAppError(
      () => deploy.request({ projectId: empty.id, userId: u.id }),
      "VALIDATION",
    );

    const archived = await f.project(u.id, "arsip", { status: "ARCHIVED" });
    await expectAppError(
      () => deploy.request({ projectId: archived.id, userId: u.id }),
      "CONFLICT",
      /diarsipkan/,
    );
  });
});

describe("custom domain", () => {
  it("menambah, memeriksa, dan melepas domain di paket Business", async () => {
    const u = await f.user("domain", { planSlug: "business" });
    const p = await f.deployableProject(u.id, "domain");

    await expectAppError(
      () => domain.add({ projectId: p.id, userId: u.id, domain: `${tag}.com` }),
      "CONFLICT",
      /Terbitkan website Anda terlebih dahulu/,
    );

    await db.project.update({
      where: { id: p.id },
      data: {
        productionUrl: "https://x.tiruan.invalid",
        vercelProjectId: `prj_mock_${tag}`,
      },
    });

    const name = `${tag}.com`;
    const { item } = await domain.add({ projectId: p.id, userId: u.id, domain: name });
    expect(item.name).toBe(name);
    await expectAppError(
      () => domain.add({ projectId: p.id, userId: u.id, domain: name }),
      "DOMAIN_INVALID",
      /sudah terhubung/,
    );

    const verified = await domain.verify({ domainId: item.id, userId: u.id });
    expect(verified.projectId).toBe(p.id);
    expect((await domain.list(p.id, u.id)).map((d) => d.id)).toContain(item.id);
    expect((await domain.checkPending()).checked).toBeGreaterThanOrEqual(0);

    const stranger = await f.user("domain-asing");
    await expectAppError(
      () => domain.verify({ domainId: item.id, userId: stranger.id }),
      "NOT_FOUND",
    );
    await expectAppError(
      () => domain.remove({ domainId: item.id, userId: stranger.id }),
      "NOT_FOUND",
    );
    await expectAppError(
      () =>
        domain.add({ projectId: p.id, userId: stranger.id, domain: `lain-${name}` }),
      "NOT_FOUND",
    );

    await domain.remove({ domainId: item.id, userId: u.id });
    expect(await db.domain.count({ where: { projectId: p.id } })).toBe(0);
  });
});
