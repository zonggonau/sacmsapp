import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as adminProject from "@/services/admin-project.service";
import * as adminUser from "@/services/admin-user.service";
import * as deploy from "@/services/deploy.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** docs/12 §12.7 — kendali runbook insiden yang dijalankan dari /admin. */

const tag = makeTag("runbook");
const f = fixtures(tag);

afterAll(() => f.cleanup());

async function publish(projectId: string, userId: string) {
  const { deploymentId } = await deploy.request({ projectId, userId });
  await deploy.start(deploymentId);
  for (let i = 0; i < 40; i += 1) {
    const status = await deploy.getStatus({ deploymentId, userId });
    if (status?.status === "READY") return deploymentId;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error("Deployment tidak selesai tepat waktu");
}

describe("akun disusupi", () => {
  it("mencabut semua sesi tanpa menangguhkan akun", async () => {
    const u = await f.user("susup", { role: "SUPER_ADMIN" });
    for (const n of [1, 2]) {
      await db.session.create({
        data: {
          userId: u.id,
          token: `${tag}-sesi-${n}`,
          expiresAt: new Date(Date.now() + 60 * 60_000),
        },
      });
    }

    const trail = await adminUser.revokeSessions({ userId: u.id });

    expect(trail.before).toEqual({ activeSessions: 2 });
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).status).toBe(
      "ACTIVE",
    );
    await expectAppError(
      () => adminUser.revokeSessions({ userId: "tidak-ada" }),
      "NOT_FOUND",
    );
  });
});

describe("situs rusak setelah terbit", () => {
  it("admin mengembalikan situs ke versi yang pernah berhasil", async () => {
    const owner = await f.user("pemilik", { planSlug: "business" });
    const p = await f.deployableProject(owner.id, "situs");
    // ADR-012: menerbitkan menuntut Paket Project aktif.
    await f.subscribe(p.id, "business");
    const firstVersionId = p.currentVersionId!;
    const good = await publish(p.id, owner.id);

    const v2 = await db.projectVersion.create({
      data: { projectId: p.id, number: 2, v0VersionId: `ver_mock_${tag}_v2` },
    });
    await db.project.update({ where: { id: p.id }, data: { currentVersionId: v2.id } });
    const broken = await publish(p.id, owner.id);

    await expectAppError(
      () => adminProject.rollbackAsAdmin({ projectId: p.id, deploymentId: broken }),
      "CONFLICT",
      /sedang tayang/,
    );

    const result = await adminProject.rollbackAsAdmin({
      projectId: p.id,
      deploymentId: good,
    });
    expect(result).toMatchObject({ targetType: "Project", targetId: p.id });

    const created = await db.deployment.findUniqueOrThrow({
      where: { id: result.deploymentId },
    });
    expect(created.versionId).toBe(firstVersionId);
    expect(created.triggeredById).toBe(owner.id);

    await db.project.update({ where: { id: p.id }, data: { deletedAt: new Date() } });
    await expectAppError(
      () => adminProject.rollbackAsAdmin({ projectId: p.id, deploymentId: good }),
      "NOT_FOUND",
    );
  });
});
