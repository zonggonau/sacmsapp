import { afterAll, describe, expect, it } from "vitest";

import { V0_APP_MODEL } from "@/config/ai-models";
import { db } from "@/lib/db";
import * as build from "@/services/build.service";

import { fixtures, makeTag } from "../helpers";

/** ADR-011 — permintaan ke v0 sama dengan v0.app: prompt apa adanya, v0-auto, tanpa system. */

const tag = makeTag("v0murni");
const f = fixtures(tag);

afterAll(() => f.cleanup());

describe("mengikuti perilaku bawaan v0", () => {
  it("build awal dan edit mengirim prompt pengguna apa adanya tanpa system prompt", async () => {
    const u = await f.user("murni", { planSlug: "free" });
    const p = await f.project(u.id, "murni");
    const promptAwal = "Buat website sekolah SMA di Jayapura dengan berita dan galeri";

    const awal = await build.createJob({
      projectId: p.id,
      userId: u.id,
      kind: "INITIAL_GENERATE",
      prompt: promptAwal,
    });
    await build.run(awal.jobId);

    const jobAwal = await db.buildJob.findUniqueOrThrow({ where: { id: awal.jobId } });
    expect(jobAwal.status).toBe("SUCCEEDED");
    expect(jobAwal.sentMessage).toBe(promptAwal);
    expect(jobAwal.systemPrompt).toBeNull();
    // Paket Free sekalipun memakai model yang sama dengan v0.app.
    expect(jobAwal.model).toBe(V0_APP_MODEL);

    const promptEdit = "Tambahkan halaman PPDB dengan formulir pendaftaran";
    await db.user.update({ where: { id: u.id }, data: { creditsUsed: 0 } });
    const edit = await build.createJob({
      projectId: p.id,
      userId: u.id,
      kind: "EDIT_GENERATE",
      prompt: promptEdit,
    });
    await build.run(edit.jobId);

    const jobEdit = await db.buildJob.findUniqueOrThrow({ where: { id: edit.jobId } });
    expect(jobEdit.sentMessage).toBe(promptEdit);
    expect(jobEdit.systemPrompt).toBeNull();
    expect(jobEdit.model).toBe(V0_APP_MODEL);
  });
});
