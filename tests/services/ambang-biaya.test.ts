import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as system from "@/services/system.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** docs/10 §10.3 & §10.7 — ambang biaya harian bisa diubah dari panel. */

const tag = makeTag("ambang");
const f = fixtures(tag);
let before: unknown;

beforeAll(async () => {
  before = (
    await db.systemSetting.findUnique({ where: { key: "ai.dailyCostThresholdIdr" } })
  )?.value;
});

afterAll(async () => {
  if (before === undefined) {
    await db.systemSetting.deleteMany({ where: { key: "ai.dailyCostThresholdIdr" } });
  } else {
    await db.systemSetting.update({
      where: { key: "ai.dailyCostThresholdIdr" },
      data: { value: before as number },
    });
  }
  await f.cleanup();
});

describe("ambang biaya harian", () => {
  it("disimpan, dibaca, dicatat sebelum/sesudah, dan menolak nilai tidak sah", async () => {
    const admin = await f.user("sa", { role: "SUPER_ADMIN" });

    const trail = await system.setDailyCostThreshold({
      valueIdr: 250_000,
      actorId: admin.id,
    });
    expect(await system.getDailyCostThreshold()).toBe(250_000);
    expect(trail.after).toEqual({ valueIdr: 250_000 });

    await system.setDailyCostThreshold({ valueIdr: 0, actorId: admin.id });
    expect(await system.getDailyCostThreshold()).toBe(0);

    await expectAppError(
      () => system.setDailyCostThreshold({ valueIdr: -1, actorId: admin.id }),
      "VALIDATION",
    );
    await expectAppError(
      () => system.setDailyCostThreshold({ valueIdr: 12.5, actorId: admin.id }),
      "VALIDATION",
    );
  });

  it("uji Sentry melaporkan jujur bila DSN belum diisi", async () => {
    const admin = await f.user("sentry", { role: "SUPER_ADMIN" });
    const result = await system.sendMonitoringTest({ actorId: admin.id });
    expect(result.sent).toBe(Boolean(process.env.SENTRY_DSN));
  });
});
