import { afterAll, describe, expect, it } from "vitest";

import { db } from "@/lib/db";
import * as project from "@/services/project.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** docs/06 §6.7 — CRUD project dengan kepemilikan di dalam query. */

const tag = makeTag("project");
const f = fixtures(tag);

afterAll(() => f.cleanup());

const input = (name: string) =>
  ({
    websiteType: "CUSTOM",
    prompt: `Website ${name} untuk uji CRUD project`,
    name,
  }) as Parameters<typeof project.create>[0]["input"];

describe("project", () => {
  it("membuat, membaca, mengganti nama, mengarsip, dan menghapus", async () => {
    const u = await f.user("crud", { maxProjectsOverride: 5 });

    const created = await project.create({ userId: u.id, input: input("Toko Kopi") });
    const projectId =
      (created as { projectId?: string; id?: string }).projectId ??
      (created as { id: string }).id;
    expect(projectId).toBeTruthy();

    expect((await project.getForUser(projectId, u.id))?.name).toBe("Toko Kopi");
    const listed = await project.listForUser({ userId: u.id, q: "Kopi" });
    expect(listed.items.map((i: { id: string }) => i.id)).toContain(projectId);
    expect((await project.listRecent(u.id)).length).toBeGreaterThanOrEqual(1);
    expect(await project.getStats(u.id)).toBeTruthy();
    expect(await project.listMessages(projectId, u.id)).toEqual(expect.any(Array));
    expect(await project.listVersions(projectId, u.id)).toEqual(expect.any(Array));

    await project.rename({ projectId, userId: u.id, name: "Toko Kopi Baru" });
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: projectId } })).name,
    ).toBe("Toko Kopi Baru");

    await project.archive({ projectId, userId: u.id });
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: projectId } })).status,
    ).toBe("ARCHIVED");
    await project.unarchive({ projectId, userId: u.id });
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: projectId } })).status,
    ).not.toBe("ARCHIVED");

    const copy = await project.duplicate({ projectId, userId: u.id });
    expect(copy).toBeTruthy();

    await expectAppError(
      () =>
        project.softDelete({
          projectId,
          userId: u.id,
          confirmName: "nama salah",
          confirmPhrase: "delete my project",
        }),
      "VALIDATION",
    );
    await project.softDelete({
      projectId,
      userId: u.id,
      confirmName: "Toko Kopi Baru",
      confirmPhrase: "delete my project",
    });
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: projectId } })).deletedAt,
    ).not.toBeNull();
    expect(await project.getForUser(projectId, u.id)).toBeNull();
  });

  it("hapus mewajibkan nama project dan kalimat konfirmasi", async () => {
    const u = await f.user("konfirmasi", { maxProjectsOverride: 5 });
    const p = await f.project(u.id, "konfirmasi");

    await expectAppError(
      () =>
        project.softDelete({
          projectId: p.id,
          userId: u.id,
          confirmName: p.name,
          confirmPhrase: "hapus saja",
        }),
      "VALIDATION",
      /delete my project/,
    );
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: p.id } })).deletedAt,
    ).toBeNull();

    await project.softDelete({
      projectId: p.id,
      userId: u.id,
      confirmName: p.name,
      confirmPhrase: "  Delete My Project ",
    });
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: p.id } })).deletedAt,
    ).not.toBeNull();
  });

  it("pengguna lain tidak bisa menyentuh project milik orang", async () => {
    const owner = await f.user("pemilik");
    const stranger = await f.user("penyusup");
    const p = await f.project(owner.id, "rahasia");

    expect(await project.getForUser(p.id, stranger.id)).toBeNull();
    await expectAppError(
      () => project.rename({ projectId: p.id, userId: stranger.id, name: "Dibajak" }),
      "NOT_FOUND",
    );
    await expectAppError(
      () => project.archive({ projectId: p.id, userId: stranger.id }),
      "NOT_FOUND",
    );
    await expectAppError(
      () => project.unarchive({ projectId: p.id, userId: stranger.id }),
      "NOT_FOUND",
    );
    await expectAppError(
      () =>
        project.softDelete({
          projectId: p.id,
          userId: stranger.id,
          confirmName: p.name,
          confirmPhrase: "delete my project",
        }),
      "NOT_FOUND",
    );
    await expectAppError(
      () => project.duplicate({ projectId: p.id, userId: stranger.id }),
      "NOT_FOUND",
    );
  });

  it("membuat project sekaligus build awal", async () => {
    const u = await f.user("langsung");
    const result = await project.createWithInitialBuild({
      userId: u.id,
      input: input("Sekolah"),
    });
    expect(result).toBeTruthy();
    expect(await db.buildJob.count({ where: { project: { userId: u.id } } })).toBe(1);
  });
});
