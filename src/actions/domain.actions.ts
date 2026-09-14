"use server";

import { revalidatePath } from "next/cache";

import { authActionClient } from "@/lib/safe-action";
import { addDomainSchema, domainIdSchema } from "@/schemas/domain.schema";
import * as domainService from "@/services/domain.service";

/**
 * Aksi Custom Domain — docs/08-SERVER-ACTIONS.md §8.6.
 *
 * `projectId` untuk revalidasi diambil dari hasil service (yang sudah
 * memeriksa kepemilikan), bukan dari masukan klien.
 */

function revalidateDomains(projectId: string) {
  revalidatePath(`/projects/${projectId}/domain`);
}

export const addDomain = authActionClient
  .metadata({ actionName: "domain.add", rateLimit: { key: "deploy" }, audit: true })
  .inputSchema(addDomainSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, item } = await domainService.add({
      projectId: parsedInput.projectId,
      userId: ctx.user.id,
      domain: parsedInput.domain,
    });

    revalidateDomains(projectId);
    return { id: item.id, name: item.name, status: item.status };
  });

export const verifyDomain = authActionClient
  .metadata({ actionName: "domain.verify", rateLimit: { key: "deploy" } })
  .inputSchema(domainIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId, item } = await domainService.verify({
      domainId: parsedInput.domainId,
      userId: ctx.user.id,
    });

    revalidateDomains(projectId);
    return { id: item.id, status: item.status, errorMessage: item.errorMessage };
  });

/** Nama `.delete` sengaja: diblokir saat Super Admin menyamar (lib/safe-action). */
export const removeDomain = authActionClient
  .metadata({ actionName: "domain.delete", audit: true })
  .inputSchema(domainIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const { projectId } = await domainService.remove({
      domainId: parsedInput.domainId,
      userId: ctx.user.id,
    });

    revalidateDomains(projectId);
    return { removed: true };
  });
