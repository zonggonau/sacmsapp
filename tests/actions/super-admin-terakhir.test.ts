import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * docs/07 §7.8 — "Super Admin terakhir mencoba menurunkan dirinya → ditolak".
 *
 * Database ditiru di berkas ini: database pengembang dan CI selalu punya Super
 * Admin lain dari seed, sehingga keadaan "tinggal satu" tidak bisa dibuat tanpa
 * menangguhkan admin sungguhan.
 */

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(async () => []),
  user: { count: vi.fn(async () => 0), update: vi.fn(async () => ({})) },
  session: { deleteMany: vi.fn(async () => ({ count: 1 })) },
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(async () => ({
        id: "sa-satu",
        name: "Super Admin Tunggal",
        email: "tunggal@contoh.test",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        planId: "paket",
        creditsUsed: 0,
        creditsOverride: null,
        maxProjectsOverride: null,
        periodStartedAt: new Date(),
        plan: { slug: "business" },
      })),
    },
    $transaction: vi.fn(async (run: (client: typeof tx) => Promise<unknown>) =>
      run(tx),
    ),
  },
}));

import { changeRole } from "@/services/admin-user.service";

import { expectAppError } from "../helpers";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Super Admin terakhir", () => {
  it("tidak bisa menurunkan perannya sendiri", async () => {
    tx.user.count.mockResolvedValueOnce(0);

    await expectAppError(
      () => changeRole({ actorId: "sa-satu", userId: "sa-satu", role: "USER" }),
      "CONFLICT",
      /Super Admin terakhir/,
    );

    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.user.update).not.toHaveBeenCalled();
    expect(tx.session.deleteMany).not.toHaveBeenCalled();
  });

  it("boleh turun bila masih ada Super Admin aktif lain", async () => {
    tx.user.count.mockResolvedValueOnce(1);

    await changeRole({ actorId: "sa-satu", userId: "sa-satu", role: "USER" });

    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "sa-satu" },
      data: { role: "USER" },
    });
    expect(tx.session.deleteMany).toHaveBeenCalledWith({
      where: { userId: "sa-satu" },
    });
  });
});
