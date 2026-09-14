"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { authActionClient } from "@/lib/safe-action";
import {
  createProjectSchema,
  deleteProjectSchema,
  projectIdSchema,
  renameProjectSchema,
} from "@/schemas/project.schema";
import * as buildService from "@/services/build.service";
import * as projectService from "@/services/project.service";

/**
 * Aksi project — kontrak di docs/08-SERVER-ACTIONS.md §8.6.
 *
 * Action TIDAK berisi logika bisnis: ia memanggil service, lalu mengurus
 * revalidasi dan pengalihan. Keduanya hanya boleh ada di lapisan ini.
 */

function revalidateLists() {
  revalidatePath("/projects");
  revalidatePath("/dashboard");
}

export const createProject = authActionClient
  .metadata({
    actionName: "project.create",
    rateLimit: { key: "buatProject" },
    audit: true,
  })
  .inputSchema(createProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { project, job } = await projectService.createWithInitialBuild({
      userId: ctx.user.id,
      input: parsedInput,
    });

    // Pipeline berjalan di background setelah respons terkirim (docs/08 §8.2)
    after(() => buildService.run(job.id));

    revalidateLists();
    redirect(`/projects/${project.id}/builder`);
  });

export const renameProject = authActionClient
  .metadata({ actionName: "project.rename", audit: true })
  .inputSchema(renameProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    await projectService.rename({
      projectId: parsedInput.projectId,
      userId: ctx.user.id,
      name: parsedInput.name,
    });

    revalidateLists();
    revalidatePath(`/projects/${parsedInput.projectId}`);
    revalidatePath(`/projects/${parsedInput.projectId}/pengaturan`);

    return { renamed: true };
  });

export const archiveProject = authActionClient
  .metadata({ actionName: "project.archive", audit: true })
  .inputSchema(projectIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    await projectService.archive({
      projectId: parsedInput.projectId,
      userId: ctx.user.id,
    });

    revalidateLists();
    revalidatePath(`/projects/${parsedInput.projectId}`);

    return { archived: true };
  });

export const unarchiveProject = authActionClient
  .metadata({ actionName: "project.unarchive", audit: true })
  .inputSchema(projectIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    await projectService.unarchive({
      projectId: parsedInput.projectId,
      userId: ctx.user.id,
    });

    revalidateLists();
    revalidatePath(`/projects/${parsedInput.projectId}`);

    return { unarchived: true };
  });

/**
 * Nama action diakhiri `.delete` supaya cocok dengan pola DESTRUCTIVE_ACTION di
 * lib/safe-action.ts — otomatis diblokir saat Super Admin menyamar (docs/07 §7.3).
 */
export const deleteProject = authActionClient
  .metadata({ actionName: "project.delete", audit: true })
  .inputSchema(deleteProjectSchema)
  .action(async ({ parsedInput, ctx }) => {
    await projectService.softDelete({
      projectId: parsedInput.projectId,
      userId: ctx.user.id,
      confirmName: parsedInput.confirmName,
    });

    revalidateLists();
    redirect("/projects");
  });

export const duplicateProject = authActionClient
  .metadata({
    actionName: "project.duplicate",
    rateLimit: { key: "buatProject" },
    audit: true,
  })
  .inputSchema(projectIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const project = await projectService.duplicate({
      projectId: parsedInput.projectId,
      userId: ctx.user.id,
    });

    revalidateLists();
    redirect(`/projects/${project.id}`);
  });
