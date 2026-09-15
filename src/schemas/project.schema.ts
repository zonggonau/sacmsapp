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
 * Nama project WAJIB — keputusan pemilik sistem 2026-09-16. Nama yang
 * diturunkan otomatis ("Website Pemerintahan — 14 Sep 2026") membuat daftar
 * project sulit dibedakan.
 */
const requiredName = z
  .string()
  .trim()
  .min(1, "Nama project wajib diisi")
  .min(3, "Nama minimal 3 karakter")
  .max(100, "Nama maksimal 100 karakter");

const INVALID_REFERENCE =
  "Alamat website referensi tidak valid. Contoh: www.websitecontoh.com";

/**
 * Website referensi OPSIONAL: acuan tampilan dan susunan halaman bagi AI.
 * Boleh ditulis tanpa https:// — dinormalisasi di sini. Hanya alamat web
 * publik: localhost, alamat IP, kredensial di URL, dan skema selain http(s)
 * ditolak.
 */
export const referenceUrlSchema = z
  .string()
  .trim()
  .max(2000, "Alamat website maksimal 2.000 karakter")
  .transform((value, ctx) => {
    if (value === "") return undefined;

    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    let url: URL;
    try {
      url = new URL(withScheme);
    } catch {
      ctx.addIssue({ code: "custom", message: INVALID_REFERENCE });
      return z.NEVER;
    }

    const host = url.hostname.toLowerCase();
    const isIp = /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[");
    const isLocal =
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.endsWith(".local") ||
      host.endsWith(".internal");

    if (
      !/^https?:$/.test(url.protocol) ||
      !host.includes(".") ||
      isIp ||
      isLocal ||
      url.username ||
      url.password
    ) {
      ctx.addIssue({ code: "custom", message: INVALID_REFERENCE });
      return z.NEVER;
    }

    return url.toString();
  })
  .optional();

export const createProjectSchema = z.object({
  name: requiredName,
  websiteType,
  prompt,
  referenceUrl: referenceUrlSchema,
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
  confirmPhrase: z.string().min(1, "Ketik kalimat konfirmasi"),
});

export const projectFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z
    .enum(["all", "DRAFT", "BUILDING", "READY", "LIVE", "FAILED", "ARCHIVED"])
    .default("all"),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ProjectFilters = z.infer<typeof projectFiltersSchema>;
