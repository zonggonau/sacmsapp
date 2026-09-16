import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as quota from "@/services/quota.service";

import { fixtures, makeTag } from "../helpers";

/** docs/11 §11.6 — alasan tombol nonaktif ditampilkan SEBELUM diklik. */

const tag = makeTag("penghalang");
const f = fixtures(tag);

afterAll(() => f.cleanup());

describe("penghalang aksi untuk UI", () => {
  it("tanpa penghalang saat dompet masih berisi", async () => {
    const u = await f.user("longgar");
    await f.credits(u.id, 8);
    const b = await quota.getActionBlockers(u.id);
    expect(b).toMatchObject({
      walletCredits: 8,
      credit: null,
      project: null,
      deploy: null,
    });
  });

  it("menjelaskan kredit, project, dan penerbitan yang habis", async () => {
    const free = await f.plan("free");
    const u = await f.user("habis");
    await f.drainedWelcome(u.id);
    const p = await f.project(u.id, "habis");
    await db.usageEvent.createMany({
      data: Array.from({ length: free.maxDeploysPerDay }, () => ({
        kind: "DEPLOY" as const,
        state: "COMMITTED" as const,
        credits: 0,
        userId: u.id,
        projectId: p.id,
      })),
    });

    const b = await quota.getActionBlockers(u.id);
    expect(b?.walletCredits).toBe(0);
    expect(b?.credit).toMatch(/Kredit AI Anda habis/);
    expect(b?.project).toMatch(/maksimal 1 website/);
    expect(b?.deploy).toMatch(/Batas penerbitan harian/);
    expect(await quota.getActionBlockers("tidak-ada")).toBeNull();
  });
});
