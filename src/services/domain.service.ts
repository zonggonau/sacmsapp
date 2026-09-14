import { db } from "@/lib/db";
import { parseDnsRecords, recordsFor, type DnsRecord } from "@/lib/dns-records";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { vercelClient, VercelApiError } from "@/lib/vercel/client";
import * as quotaService from "@/services/quota.service";
import type { DomainStatus } from "@/types/db";

/**
 * Custom domain — docs/09-AI-BUILDER-PIPELINE.md §9.10, docs/12 ancaman A8.
 *
 * Domain dipasang pada project Vercel yang dibuat v0 untuk website ini (ADR-008).
 *
 * Status:
 *   PENDING_DNS  rekaman DNS atau TXT verifikasi belum terdeteksi
 *   VERIFYING    DNS benar, sertifikat HTTPS belum terbit
 *   ACTIVE       domain menjawab lewat HTTPS
 *   FAILED       domain tidak lagi terpasang di Vercel
 */

const AUTO_CHECK_WINDOW_MS = 24 * 60 * 60_000;
const AUTO_CHECK_EVERY_MS = 9 * 60_000;

export interface DomainItem {
  id: string;
  name: string;
  status: DomainStatus;
  records: DnsRecord[];
  errorMessage: string | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
}

const ITEM_SELECT = {
  id: true,
  name: true,
  status: true,
  dnsRecords: true,
  errorMessage: true,
  lastCheckedAt: true,
  createdAt: true,
} as const;

function toItem(row: {
  id: string;
  name: string;
  status: DomainStatus;
  dnsRecords: unknown;
  errorMessage: string | null;
  lastCheckedAt: Date | null;
  createdAt: Date;
}): DomainItem {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    records: parseDnsRecords(row.dnsRecords),
    errorMessage: row.errorMessage,
    lastCheckedAt: row.lastCheckedAt,
    createdAt: row.createdAt,
  };
}

/** Kolom JSON Prisma butuh objek literal biasa, bukan interface. */
function toJson(records: DnsRecord[]) {
  return records.map((r) => ({
    type: r.type,
    name: r.name,
    value: r.value,
    purpose: r.purpose,
  }));
}

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === "P2002"
  );
}

const DUPLICATE = "Domain ini sudah dipakai project lain di SaCMS.";

/* ============================================================
 *  TULIS
 * ============================================================ */

export async function add(input: {
  projectId: string;
  userId: string;
  domain: string;
}): Promise<{ projectId: string; item: DomainItem }> {
  const project = await db.project.findFirst({
    where: { id: input.projectId, userId: input.userId, deletedAt: null },
    select: { id: true, productionUrl: true, vercelProjectId: true },
  });

  if (!project) throw new AppError("NOT_FOUND", "Project tidak ditemukan.");

  if (!project.productionUrl || !project.vercelProjectId) {
    throw new AppError(
      "CONFLICT",
      "Terbitkan website Anda terlebih dahulu. Custom domain baru bisa dihubungkan setelah website tayang.",
    );
  }

  const existing = await db.domain.findUnique({
    where: { name: input.domain },
    select: { projectId: true },
  });
  if (existing) {
    throw new AppError(
      "DOMAIN_INVALID",
      existing.projectId === project.id
        ? "Domain ini sudah terhubung ke project ini."
        : DUPLICATE,
    );
  }

  // Batas custom domain paket — diperiksa SEBELUM memasang di Vercel, supaya
  // domain yang ditolak tidak sempat terpasang di vendor (docs/11 §11.3).
  await db.$transaction((tx) => quotaService.assertCanAddDomain(tx, input.userId));

  let remote;
  try {
    remote = await vercelClient.addDomain(project.vercelProjectId, input.domain);
  } catch (error) {
    throw translateVendorError(error, "add");
  }

  let row;
  try {
    row = await db.domain.create({
      data: {
        projectId: project.id,
        name: input.domain,
        status: "PENDING_DNS",
        dnsRecords: toJson(
          recordsFor(input.domain, {
            apexHint: remote.apexName,
            challenges: remote.verification,
          }),
        ),
      },
      select: { id: true },
    });
  } catch (error) {
    // Jangan tinggalkan domain terpasang di Vercel tanpa catatan di SaCMS:
    // domain itu akan terus melayani website dan tidak bisa ditambahkan lagi.
    await vercelClient
      .removeDomain(project.vercelProjectId, input.domain)
      .catch(() => undefined);
    if (isUniqueViolation(error)) throw new AppError("DOMAIN_INVALID", DUPLICATE);
    throw error;
  }

  logger.info("domain.added", { domainId: row.id, projectId: project.id });

  try {
    return { projectId: project.id, item: await check(row.id) };
  } catch (error) {
    // Rekaman sudah tersimpan; pemeriksaan bisa diulang pengguna atau cron.
    logger.warn("domain.initial_check_failed", {
      domainId: row.id,
      reason: describe(error),
    });
    const saved = await db.domain.findUniqueOrThrow({
      where: { id: row.id },
      select: ITEM_SELECT,
    });
    return { projectId: project.id, item: toItem(saved) };
  }
}

export async function verify(input: {
  domainId: string;
  userId: string;
}): Promise<{ projectId: string; item: DomainItem }> {
  const owned = await db.domain.findFirst({
    where: { id: input.domainId, project: { userId: input.userId, deletedAt: null } },
    select: { id: true, projectId: true },
  });
  if (!owned) throw new AppError("NOT_FOUND", "Domain tidak ditemukan.");

  try {
    return { projectId: owned.projectId, item: await check(owned.id) };
  } catch (error) {
    throw translateVendorError(error, "verify");
  }
}

export async function remove(input: {
  domainId: string;
  userId: string;
}): Promise<{ projectId: string }> {
  const owned = await db.domain.findFirst({
    where: { id: input.domainId, project: { userId: input.userId, deletedAt: null } },
    select: {
      id: true,
      name: true,
      projectId: true,
      project: { select: { vercelProjectId: true } },
    },
  });
  if (!owned) throw new AppError("NOT_FOUND", "Domain tidak ditemukan.");

  if (owned.project.vercelProjectId) {
    try {
      await vercelClient.removeDomain(owned.project.vercelProjectId, owned.name);
    } catch (error) {
      // Menghapus catatan padahal domain masih terpasang di Vercel membuat domain
      // itu tetap melayani website tanpa bisa dikelola dari SaCMS. Gagalkan saja.
      throw translateVendorError(error, "remove");
    }
  }

  await db.domain.delete({ where: { id: owned.id } });
  logger.info("domain.removed", { domainId: owned.id, projectId: owned.projectId });

  return { projectId: owned.projectId };
}

/* ============================================================
 *  PEMERIKSAAN
 * ============================================================ */

async function check(domainId: string): Promise<DomainItem> {
  const row = await db.domain.findUniqueOrThrow({
    where: { id: domainId },
    select: { id: true, name: true, project: { select: { vercelProjectId: true } } },
  });

  const vercelProjectId = row.project.vercelProjectId;
  let status: DomainStatus;
  let message: string | null;
  let records: DnsRecord[] | null = null;

  const remote = vercelProjectId
    ? await vercelClient.getDomain(vercelProjectId, row.name)
    : null;

  if (!vercelProjectId || !remote) {
    status = "FAILED";
    message =
      "Domain tidak lagi terpasang pada website ini. Hapus domain, lalu tambahkan kembali.";
  } else {
    const verified = remote.verified
      ? remote
      : await vercelClient.verifyDomain(vercelProjectId, row.name);
    const config = await vercelClient.getDomainConfig(row.name);

    records = recordsFor(row.name, {
      apexHint: verified.apexName,
      challenges: verified.verification,
      ipv4: config.recommendedIPv4,
      cname: config.recommendedCNAME,
    });

    if (!verified.verified) {
      status = "PENDING_DNS";
      message =
        "Rekaman TXT untuk verifikasi kepemilikan belum terdeteksi. Perubahan DNS bisa memakan waktu hingga 24 jam.";
    } else if (config.misconfigured) {
      status = "PENDING_DNS";
      message =
        "Rekaman DNS belum mengarah ke website Anda. Perubahan DNS bisa memakan waktu hingga 24 jam.";
    } else if (!(await vercelClient.checkHttps(row.name))) {
      status = "VERIFYING";
      message =
        "DNS sudah benar. Sertifikat HTTPS sedang diterbitkan — biasanya beberapa menit.";
    } else {
      status = "ACTIVE";
      message = null;
    }
  }

  const updated = await db.domain.update({
    where: { id: row.id },
    data: {
      status,
      errorMessage: message,
      lastCheckedAt: new Date(),
      ...(records ? { dnsRecords: toJson(records) } : {}),
    },
    select: ITEM_SELECT,
  });

  logger.info("domain.checked", { domainId: row.id, status });
  return toItem(updated);
}

function translateVendorError(
  error: unknown,
  operation: "add" | "verify" | "remove",
): unknown {
  if (!(error instanceof VercelApiError)) return error;

  logger.error("domain.vendor_error", {
    operation,
    status: error.status,
    code: error.code,
    reason: error.message,
  });

  if (operation === "add" && error.status === 409) {
    return new AppError(
      "DOMAIN_INVALID",
      "Domain ini sedang terpasang di akun Vercel lain. Lepaskan domain dari sana terlebih dahulu, lalu coba lagi.",
    );
  }
  if (operation === "add" && error.status === 400) {
    return new AppError(
      "DOMAIN_INVALID",
      "Domain ditolak oleh layanan hosting. Periksa kembali ejaan domain Anda.",
    );
  }

  const verb =
    operation === "add"
      ? "menghubungkan"
      : operation === "verify"
        ? "memeriksa"
        : "melepas";
  return new AppError("INTERNAL", `Gagal ${verb} domain. Coba lagi beberapa saat.`);
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/* ============================================================
 *  BACA & CRON
 * ============================================================ */

export async function list(projectId: string, userId: string): Promise<DomainItem[]> {
  const rows = await db.domain.findMany({
    where: { projectId, project: { userId, deletedAt: null } },
    orderBy: { createdAt: "asc" },
    select: ITEM_SELECT,
  });
  return rows.map(toItem);
}

/**
 * Dipanggil cron /api/cron/verify-domains tiap 10 menit. Hanya domain yang
 * ditambahkan dalam 24 jam terakhir; setelahnya pengguna memeriksa manual.
 */
export async function checkPending(): Promise<{ checked: number; active: number }> {
  const now = Date.now();
  const rows = await db.domain.findMany({
    where: {
      status: { in: ["PENDING_DNS", "VERIFYING"] },
      createdAt: { gte: new Date(now - AUTO_CHECK_WINDOW_MS) },
      OR: [
        { lastCheckedAt: null },
        { lastCheckedAt: { lt: new Date(now - AUTO_CHECK_EVERY_MS) } },
      ],
    },
    orderBy: { lastCheckedAt: { sort: "asc", nulls: "first" } },
    take: 20,
    select: { id: true },
  });

  let active = 0;
  for (const row of rows) {
    try {
      const item = await check(row.id);
      if (item.status === "ACTIVE") active += 1;
    } catch (error) {
      logger.warn("domain.cron_check_failed", {
        domainId: row.id,
        reason: describe(error),
      });
    }
  }

  return { checked: rows.length, active };
}
