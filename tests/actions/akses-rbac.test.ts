import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * docs/07 §7.8 — uji keamanan akses di lapisan Server Action.
 *
 * Action dipanggil LANGSUNG sebagai fungsi, persis seperti penyerang yang
 * mengirim permintaan action lewat DevTools tanpa melewati UI. Yang ditiru
 * hanya batas framework (header, sesi, revalidasi); middleware
 * lib/safe-action.ts, service, dan database berjalan sungguhan.
 */

const state = vi.hoisted(() => ({ session: null as unknown }));

vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({ "x-forwarded-for": "10.9.9.9", "user-agent": "uji-akses" }),
  cookies: async () => ({ get: () => undefined, getAll: () => [], set: () => {} }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth", () => ({ auth: { api: {} } }));
vi.mock("@/lib/ratelimit", () => ({
  checkRateLimit: async () => ({ success: true }),
}));
vi.mock("@/lib/auth-guard", () => ({ getSession: async () => state.session }));

import { adminSuspendUser, adminUpdateUserRole } from "@/actions/admin.actions";
import { deleteProject, renameProject } from "@/actions/project.actions";
import { DELETE_CONFIRM_PHRASE } from "@/config/project";
import { db } from "@/lib/db";
import { ERROR_MESSAGES } from "@/lib/errors";

import { fixtures, makeTag } from "../helpers";

const tag = makeTag("akses");
const f = fixtures(tag);

afterAll(() => f.cleanup());

type SessionUser = { id: string; role: string; status: string; email: string };

function signInAs(user: SessionUser, impersonatedBy: string | null = null) {
  state.session = {
    user,
    session: { id: `sesi-${user.id}`, userId: user.id, impersonatedBy },
  };
}

async function projectDeleted(projectId: string) {
  const row = await db.project.findUniqueOrThrow({ where: { id: projectId } });
  return row.deletedAt !== null;
}

describe("action admin dipanggil pengguna biasa", () => {
  it("ditolak, tidak mengubah apa pun, dan tercatat sebagai percobaan", async () => {
    const user = await f.user("biasa");
    const target = await f.user("sasaran");
    signInAs(user);

    const suspend = await adminSuspendUser({
      userId: target.id,
      reason: "Percobaan lewat DevTools tanpa hak.",
    });
    expect(suspend.serverError).toBe(ERROR_MESSAGES.FORBIDDEN);
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe(
      "ACTIVE",
    );

    const promote = await adminUpdateUserRole({ userId: user.id, role: "SUPER_ADMIN" });
    expect(promote.serverError).toBe(ERROR_MESSAGES.FORBIDDEN);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe(
      "USER",
    );

    const denied = await db.auditLog.count({
      where: { action: "admin.access_denied", actorId: user.id },
    });
    expect(denied).toBe(2);
  });
});

describe("kepemilikan project di lapisan action", () => {
  it("pengguna A tidak bisa menghapus project milik pengguna B", async () => {
    const owner = await f.user("pemilik");
    const stranger = await f.user("penyusup");
    const project = await f.project(owner.id, "milik-b");
    signInAs(stranger);

    const result = await deleteProject({
      projectId: project.id,
      confirmName: project.name,
      confirmPhrase: DELETE_CONFIRM_PHRASE,
    });

    expect(result.serverError).toBeTruthy();
    expect(await projectDeleted(project.id)).toBe(false);
  });
});

describe("sesi lama pengguna yang ditangguhkan", () => {
  it("ditolak di middleware walau sesinya masih ada", async () => {
    const user = await f.user("tangguh");
    const project = await f.project(user.id, "tangguh");
    await db.user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    signInAs({ ...user, status: "SUSPENDED" });

    const result = await deleteProject({
      projectId: project.id,
      confirmName: project.name,
      confirmPhrase: DELETE_CONFIRM_PHRASE,
    });

    expect(result.serverError).toBe(ERROR_MESSAGES.SUSPENDED);
    expect(await projectDeleted(project.id)).toBe(false);
  });
});

describe("impersonasi Super Admin", () => {
  it("aksi destruktif diblokir, aksi biasa tetap berjalan", async () => {
    const admin = await f.user("penyamar", { role: "SUPER_ADMIN" });
    const owner = await f.user("disamarkan");
    const project = await f.project(owner.id, "disamarkan");
    signInAs(owner, admin.id);

    const hapus = await deleteProject({
      projectId: project.id,
      confirmName: project.name,
      confirmPhrase: DELETE_CONFIRM_PHRASE,
    });
    expect(hapus.serverError).toBe(
      "Tindakan ini tidak tersedia saat menyamar sebagai pengguna.",
    );
    expect(await projectDeleted(project.id)).toBe(false);

    const ganti = await renameProject({
      projectId: project.id,
      name: "Diperbaiki Admin",
    });
    expect(ganti.serverError).toBeUndefined();
    expect(
      (await db.project.findUniqueOrThrow({ where: { id: project.id } })).name,
    ).toBe("Diperbaiki Admin");
  });
});
