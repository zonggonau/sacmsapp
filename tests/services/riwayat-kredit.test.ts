import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as usage from "@/services/usage.service";

import { fixtures, makeTag } from "../helpers";

/** docs/11 §11.6 — riwayat pemakaian kredit yang dilihat pengguna. */

const tag = makeTag("riwayat");
const f = fixtures(tag);

afterAll(() => f.cleanup());

describe("riwayat pemakaian kredit", () => {
  it("urut terbaru, memuat nama project, dan menampilkan yang dikembalikan", async () => {
    const u = await f.user("punya", { planSlug: "pro" });
    const p = await f.project(u.id, "riwayat");

    await usage.record({ userId: u.id, kind: "DEPLOY", credits: 0, projectId: p.id });
    const reserved = await usage.reserve({
      userId: u.id,
      kind: "AI_GENERATE",
      credits: 1,
      projectId: p.id,
    });
    await usage.commit(reserved);
    const gagal = await usage.reserve({
      userId: u.id,
      kind: "AI_EDIT",
      credits: 1,
      projectId: p.id,
    });
    await usage.refund(gagal);

    const history = await usage.listHistory(u.id);
    expect(history).toHaveLength(3);

    // Terbaru lebih dulu.
    const waktu = history.map((h) => h.createdAt.getTime());
    expect([...waktu].sort((a, b) => b - a)).toEqual(waktu);

    const edit = history.find((h) => h.kind === "AI_EDIT");
    expect(edit?.state).toBe("REFUNDED");
    expect(edit?.projectName).toBe(p.name);

    const generate = history.find((h) => h.kind === "AI_GENERATE");
    expect(generate?.state).toBe("COMMITTED");
    expect(generate?.credits).toBe(1);

    const deploy = history.find((h) => h.kind === "DEPLOY");
    expect(deploy?.credits).toBe(0);
  });

  it("hanya milik pengguna itu, dan dibatasi jumlahnya", async () => {
    const mine = await f.user("saya", { planSlug: "pro" });
    const other = await f.user("orang-lain", { planSlug: "pro" });
    const p = await f.project(other.id, "milik-orang");

    await usage.record({
      userId: other.id,
      kind: "DEPLOY",
      credits: 0,
      projectId: p.id,
    });
    for (let i = 0; i < 3; i += 1) {
      await usage.record({ userId: mine.id, kind: "DEPLOY", credits: 0 });
    }

    expect(await usage.listHistory(other.id)).toHaveLength(1);
    expect(await usage.listHistory(mine.id)).toHaveLength(3);
    expect(await usage.listHistory(mine.id, 2)).toHaveLength(2);
  });

  it("project yang sudah dihapus tetap tercatat tanpa nama", async () => {
    const u = await f.user("hapus-project", { planSlug: "pro" });
    const p = await f.project(u.id, "akan-dihapus");

    await usage.record({ userId: u.id, kind: "DEPLOY", credits: 0, projectId: p.id });
    await db.project.delete({ where: { id: p.id } });

    const history = await usage.listHistory(u.id);
    expect(history).toHaveLength(1);
    expect(history[0]!.projectId).toBe(p.id);
    expect(history[0]!.projectName).toBeNull();
  });
});
