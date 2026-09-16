import { afterAll, describe, expect, it } from "vitest";

import { ACCOUNT_DELETE_PHRASE } from "@/config/account";
import { db } from "@/lib/db";
import * as account from "@/services/account.service";
import * as usage from "@/services/usage.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** docs/12 §12.6 — hapus akun sendiri dari /akun/keamanan (UU PDP). */

const tag = makeTag("hapusakun");
const f = fixtures(tag);

afterAll(() => f.cleanup());

const konfirmasi = (email: string) => ({
  confirmEmail: email,
  confirmPhrase: ACCOUNT_DELETE_PHRASE,
});

describe("konfirmasi", () => {
  it("menolak email atau kalimat yang tidak cocok tanpa menghapus apa pun", async () => {
    const u = await f.user("salah-konfirmasi");

    await expectAppError(
      () =>
        account.deleteOwnAccount({
          userId: u.id,
          confirmEmail: "bukan@contoh.test",
          confirmPhrase: ACCOUNT_DELETE_PHRASE,
        }),
      "VALIDATION",
    );
    await expectAppError(
      () =>
        account.deleteOwnAccount({
          userId: u.id,
          confirmEmail: u.email,
          confirmPhrase: "hapus saja",
        }),
      "VALIDATION",
    );

    expect(await db.user.findUnique({ where: { id: u.id } })).not.toBeNull();
  });

  it("menerima email dengan huruf besar dan spasi berlebih", async () => {
    const u = await f.user("normalisasi");

    await account.deleteOwnAccount({
      userId: u.id,
      confirmEmail: `  ${u.email.toUpperCase()}  `,
      confirmPhrase: `  ${ACCOUNT_DELETE_PHRASE.toUpperCase()}  `,
    });

    expect(await db.user.findUnique({ where: { id: u.id } })).toBeNull();
  });
});

describe("akun admin", () => {
  it("tidak bisa dihapus dari jalur mandiri", async () => {
    const admin = await f.user("admin-mandiri", { role: "SUPER_ADMIN" });

    await expectAppError(
      () => account.deleteOwnAccount({ userId: admin.id, ...konfirmasi(admin.email) }),
      "FORBIDDEN",
    );

    expect(await db.user.findUnique({ where: { id: admin.id } })).not.toBeNull();
  });
});

describe("penghapusan berhasil", () => {
  it("menghapus project & sesi, menyisakan audit dan catatan pemakaian tanpa identitas", async () => {
    const u = await f.user("jadi-hapus", { planSlug: "pro" });
    const p = await f.deployableProject(u.id, "ikut-hilang");
    await usage.record({ userId: u.id, kind: "DEPLOY", credits: 0, projectId: p.id });
    await db.session.create({
      data: {
        userId: u.id,
        token: `${tag}-sesi`,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    const hasil = await account.deleteOwnAccount({
      userId: u.id,
      ...konfirmasi(u.email),
      ipAddress: "10.1.1.1",
      userAgent: "uji",
    });
    expect(hasil.projects).toBe(1);

    expect(await db.user.findUnique({ where: { id: u.id } })).toBeNull();
    expect(await db.project.findUnique({ where: { id: p.id } })).toBeNull();
    expect(await db.session.count({ where: { userId: u.id } })).toBe(0);

    // Jejak audit tetap ada, pelakunya dianonimkan (AuditLog.actorId SetNull).
    const audit = await db.auditLog.findFirst({
      where: { action: "user.account.delete", targetId: u.id },
      select: { actorId: true, before: true },
    });
    expect(audit).not.toBeNull();
    expect(audit?.actorId).toBeNull();

    // Catatan pembukuan bertahan 24 bulan, juga tanpa identitas.
    const events = await db.usageEvent.findMany({
      where: { projectId: p.id },
      select: { userId: true },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.userId).toBeNull();
  });

  it("akun yang sudah tidak ada ditolak dengan pesan jelas", async () => {
    await expectAppError(
      () =>
        account.deleteOwnAccount({
          userId: "tidak-ada",
          ...konfirmasi("apa@contoh.test"),
        }),
      "NOT_FOUND",
    );
  });
});
