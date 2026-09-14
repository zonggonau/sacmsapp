import { z } from "zod";

/**
 * Skema aksi Deployment — docs/08-SERVER-ACTIONS.md §8.6.
 *
 * Tidak ada pilihan `target`: MVP hanya menerbitkan ke production. Pratinjau
 * sudah disediakan builder lewat demo URL v0 (ADR-008).
 */

export const deployProjectSchema = z.object({
  projectId: z.string().min(1, "ID project wajib diisi"),
  versionId: z.string().min(1).optional(),
});

export const rollbackDeploymentSchema = z.object({
  projectId: z.string().min(1, "ID project wajib diisi"),
  deploymentId: z.string().min(1, "ID deployment wajib diisi"),
});

export const deploymentIdSchema = z.object({
  deploymentId: z.string().min(1, "ID deployment wajib diisi"),
});
