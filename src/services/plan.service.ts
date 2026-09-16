import { isV0Model } from "@/config/ai-models";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { AuditTrail } from "@/services/audit.service";

/**
 * Paket sebagai data — docs/10 §10.6.
 *
 * Batas disimpan di tabel Plan, jadi perubahan berlaku tanpa deploy. Menurunkan
 * batas TIDAK memutus pengguna yang sudah melewatinya; mereka hanya tidak bisa
 * membuat yang baru (penegakan di Fase 6).
 *
 * Tidak ada fungsi hapus: setiap pengguna menunjuk ke satu paket.
 */

export async function list() {
  const plans = await db.plan.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      priceMonthly: true,
      // ADR-012: Paket Project dibayar per tahun; paket lama masih per bulan.
      priceYearly: true,
      isPublic: true,
      sortOrder: true,
      maxProjects: true,
      monthlyCredits: true,
      maxCustomDomains: true,
      maxDeploysPerDay: true,
      allowedModels: true,
      _count: { select: { users: true } },
    },
  });

  return plans.map(({ _count, ...p }) => ({ ...p, userCount: _count.users }));
}

export interface PlanInput {
  id?: string | undefined;
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  isPublic: boolean;
  sortOrder: number;
  maxProjects: number;
  monthlyCredits: number;
  maxCustomDomains: number;
  maxDeploysPerDay: number;
  allowedModels: string[];
}

export async function upsert(
  input: PlanInput,
): Promise<AuditTrail & { planId: string }> {
  const models = [...new Set(input.allowedModels)];
  if (models.length === 0 || !models.every(isV0Model)) {
    throw new AppError("VALIDATION", "Pilih minimal satu model AI yang valid.");
  }

  const data = {
    slug: input.slug,
    name: input.name,
    description: input.description,
    priceMonthly: input.priceMonthly,
    isPublic: input.isPublic,
    sortOrder: input.sortOrder,
    maxProjects: input.maxProjects,
    monthlyCredits: input.monthlyCredits,
    maxCustomDomains: input.maxCustomDomains,
    maxDeploysPerDay: input.maxDeploysPerDay,
    allowedModels: models,
  };

  try {
    if (input.id) {
      const before = await db.plan.findUnique({ where: { id: input.id } });
      if (!before) throw new AppError("NOT_FOUND", "Paket tidak ditemukan.");

      // Slug dipakai kode (pendaftaran memakai "free"). Mengubahnya memutus itu.
      if (before.slug !== input.slug) {
        throw new AppError(
          "VALIDATION",
          "Slug paket yang sudah ada tidak bisa diubah.",
        );
      }

      await db.plan.update({ where: { id: input.id }, data });
      const { createdAt: _c, updatedAt: _u, ...beforeData } = before;

      return {
        planId: input.id,
        targetType: "Plan",
        targetId: input.id,
        before: beforeData,
        after: data,
      };
    }

    const created = await db.plan.create({ data, select: { id: true } });
    return {
      planId: created.id,
      targetType: "Plan",
      targetId: created.id,
      after: data,
    };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      throw new AppError("CONFLICT", "Slug paket sudah dipakai paket lain.");
    }
    throw error;
  }
}
