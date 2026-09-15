import { DELETE_CONFIRM_PHRASE } from "@/config/project";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { CreateProjectInput } from "@/schemas/project.schema";
import type { ProjectStatus, WebsiteType } from "@/types/db";
import * as buildService from "@/services/build.service";
import * as deployService from "@/services/deploy.service";
import * as quotaService from "@/services/quota.service";

/**
 * Logika bisnis project — docs/02 §2.2 lapisan 4.
 *
 * ATURAN YANG MENGIKAT SELURUH BERKAS INI:
 * setiap query menyertakan `userId` dan `deletedAt: null` DI DALAM klausa where,
 * bukan diperiksa setelah data diambil. Mengambil dulu lalu membandingkan
 * pemilik adalah pola yang mudah lolos saat kode berubah (docs/06 §6.7).
 *
 * Service TIDAK memanggil revalidatePath/redirect/cookies — itu tugas action.
 */

/** Bentuk data yang dikirim ke UI. Bukan objek Prisma mentah (docs/08 §8.8). */
export interface ProjectListItem {
  id: string;
  name: string;
  slug: string;
  websiteType: WebsiteType;
  status: ProjectStatus;
  productionUrl: string | null;
  previewUrl: string | null;
  createdAt: Date;
  lastDeployAt: Date | null;
}

export interface ProjectDetail extends ProjectListItem {
  description: string | null;
  initialPrompt: string;
  v0ChatId: string | null;
  updatedAt: Date;
  lastBuildAt: Date | null;
  versionCount: number;
}

const LIST_SELECT = {
  id: true,
  name: true,
  slug: true,
  websiteType: true,
  status: true,
  productionUrl: true,
  previewUrl: true,
  createdAt: true,
  lastDeployAt: true,
} as const;

/* ============================================================
 *  BACA
 * ============================================================ */

export interface ListParams {
  userId: string;
  q?: string | undefined;
  status?: ProjectStatus | undefined;
  /** Pagination memakai cursor, bukan skip/offset (docs/06 §6.7). */
  cursor?: string | undefined;
  limit?: number;
}

export async function listForUser({
  userId,
  q,
  status,
  cursor,
  limit = 24,
}: ListParams): Promise<{ items: ProjectListItem[]; nextCursor: string | null }> {
  const items = await db.project.findMany({
    where: {
      userId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select: LIST_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > limit;
  return {
    items: hasMore ? items.slice(0, limit) : items,
    nextCursor: hasMore ? (items[limit - 1]?.id ?? null) : null,
  };
}

/**
 * Mengambil satu project milik pengguna.
 * Mengembalikan null bila tidak ada ATAU bukan milik pengguna tersebut —
 * pemanggil memakai notFound(), sehingga keberadaan project orang lain tidak
 * pernah terkonfirmasi (docs/12 ancaman A1).
 */
export async function getForUser(
  projectId: string,
  userId: string,
): Promise<ProjectDetail | null> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: {
      ...LIST_SELECT,
      description: true,
      initialPrompt: true,
      v0ChatId: true,
      updatedAt: true,
      lastBuildAt: true,
      _count: { select: { versions: true } },
    },
  });

  if (!project) return null;

  const { _count, ...rest } = project;
  return { ...rest, versionCount: _count.versions };
}

export async function getStats(userId: string) {
  const [total, live, building] = await Promise.all([
    db.project.count({ where: { userId, deletedAt: null } }),
    db.project.count({ where: { userId, deletedAt: null, status: "LIVE" } }),
    db.project.count({ where: { userId, deletedAt: null, status: "BUILDING" } }),
  ]);

  return { total, live, building };
}

/**
 * Riwayat pesan AI sebuah project.
 *
 * Kepemilikan ditegakkan lewat relasi `project: { userId }` di dalam where —
 * bukan dengan mengambil dulu lalu membandingkan.
 */
export async function listMessages(projectId: string, userId: string) {
  return db.aiMessage.findMany({
    where: { projectId, project: { userId, deletedAt: null } },
    select: { id: true, role: true, content: true, createdAt: true },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
}

export async function listVersions(projectId: string, userId: string) {
  const project = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { currentVersionId: true },
  });

  if (!project) return [];

  const versions = await db.projectVersion.findMany({
    where: { projectId },
    select: { id: true, number: true, summary: true, demoUrl: true, createdAt: true },
    orderBy: { number: "desc" },
    take: 50,
  });

  return versions.map((v) => ({
    ...v,
    isCurrent: v.id === project.currentVersionId,
  }));
}

export async function listRecent(userId: string, limit = 3) {
  return db.project.findMany({
    where: { userId, deletedAt: null },
    select: LIST_SELECT,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/* ============================================================
 *  TULIS
 * ============================================================ */

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "website"
  );
}

/**
 * Slug unik per pengguna. Tabel punya @@unique([userId, slug]), jadi tanpa ini
 * project kedua dengan nama sama akan gagal dengan error database mentah.
 */
async function uniqueSlug(userId: string, base: string): Promise<string> {
  const root = slugify(base);

  const taken = await db.project.findMany({
    where: { userId, slug: { startsWith: root } },
    select: { slug: true },
  });

  if (!taken.some((p) => p.slug === root)) return root;

  const used = new Set(taken.map((p) => p.slug));
  for (let i = 2; i < 1000; i += 1) {
    const candidate = `${root}-${i}`;
    if (!used.has(candidate)) return candidate;
  }

  return `${root}-${Date.now()}`;
}

export async function create({
  userId,
  input,
}: {
  userId: string;
  input: CreateProjectInput;
}): Promise<ProjectListItem> {
  const websiteType = input.websiteType as WebsiteType;
  const name = input.name;
  const slug = await uniqueSlug(userId, name);

  // Batas jumlah website paket (docs/11 §11.3). Pemeriksaan & pembuatan dalam
  // satu transaksi berkunci: dua klik bersamaan tidak bisa melewati batas.
  return db.$transaction(async (tx) => {
    await quotaService.assertCanCreateProject(tx, userId);

    return tx.project.create({
      data: {
        userId,
        name,
        slug,
        websiteType,
        initialPrompt: input.prompt,
        referenceUrl: input.referenceUrl ?? null,
        status: "DRAFT",
      },
      select: LIST_SELECT,
    });
  });
}

/**
 * Membuat project baru sekaligus mendaftarkan job pembuatan awal (Fase 3).
 *
 * Mengembalikan objek project dan id job sehingga pemanggil dapat
 * menjadwalkan eksekusi pipeline di background via after().
 */
export async function createWithInitialBuild({
  userId,
  input,
}: {
  userId: string;
  input: CreateProjectInput;
}): Promise<{ project: ProjectListItem; job: { id: string } }> {
  // Tolak lebih dini bila kredit habis, supaya tidak tertinggal project kosong
  // tanpa build. Keputusan final tetap di reservasi berkunci saat createJob.
  await quotaService.assertCreditsAvailable(userId, 1);

  const project = await create({ userId, input });

  const { jobId } = await buildService.createJob({
    projectId: project.id,
    userId,
    kind: "INITIAL_GENERATE",
    prompt: input.prompt,
  });

  return { project, job: { id: jobId } };
}

export async function rename({
  projectId,
  userId,
  name,
}: {
  projectId: string;
  userId: string;
  name: string;
}): Promise<void> {
  const existing = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!existing) throw new AppError("NOT_FOUND", "Project tidak ditemukan.");

  const slug = await uniqueSlug(userId, name);
  await db.project.update({
    where: { id: projectId },
    data: { name: name.trim(), slug },
  });
}

export async function archive({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<void> {
  const result = await db.project.updateMany({
    where: { id: projectId, userId, deletedAt: null },
    data: { status: "ARCHIVED" },
  });
  if (result.count === 0) throw new AppError("NOT_FOUND", "Project tidak ditemukan.");
}

export async function unarchive({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<void> {
  const result = await db.project.updateMany({
    where: { id: projectId, userId, deletedAt: null, status: "ARCHIVED" },
    data: { status: "DRAFT" },
  });
  if (result.count === 0) throw new AppError("NOT_FOUND", "Project tidak ditemukan.");
}

/**
 * Soft delete (docs/06 §6.2 aturan 4). Data pengguna tidak pernah dihapus
 * permanen oleh pengguna sendiri — hanya Super Admin, dan itu tercatat di audit.
 */
export async function softDelete({
  projectId,
  userId,
  confirmName,
  confirmPhrase,
}: {
  projectId: string;
  userId: string;
  confirmName: string;
  confirmPhrase: string;
}): Promise<void> {
  const project = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!project) throw new AppError("NOT_FOUND", "Project tidak ditemukan.");

  // Pencocokan dilakukan di SERVER. Konfirmasi yang hanya diperiksa di klien
  // bukan konfirmasi.
  if (confirmName.trim() !== project.name) {
    throw new AppError(
      "VALIDATION",
      "Nama yang Anda ketik tidak sama dengan nama project.",
    );
  }
  if (confirmPhrase.trim().toLowerCase() !== DELETE_CONFIRM_PHRASE) {
    throw new AppError(
      "VALIDATION",
      `Ketik "${DELETE_CONFIRM_PHRASE}" untuk mengonfirmasi penghapusan.`,
    );
  }

  // Janji dialog: website yang sudah terbit tidak bisa diakses lagi. Diturunkan
  // dulu; bila vendor gagal, project tidak ditandai terhapus.
  await deployService.takeDown(project.id);

  await db.project.update({
    where: { id: projectId },
    data: { deletedAt: new Date(), status: "ARCHIVED" },
  });
}

export async function duplicate({
  projectId,
  userId,
}: {
  projectId: string;
  userId: string;
}): Promise<ProjectListItem> {
  const source = await db.project.findFirst({
    where: { id: projectId, userId, deletedAt: null },
    select: {
      name: true,
      description: true,
      websiteType: true,
      initialPrompt: true,
      referenceUrl: true,
    },
  });
  if (!source) throw new AppError("NOT_FOUND", "Project tidak ditemukan.");

  const name = `${source.name} (salinan)`.slice(0, 100);
  const slug = await uniqueSlug(userId, name);

  // Salinan selalu DRAFT: pengenal v0/Vercel dan URL TIDAK diwarisi, karena
  // keduanya menunjuk ke sumber daya milik project asal.
  return db.$transaction(async (tx) => {
    await quotaService.assertCanCreateProject(tx, userId);

    return tx.project.create({
      data: {
        userId,
        name,
        slug,
        description: source.description,
        websiteType: source.websiteType,
        initialPrompt: source.initialPrompt,
        referenceUrl: source.referenceUrl,
        status: "DRAFT",
      },
      select: LIST_SELECT,
    });
  });
}
