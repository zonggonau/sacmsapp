"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";

import { AppError } from "@/lib/errors";
import { authActionClient } from "@/lib/safe-action";
import {
  deploymentIdSchema,
  deployProjectSchema,
  rollbackDeploymentSchema,
} from "@/schemas/deploy.schema";
import * as deployService from "@/services/deploy.service";

/**
 * Aksi Deployment — docs/08-SERVER-ACTIONS.md §8.6, ADR-008.
 *
 * Seperti builder: penerbitan TIDAK ditunggu. Deployment dicatat, dijalankan
 * lewat after(), dan UI memantau statusnya dengan polling.
 */

function revalidateDeployments(projectId: string) {
  revalidatePath(`/projects/${projectId}`, "layout");
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export const deployProject = authActionClient
  .metadata({ actionName: "deploy.create", rateLimit: { key: "deploy" }, audit: true })
  .inputSchema(deployProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { deploymentId } = await deployService.request({
      projectId: parsedInput.projectId,
      userId: ctx.user.id,
      versionId: parsedInput.versionId,
    });

    after(() => deployService.start(deploymentId));

    revalidateDeployments(parsedInput.projectId);
    return { deploymentId };
  });

export const rollbackDeployment = authActionClient
  .metadata({
    actionName: "deploy.rollback",
    rateLimit: { key: "deploy" },
    audit: true,
  })
  .inputSchema(rollbackDeploymentSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { deploymentId } = await deployService.rollback({
      projectId: parsedInput.projectId,
      userId: ctx.user.id,
      deploymentId: parsedInput.deploymentId,
    });

    after(() => deployService.start(deploymentId));

    revalidateDeployments(parsedInput.projectId);
    return { deploymentId };
  });

/**
 * Sengaja tanpa rate limit dan audit — aksi baca yang dipanggil polling
 * (alasan yang sama dengan getBuildStatus).
 */
export const getDeploymentStatus = authActionClient
  .metadata({ actionName: "deploy.status" })
  .inputSchema(deploymentIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const status = await deployService.getStatus({
      deploymentId: parsedInput.deploymentId,
      userId: ctx.user.id,
    });

    if (!status) throw new AppError("NOT_FOUND", "Deployment tidak ditemukan.");

    // Jaring pengaman bila after() tidak pernah berjalan. start() mengklaim
    // secara atomik, jadi v0 tidak pernah diminta menerbitkan dua kali.
    if (status.needsKick) {
      after(() => deployService.start(status.id));
    }

    return {
      id: status.id,
      status: status.status,
      url: status.url,
      errorMessage: status.errorMessage,
    };
  });
