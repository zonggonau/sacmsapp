import { z } from "zod";

import { WEBSITE_TYPES } from "@/config/website-types";

const websiteTypeValues = WEBSITE_TYPES.map((t) => t.value);

const websiteType = z.enum(websiteTypeValues as [string, ...string[]]);

const projectName = z
  .string()
  .trim()
  .min(3, "Nama minimal 3 karakter")
  .max(100, "Nama maksimal 100 karakter");

/**
 * Prompt adalah inti produk. Batas 4.000 karakter mengikuti
 * docs/09-AI-BUILDER-PIPELINE.md §9.5 — prompt lebih panjang dipotong sebelum
 * dikirim ke AI, jadi lebih baik ditolak di sini dengan pesan jelas.
 */
const prompt = z
  .string()
  .trim()
  .min(20, "Ceritakan sedikit lebih lengkap — minimal 20 karakter")
  .max(4000, "Deskripsi maksimal 4.000 karakter");

/**
 * `name` sengaja OPSIONAL.
 *
 * Prinsip produk docs/01 §1.7: "kalau sebuah kebutuhan bisa diselesaikan dengan
 * prompt, jangan buat form". Nama diturunkan dari tipe website dan tanggal bila
 * pengguna tidak mengisinya, dan bisa diganti kapan saja di pengaturan.
 */
export const createProjectSchema = z.object({
  name: z.union([projectName, z.literal("")]).optional(),
  websiteType,
  prompt,
});

export const renameProjectSchema = z.object({
  projectId: z.string().min(1),
  name: projectName,
});

export const projectIdSchema = z.object({
  projectId: z.string().min(1),
});

/**
 * Hapus permanen memakai konfirmasi ketik-untuk-yakin (docs/10 §10.9).
 * Nama yang diketik dicocokkan di server, bukan hanya di klien.
 */
export const deleteProjectSchema = z.object({
  projectId: z.string().min(1),
  confirmName: z.string().min(1, "Ketik nama project untuk konfirmasi"),
});

export const projectFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z
    .enum(["all", "DRAFT", "BUILDING", "READY", "LIVE", "FAILED", "ARCHIVED"])
    .default("all"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ProjectFilters = z.infer<typeof projectFiltersSchema>;
