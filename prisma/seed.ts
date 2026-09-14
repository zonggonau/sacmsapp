/**
 * Seed database SaCMS — docs/06-DATABASE-SCHEMA.md §6.4
 *
 * WAJIB idempoten: dijalankan berulang di staging tanpa menggandakan data.
 * Jalankan dengan: pnpm db:seed
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { DEFAULT_V0_MODEL, PLAN_MODELS } from "../src/config/ai-models";
import { PrismaClient } from "../src/generated/prisma/client";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL belum diisi. Seed tidak bisa berjalan.");
}

// Prisma 7 mewajibkan driver adapter — lihat docs/adr/ADR-007-prisma-driver-adapter.md
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// ============================================================
//  PAKET
// ============================================================

const PLANS = [
  {
    slug: "free",
    name: "Free",
    description: "Untuk mencoba. Satu website, kuota terbatas.",
    priceMonthly: 0,
    sortOrder: 0,
    maxProjects: 1,
    monthlyCredits: 30,
    maxCustomDomains: 0,
    maxDeploysPerDay: 3,
    // Id model dari satu sumber: src/config/ai-models.ts (diverifikasi dari v0-sdk)
    allowedModels: PLAN_MODELS.free ?? [DEFAULT_V0_MODEL],
  },
  {
    slug: "pro",
    name: "Pro",
    description: "Untuk freelancer dan usaha kecil.",
    priceMonthly: 149_000,
    sortOrder: 1,
    maxProjects: 10,
    monthlyCredits: 500,
    maxCustomDomains: 3,
    maxDeploysPerDay: 30,
    allowedModels: PLAN_MODELS.pro ?? [DEFAULT_V0_MODEL],
  },
  {
    slug: "business",
    name: "Business",
    description: "Untuk agensi dan instansi.",
    priceMonthly: 499_000,
    sortOrder: 2,
    maxProjects: 50,
    monthlyCredits: 3_000,
    maxCustomDomains: 25,
    maxDeploysPerDay: 200,
    allowedModels: PLAN_MODELS.business ?? [DEFAULT_V0_MODEL],
  },
] as const;

// ============================================================
//  PENGATURAN SISTEM
// ============================================================

const SETTINGS = [
  {
    key: "ai.killSwitch",
    value: false,
    description: "Bila true, seluruh permintaan generate baru ditolak.",
  },
  {
    key: "ai.defaultModel",
    value: DEFAULT_V0_MODEL,
    description: "Model v0 yang dipakai untuk build baru.",
  },
  {
    key: "ai.dailyCostThresholdIdr",
    value: 400_000,
    description: "Biaya harian yang memicu kill switch otomatis.",
  },
  {
    key: "system.maintenance",
    value: false,
    description: "Bila true, hanya admin yang bisa masuk.",
  },
  {
    key: "signup.enabled",
    value: true,
    description: "Bila false, pendaftaran baru ditutup.",
  },
] as const;

// ============================================================

async function seedPlans() {
  for (const plan of PLANS) {
    await db.plan.upsert({
      where: { slug: plan.slug },
      update: { ...plan, allowedModels: [...plan.allowedModels] },
      create: { ...plan, allowedModels: [...plan.allowedModels] },
    });
  }
  console.log(`  ✓ ${PLANS.length} paket`);
}

async function seedSettings() {
  for (const setting of SETTINGS) {
    await db.systemSetting.upsert({
      where: { key: setting.key },
      update: { description: setting.description },
      create: { ...setting },
    });
  }
  console.log(`  ✓ ${SETTINGS.length} pengaturan sistem`);
}

/**
 * Membuat akun pemilik sistem.
 *
 * SUPER_ADMIN tidak bisa dibuat lewat UI pendaftaran (docs/07 §7.3) — hanya
 * lewat seed ini, atau oleh SUPER_ADMIN lain. Hash kata sandi memakai
 * hashPassword() milik Better Auth agar formatnya persis sama dengan yang
 * dihasilkan alur pendaftaran biasa.
 */
async function seedSuperAdmin() {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;

  if (!email) {
    console.log("  – SEED_SUPERADMIN_EMAIL kosong, super admin dilewati");
    return;
  }

  // Pengaman: tidak ada kata sandi default di repositori.
  //
  // Minimum 10 berlaku di SEMUA lingkungan karena itu batas yang ditegakkan
  // Better Auth (lihat src/lib/auth.ts). Kata sandi lebih pendek menghasilkan
  // akun yang tidak bisa dipakai masuk — gagal diam-diam yang membingungkan.
  // Production menuntut 16 karena akun ini memegang kendali penuh sistem.
  const minLength = process.env.NODE_ENV === "production" ? 16 : 10;

  if (password && password.length < minLength) {
    throw new Error(
      `SEED_SUPERADMIN_PASSWORD terlalu pendek (${password.length} karakter). ` +
        `Minimal ${minLength} karakter. Akun super admin memegang kendali penuh sistem.`,
    );
  }

  if (process.env.NODE_ENV === "production" && !password) {
    throw new Error("SEED_SUPERADMIN_PASSWORD wajib diisi di production.");
  }

  const businessPlan = await db.plan.findUniqueOrThrow({ where: { slug: "business" } });

  const user = await db.user.upsert({
    where: { email },
    update: { role: "SUPER_ADMIN", status: "ACTIVE" },
    create: {
      email,
      name: "System Owner",
      emailVerified: true,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      planId: businessPlan.id,
    },
  });

  if (password) {
    const hash = await hashPassword(password);
    await db.account.upsert({
      where: { providerId_accountId: { providerId: "credential", accountId: user.id } },
      update: { password: hash },
      create: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: hash,
      },
    });
    console.log(`  ✓ super admin + kredensial: ${user.email}`);
  } else {
    console.log(`  ✓ super admin (tanpa kata sandi): ${user.email}`);
  }
}

async function main() {
  console.log("Seed SaCMS…");
  await seedPlans();
  await seedSettings();
  await seedSuperAdmin();
  console.log("Selesai.");
}

main()
  .catch((error: unknown) => {
    console.error("Seed gagal:", error);
    process.exit(1);
  })
  .finally(() => {
    void db.$disconnect();
  });
