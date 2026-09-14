import { z } from "zod";

/** Skema aksi builder — kontrak di docs/08-SERVER-ACTIONS.md §8.6. */

export const sendBuilderMessageSchema = z.object({
  projectId: z.string().min(1),
  message: z
    .string()
    .trim()
    .min(5, "Tulis sedikit lebih panjang — minimal 5 karakter")
    .max(4000, "Pesan maksimal 4.000 karakter"),
});

export const startBuildSchema = z.object({
  projectId: z.string().min(1),
});

export const jobIdSchema = z.object({
  jobId: z.string().min(1),
});

export const restoreVersionSchema = z.object({
  projectId: z.string().min(1),
  versionId: z.string().min(1),
});
