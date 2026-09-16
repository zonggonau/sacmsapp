import { afterAll, describe, expect, it } from "vitest";

import { WELCOME_CREDITS } from "@/config/billing";
import { db } from "@/lib/db";
import * as credit from "@/services/credit.service";

import { expectAppError, fixtures, makeTag } from "../helpers";

/** ADR-012 — dompet kredit AI per akun: lot, FIFO, kedaluwarsa, refund. */

const tag = makeTag("dompet");
const f = fixtures(tag);

afterAll(async () => {
  await db.creditLot.deleteMany({ where: { note: { startsWith: tag } } });
  await f.cleanup();
});

const DAY = 24 * 60 * 60_000;

/** Lot dengan tanggal kedaluwarsa yang ditentukan uji. */
function lot(userId: string, amount: number, expiresInDays: number, label: string) {
  return credit.grant({
    userId,
    amount,
    source: "TOPUP",
    note: `${tag}-${label}`,
    expiresAt: new Date(Date.now() + expiresInDays * DAY),
  });
}

const reserve = (userId: string, credits: number, projectId?: string) =>
  db.$transaction((tx) =>
    credit.reserveFromWalletInTx(tx, {
      userId,
      kind: "AI_GENERATE",
      credits,
      projectId,
    }),
  );

describe("kredit masuk", () => {
  it("menambah lot, menghitung saldo, dan memberi tahu pengguna", async () => {
    const u = await f.user("masuk");

    const hasil = await lot(u.id, 10, 200, "utama");
    expect(hasil.lotId).toBeTruthy();

    const saldo = await credit.getBalance(u.id);
    expect(saldo.total).toBe(10);
    expect(saldo.nextExpiry).not.toBeNull();

    const notif = await db.notification.findFirst({
      where: { userId: u.id, type: "credit.added" },
      select: { title: true },
    });
    expect(notif?.title).toContain("10 kredit");
  });

  it("menolak jumlah yang tidak masuk akal", async () => {
    const u = await f.user("jumlah-salah");
    await expectAppError(
      () => credit.grant({ userId: u.id, amount: 0, source: "ADMIN" }),
      "VALIDATION",
    );
    await expectAppError(
      () => credit.grant({ userId: u.id, amount: -5, source: "ADMIN" }),
      "VALIDATION",
    );
  });

  it("kredit sambutan hanya sekali seumur akun", async () => {
    const u = await f.user("sambutan");

    expect(await credit.grantWelcome(u.id)).toBe(true);
    expect(await credit.grantWelcome(u.id)).toBe(false);
    expect((await credit.getBalance(u.id)).total).toBe(WELCOME_CREDITS);
  });
});

describe("pemakaian FIFO", () => {
  it("mengambil dari lot yang paling dulu kedaluwarsa", async () => {
    const u = await f.user("fifo");
    const lama = await lot(u.id, 3, 10, "segera-hangus");
    const baru = await lot(u.id, 5, 300, "masih-lama");

    await reserve(u.id, 2);

    const lots = await db.creditLot.findMany({
      where: { userId: u.id },
      select: { id: true, remaining: true },
    });
    const byId = new Map(lots.map((l) => [l.id, l.remaining]));
    expect(byId.get(lama.lotId)).toBe(1);
    expect(byId.get(baru.lotId)).toBe(5);
    expect((await credit.getBalance(u.id)).total).toBe(6);
  });

  it("satu reservasi boleh mengambil dari dua lot, dan refund mengembalikan tepat", async () => {
    const u = await f.user("dua-lot");
    const a = await lot(u.id, 1, 10, "kecil");
    const b = await lot(u.id, 5, 300, "besar");

    const eventId = await reserve(u.id, 3);

    let lots = await db.creditLot.findMany({ where: { userId: u.id } });
    expect(lots.find((l) => l.id === a.lotId)?.remaining).toBe(0);
    expect(lots.find((l) => l.id === b.lotId)?.remaining).toBe(3);

    await credit.refundToWallet(eventId);

    lots = await db.creditLot.findMany({ where: { userId: u.id } });
    expect(lots.find((l) => l.id === a.lotId)?.remaining).toBe(1);
    expect(lots.find((l) => l.id === b.lotId)?.remaining).toBe(5);

    // Idempoten: refund kedua tidak menambah kredit gratis.
    await credit.refundToWallet(eventId);
    lots = await db.creditLot.findMany({ where: { userId: u.id } });
    expect(lots.reduce((s, l) => s + l.remaining, 0)).toBe(6);
  });

  it("menolak saat saldo tidak cukup tanpa menyentuh lot mana pun", async () => {
    const u = await f.user("kurang");
    await lot(u.id, 2, 100, "pas-pasan");

    await expectAppError(() => reserve(u.id, 3), "QUOTA_EXCEEDED", /tidak cukup/);

    expect((await credit.getBalance(u.id)).total).toBe(2);
    expect(await db.usageEvent.count({ where: { userId: u.id } })).toBe(0);
  });

  it("lot yang sudah kedaluwarsa tidak dihitung dan tidak bisa dipakai", async () => {
    const u = await f.user("hangus");
    await lot(u.id, 5, -1, "sudah-lewat");

    expect((await credit.getBalance(u.id)).total).toBe(0);
    await expectAppError(() => reserve(u.id, 1), "QUOTA_EXCEEDED");
  });

  it("saldo menandai kredit yang akan hangus dalam 30 hari", async () => {
    const u = await f.user("segera");
    await lot(u.id, 4, 10, "akan-hangus");
    await lot(u.id, 6, 200, "aman");

    const saldo = await credit.getBalance(u.id);
    expect(saldo.total).toBe(10);
    expect(saldo.expiringSoon).toBe(4);
  });
});

describe("pengingat kedaluwarsa", () => {
  it("memberi tahu sekali per lot", async () => {
    const u = await f.user("pengingat");
    await lot(u.id, 7, 10, "hampir-hangus");

    expect(await credit.notifyExpiringLots()).toBeGreaterThanOrEqual(1);
    const kedua = await credit.notifyExpiringLots();

    const notif = await db.notification.count({
      where: { userId: u.id, type: { startsWith: "credit.expiring:" } },
    });
    expect(notif).toBe(1);
    expect(kedua).toBe(0);
  });
});

describe("riwayat lot", () => {
  it("menampilkan sumber, sisa, dan status kedaluwarsa", async () => {
    const u = await f.user("riwayat-lot");
    await lot(u.id, 10, 200, "hidup");
    await lot(u.id, 3, -2, "mati");

    const items = await credit.listLots(u.id);
    expect(items).toHaveLength(2);
    expect(items.filter((i) => i.expired)).toHaveLength(1);
    expect(items.every((i) => i.source === "TOPUP")).toBe(true);
  });
});
