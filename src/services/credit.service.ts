import { CREDIT_LOT_MONTHS, TOPUP_PAGE, WELCOME_CREDITS } from "@/config/billing";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { tanggal } from "@/lib/format";
import { logger } from "@/lib/logger";
import type { AuditTrail } from "@/services/audit.service";
import type { CreditLotSource, UsageKind } from "@/types/db";

/**
 * Dompet kredit AI per AKUN — ADR-012.
 *
 * Kredit masuk sebagai **lot**: satu baris per pembelian, dengan tanggal
 * kedaluwarsa sendiri. Pemakaian mengambil dari lot yang paling dulu
 * kedaluwarsa (FIFO), sehingga kredit yang hampir hangus terpakai lebih dulu.
 *
 * MASA PERALIHAN (docs/06 §6.6): jalur lama `quota.reserveCreditsInTx`
 * (`User.creditsUsed` + kredit bulanan paket) masih hidup. Berkas ini TIDAK
 * menyentuh `creditsUsed` sama sekali, supaya satu pemakaian tidak terhitung
 * dua kali. Pemindahan penegakan ke dompet dilakukan di tahap berikutnya.
 *
 * Lot yang kedaluwarsa TIDAK dihapus dan `remaining`-nya tidak dinolkan:
 * riwayat "berapa kredit tidak terpakai" itu justru yang dipakai memutuskan
 * ukuran paket top-up. Semua pembacaan menyaring `expiresAt > now`.
 */

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Lot yang dipakai satu reservasi, disimpan di `UsageEvent.metadata`.
 *
 * Index signature-nya ada supaya bentuk ini diterima sebagai JSON oleh Prisma
 * tanpa mengimpor tipe client hasil generate ke luar `lib/db` (docs/02 §2.2).
 */
interface LotTake {
  lotId: string;
  taken: number;
  [key: string]: string | number;
}

function lotExpiry(from: Date = new Date()): Date {
  const at = new Date(from);
  at.setMonth(at.getMonth() + CREDIT_LOT_MONTHS);
  return at;
}

function emptyWallet(needed: number, available: number) {
  return new AppError(
    "QUOTA_EXCEEDED",
    `Kredit AI Anda tidak cukup: butuh ${needed}, sisa ${available}. Isi ulang kredit untuk melanjutkan.`,
    { action: { label: "Isi Kredit", href: TOPUP_PAGE } },
  );
}

/* ============================================================
 *  BACA
 * ============================================================ */

export interface WalletBalance {
  /** Sisa kredit yang masih berlaku. */
  total: number;
  /** Sisa kredit yang kedaluwarsa dalam 30 hari. */
  expiringSoon: number;
  nextExpiry: Date | null;
}

export async function getBalance(
  userId: string,
  now: Date = new Date(),
): Promise<WalletBalance> {
  const lots = await db.creditLot.findMany({
    where: { userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: { expiresAt: "asc" },
    select: { remaining: true, expiresAt: true },
  });

  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60_000);

  return {
    total: lots.reduce((sum, l) => sum + l.remaining, 0),
    expiringSoon: lots
      .filter((l) => l.expiresAt <= soon)
      .reduce((sum, l) => sum + l.remaining, 0),
    nextExpiry: lots[0]?.expiresAt ?? null,
  };
}

export interface CreditLotItem {
  id: string;
  source: CreditLotSource;
  amount: number;
  remaining: number;
  expiresAt: Date;
  expired: boolean;
  paymentRef: string | null;
  note: string | null;
  createdAt: Date;
}

/** Riwayat lot untuk halaman Paket & panel admin. */
export async function listLots(
  userId: string,
  limit = 20,
  now: Date = new Date(),
): Promise<CreditLotItem[]> {
  const lots = await db.creditLot.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      source: true,
      amount: true,
      remaining: true,
      expiresAt: true,
      paymentRef: true,
      note: true,
      createdAt: true,
    },
  });

  return lots.map((l) => ({ ...l, expired: l.expiresAt <= now }));
}

/* ============================================================
 *  KREDIT MASUK
 * ============================================================ */

export interface GrantInput {
  userId: string;
  amount: number;
  source: CreditLotSource;
  paymentRef?: string | undefined;
  note?: string | undefined;
  /** Default: 12 bulan dari sekarang (ADR-012). */
  expiresAt?: Date | undefined;
}

/**
 * Menambah kredit ke dompet. Dipakai top-up manual oleh Super Admin dan kredit
 * sambutan. Mengembalikan AuditTrail supaya action admin bisa mencatatnya.
 */
export async function grant(
  input: GrantInput,
): Promise<AuditTrail & { lotId: string; expiresAt: Date }> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new AppError(
      "VALIDATION",
      "Jumlah kredit harus bilangan bulat lebih dari 0.",
    );
  }

  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true },
  });
  if (!user) throw new AppError("NOT_FOUND", "Pengguna tidak ditemukan.");

  const expiresAt = input.expiresAt ?? lotExpiry();
  const lot = await db.creditLot.create({
    data: {
      userId: input.userId,
      amount: input.amount,
      remaining: input.amount,
      source: input.source,
      expiresAt,
      paymentRef: input.paymentRef ?? null,
      note: input.note ?? null,
    },
    select: { id: true },
  });

  const balance = await getBalance(input.userId);

  await db.notification.create({
    data: {
      userId: input.userId,
      type: "credit.added",
      title: `${input.amount} kredit masuk`,
      body: `Sisa kredit Anda sekarang ${balance.total}. Kredit ini berlaku sampai ${tanggal(expiresAt)}.`,
      href: TOPUP_PAGE,
    },
  });

  logger.info("credit.granted", {
    userId: input.userId,
    amount: input.amount,
    source: input.source,
    lotId: lot.id,
  });

  return {
    targetType: "User",
    targetId: input.userId,
    before: { email: user.email },
    after: {
      kredit: input.amount,
      sumber: input.source,
      berlakuSampai: expiresAt,
      sisaSetelahnya: balance.total,
    },
    lotId: lot.id,
    expiresAt,
  };
}

/**
 * Kredit sambutan, SEKALI seumur akun. Dipanggil saat pendaftaran; aman
 * dipanggil dua kali karena lot WELCOME yang sudah ada membuatnya berhenti.
 */
export async function grantWelcome(userId: string): Promise<boolean> {
  const existing = await db.creditLot.findFirst({
    where: { userId, source: "WELCOME" },
    select: { id: true },
  });
  if (existing) return false;

  await grant({
    userId,
    amount: WELCOME_CREDITS,
    source: "WELCOME",
    note: "Kredit sambutan akun baru",
  });
  return true;
}

/* ============================================================
 *  PEMAKAIAN
 * ============================================================ */

export interface WalletReserveInput {
  userId: string;
  kind: UsageKind;
  credits: number;
  projectId?: string | undefined;
  buildJobId?: string | undefined;
  model?: string | undefined;
}

/**
 * Menahan kredit dari dompet dan mencatat `UsageEvent(RESERVED)`.
 *
 * Wajib berjalan di dalam transaksi pemanggil, dan baris USER dikunci lebih
 * dulu — urutan kunci yang sama dengan quota.service, itulah yang mencegah
 * deadlock dan membuat dua permintaan bersamaan pada kredit terakhir hanya
 * meloloskan satu (docs/12 ancaman A12).
 *
 * Lot yang terpakai dicatat di `metadata.lots` supaya refund bisa
 * mengembalikannya ke lot yang sama persis, termasuk bila satu reservasi
 * mengambil dari dua lot berbeda.
 */
export async function reserveFromWalletInTx(
  tx: Tx,
  input: WalletReserveInput,
  now: Date = new Date(),
): Promise<string> {
  await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${input.userId} FOR UPDATE`;

  const lots = await tx.creditLot.findMany({
    where: { userId: input.userId, remaining: { gt: 0 }, expiresAt: { gt: now } },
    orderBy: [{ expiresAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, remaining: true },
  });

  const available = lots.reduce((sum, l) => sum + l.remaining, 0);
  if (available < input.credits) throw emptyWallet(input.credits, available);

  const takes: LotTake[] = [];
  let left = input.credits;
  for (const lot of lots) {
    if (left === 0) break;
    const taken = Math.min(left, lot.remaining);
    await tx.creditLot.update({
      where: { id: lot.id },
      data: { remaining: { decrement: taken } },
    });
    takes.push({ lotId: lot.id, taken });
    left -= taken;
  }

  const event = await tx.usageEvent.create({
    data: {
      kind: input.kind,
      state: "RESERVED",
      credits: input.credits,
      userId: input.userId,
      projectId: input.projectId ?? null,
      buildJobId: input.buildJobId ?? null,
      model: input.model ?? null,
      creditLotId: takes[0]?.lotId ?? null,
      metadata: { lots: takes },
    },
    select: { id: true },
  });

  logger.info("credit.reserved", {
    usageEventId: event.id,
    credits: input.credits,
    sisaSetelahnya: available - input.credits,
  });

  return event.id;
}

/** Membaca kembali lot yang dipakai satu UsageEvent. */
function lotsFromMetadata(metadata: unknown, fallbackLotId: string | null): LotTake[] {
  if (typeof metadata === "object" && metadata !== null && "lots" in metadata) {
    const raw = (metadata as { lots?: unknown }).lots;
    if (Array.isArray(raw)) {
      const parsed = raw.flatMap((entry) => {
        if (typeof entry !== "object" || entry === null) return [];
        const e = entry as { lotId?: unknown; taken?: unknown };
        return typeof e.lotId === "string" && typeof e.taken === "number"
          ? [{ lotId: e.lotId, taken: e.taken }]
          : [];
      });
      if (parsed.length > 0) return parsed;
    }
  }

  return fallbackLotId ? [{ lotId: fallbackLotId, taken: 0 }] : [];
}

/**
 * Kerja gagal: kredit kembali ke lot asalnya.
 *
 * IDEMPOTEN lewat klausa `state: "RESERVED"`, sama seperti refund lama —
 * refund dipicu dari beberapa jalur (gagal, dibatalkan, cron penyapu) yang bisa
 * bertabrakan. `remaining` tidak pernah melewati `amount`.
 */
export async function refundToWallet(usageEventId: string): Promise<void> {
  await db.$transaction(async (tx) => {
    const event = await tx.usageEvent.findUnique({
      where: { id: usageEventId },
      select: {
        id: true,
        state: true,
        credits: true,
        creditLotId: true,
        metadata: true,
      },
    });

    if (!event || event.state !== "RESERVED") {
      logger.warn("credit.refund_noop", { usageEventId, state: event?.state });
      return;
    }

    await tx.usageEvent.update({
      where: { id: event.id },
      data: { state: "REFUNDED" },
    });

    const takes = lotsFromMetadata(event.metadata, event.creditLotId);
    for (const take of takes) {
      const lot = await tx.creditLot.findUnique({
        where: { id: take.lotId },
        select: { amount: true, remaining: true },
      });
      if (!lot) continue;

      const back = take.taken > 0 ? take.taken : event.credits;
      await tx.creditLot.update({
        where: { id: take.lotId },
        data: { remaining: Math.min(lot.amount, lot.remaining + back) },
      });
    }

    logger.info("credit.refunded", { usageEventId, credits: event.credits });
  });
}

/* ============================================================
 *  CRON
 * ============================================================ */

/**
 * Memberi tahu kredit yang akan kedaluwarsa dalam 30 hari — sekali per lot.
 * Tanpa ini pengguna baru sadar kreditnya hangus setelah hilang.
 */
export async function notifyExpiringLots(
  now: Date = new Date(),
  withinDays = 30,
): Promise<number> {
  const until = new Date(now.getTime() + withinDays * 24 * 60 * 60_000);

  const lots = await db.creditLot.findMany({
    where: { remaining: { gt: 0 }, expiresAt: { gt: now, lte: until } },
    select: { id: true, userId: true, remaining: true, expiresAt: true },
  });

  let sent = 0;
  for (const lot of lots) {
    const already = await db.notification.findFirst({
      where: { userId: lot.userId, type: `credit.expiring:${lot.id}` },
      select: { id: true },
    });
    if (already) continue;

    await db.notification.create({
      data: {
        userId: lot.userId,
        type: `credit.expiring:${lot.id}`,
        title: `${lot.remaining} kredit akan hangus`,
        body: `Kredit ini berlaku sampai ${tanggal(lot.expiresAt)}. Pakai sebelum tanggal itu.`,
        href: TOPUP_PAGE,
      },
    });
    sent += 1;
  }

  if (sent > 0) logger.info("credit.expiry_notified", { count: sent });
  return sent;
}
