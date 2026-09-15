/**
 * Tugas database untuk uji E2E, dijalankan sebagai proses terpisah lewat tsx.
 *
 * Mengapa terpisah: Playwright memuat berkas uji sebagai CommonJS, sedangkan
 * klien Prisma hasil generate adalah ESM (`import.meta`). Proses ini menerima
 * `<nama-tugas> <json-argumen>` dan mencetak hasilnya sebagai JSON satu baris.
 */
import { existsSync } from "node:fs";

import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

import { PrismaClient } from "../../src/generated/prisma/client";

if (!process.env.DATABASE_URL && existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

type Args = Record<string, unknown>;
const str = (v: unknown) => String(v);

const tasks: Record<string, (args: Args) => Promise<unknown>> = {
  async createUser(args) {
    const plan = await db.plan.findUniqueOrThrow({
      where: { slug: args.planSlug ? str(args.planSlug) : "free" },
    });
    const user = await db.user.create({
      data: {
        name: `E2E ${str(args.label)}`,
        email: str(args.email),
        emailVerified: true,
        role: args.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
        planId: plan.id,
        creditsUsed: Number(args.creditsUsed ?? 0),
      },
    });
    await db.account.create({
      data: {
        userId: user.id,
        providerId: "credential",
        accountId: user.id,
        password: await hashPassword(str(args.password)),
      },
    });
    return { id: user.id, email: user.email, name: user.name };
  },

  async planCredits(args) {
    const plan = await db.plan.findUniqueOrThrow({ where: { slug: str(args.slug) } });
    return plan.monthlyCredits;
  },

  async createProject(args) {
    const project = await db.project.create({
      data: {
        name: str(args.name),
        slug: `e2e-${Date.now()}`,
        initialPrompt: str(args.initialPrompt),
        userId: str(args.userId),
      },
    });
    return { id: project.id };
  },

  /** Project yang sudah punya pratinjau dan riwayat chat — tanpa memanggil v0. */
  async seedChat(args) {
    await db.project.update({
      where: { id: str(args.projectId) },
      data: { status: "READY", previewUrl: str(args.previewUrl) },
    });
    await db.aiMessage.create({
      data: {
        projectId: str(args.projectId),
        role: "USER",
        content: str(args.content),
      },
    });
    return null;
  },

  countProjects: (args) => db.project.count({ where: { userId: str(args.userId) } }),

  countVersions: (args) =>
    db.projectVersion.count({ where: { projectId: str(args.projectId) } }),

  countBuildJobs: (args) =>
    db.buildJob.count({ where: { projectId: str(args.projectId) } }),

  getUserByEmail: (args) =>
    db.user.findUniqueOrThrow({
      where: { email: str(args.email) },
      select: { emailVerified: true, role: true },
    }),

  getProject: (args) =>
    db.project.findUniqueOrThrow({
      where: { id: str(args.id) },
      select: { status: true, productionUrl: true },
    }),

  async hasAudit(args) {
    const row = await db.auditLog.findFirst({
      where: {
        action: str(args.action),
        targetId: str(args.targetId),
        actorId: str(args.actorId),
      },
      select: { id: true },
    });
    return row !== null;
  },
};

async function main() {
  const [name, raw] = process.argv.slice(2);
  const task = name ? tasks[name] : undefined;
  if (!task) throw new Error(`Tugas tidak dikenal: ${name}`);
  const result = await task(raw ? (JSON.parse(raw) as Args) : {});
  process.stdout.write(`${JSON.stringify(result ?? null)}\n`);
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
