"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { after } from "next/server";

import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { authActionClient } from "@/lib/safe-action";
import {
  adminJobIdSchema,
  adminRollbackSchema,
  dailyCostThresholdSchema,
  changePlanSchema,
  changeRoleSchema,
  defaultModelSchema,
  deleteUserSchema,
  planSchema,
  restoreRulesSchema,
  saveRulesSchema,
  setQuotaSchema,
  suspendSchema,
  toggleSettingSchema,
  userIdSchema,
} from "@/schemas/admin.schema";
import * as adminBuild from "@/services/admin-build.service";
import * as adminProject from "@/services/admin-project.service";
import * as adminUser from "@/services/admin-user.service";
import * as auditService from "@/services/audit.service";
import * as buildService from "@/services/build.service";
import * as deployService from "@/services/deploy.service";
import * as planService from "@/services/plan.service";
import * as systemService from "@/services/system.service";

/**
 * Aksi panel Super Admin — docs/08 §8.6, docs/10.
 *
 * Setiap action di sini WAJIB `requireRole: "SUPER_ADMIN"` dan `audit: true`.
 * lib/safe-action.ts menolak menjalankan action berperan tanpa audit.
 *
 * Service mengembalikan AuditTrail di kunci `audit`; middleware mencatatnya lalu
 * membuangnya dari respons.
 */

const SUPER_ADMIN = {
  requireRole: "SUPER_ADMIN",
  audit: true,
  rateLimit: { key: "aksiAdmin" },
} as const;

function revalidateAdmin() {
  revalidatePath("/admin", "layout");
}

/* ============================================================
 *  PENGGUNA
 * ============================================================ */

export const adminUpdateUserPlan = authActionClient
  .metadata({ actionName: "admin.user.plan", ...SUPER_ADMIN })
  .inputSchema(changePlanSchema)
  .action(async ({ parsedInput }) => {
    const audit = await adminUser.changePlan(parsedInput);
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminSetUserQuota = authActionClient
  .metadata({ actionName: "admin.user.quota", ...SUPER_ADMIN })
  .inputSchema(setQuotaSchema)
  .action(async ({ parsedInput }) => {
    const audit = await adminUser.setQuota(parsedInput);
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminResetUserUsage = authActionClient
  .metadata({ actionName: "admin.user.reset", ...SUPER_ADMIN })
  .inputSchema(userIdSchema)
  .action(async ({ parsedInput }) => {
    const audit = await adminUser.resetUsage(parsedInput);
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminSuspendUser = authActionClient
  .metadata({ actionName: "admin.user.suspend", ...SUPER_ADMIN })
  .inputSchema(suspendSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await adminUser.suspend({ ...parsedInput, actorId: ctx.user.id });
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminReactivateUser = authActionClient
  .metadata({ actionName: "admin.user.reactivate", ...SUPER_ADMIN })
  .inputSchema(userIdSchema)
  .action(async ({ parsedInput }) => {
    const audit = await adminUser.reactivate(parsedInput);
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminUpdateUserRole = authActionClient
  .metadata({ actionName: "admin.user.role", ...SUPER_ADMIN })
  .inputSchema(changeRoleSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await adminUser.changeRole({ ...parsedInput, actorId: ctx.user.id });
    revalidateAdmin();
    return { ok: true, self: parsedInput.userId === ctx.user.id, audit };
  });

export const adminRevokeSessions = authActionClient
  .metadata({ actionName: "admin.user.sessions_revoke", ...SUPER_ADMIN })
  .inputSchema(userIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await adminUser.revokeSessions(parsedInput);
    revalidateAdmin();
    return { ok: true, self: parsedInput.userId === ctx.user.id, audit };
  });

export const adminDeleteUser = authActionClient
  .metadata({ actionName: "admin.user.delete", ...SUPER_ADMIN })
  .inputSchema(deleteUserSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await adminUser.hardDelete({ ...parsedInput, actorId: ctx.user.id });
    revalidateAdmin();
    return { ok: true, audit };
  });

/**
 * Mulai impersonasi — docs/07 §7.5. Better Auth menyimpan sesi admin di cookie
 * terpisah dan menulis cookie sesi pengguna target (lewat plugin nextCookies).
 */
export const adminImpersonateUser = authActionClient
  .metadata({ actionName: "user.impersonate.start", ...SUPER_ADMIN })
  .inputSchema(userIdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await adminUser.assertImpersonatable({
      actorId: ctx.user.id,
      userId: parsedInput.userId,
    });

    try {
      await auth.api.impersonateUser({
        body: { userId: parsedInput.userId },
        headers: await headers(),
      });
    } catch (error) {
      logger.error("admin.impersonate_failed", {
        reason: error instanceof Error ? error.message : "tidak diketahui",
      });
      throw new AppError("INTERNAL", "Gagal masuk sebagai pengguna. Coba lagi.");
    }

    return { ok: true, audit };
  });

/**
 * Selesai impersonasi. Dipanggil dari sesi PENGGUNA yang sedang dimasuki,
 * karena itu tanpa requireRole — yang diperiksa adalah `impersonatedBy`.
 * Audit dicatat atas nama admin yang menyamar.
 */
export const stopImpersonation = authActionClient
  .metadata({ actionName: "user.impersonate.end" })
  .action(async ({ ctx }) => {
    const adminId = ctx.session.impersonatedBy;
    if (!adminId) {
      throw new AppError("CONFLICT", "Anda tidak sedang masuk sebagai pengguna lain.");
    }

    try {
      await auth.api.stopImpersonating({ headers: await headers() });
    } catch (error) {
      logger.error("admin.stop_impersonate_failed", {
        reason: error instanceof Error ? error.message : "tidak diketahui",
      });
      throw new AppError(
        "INTERNAL",
        "Gagal kembali ke akun Anda. Silakan keluar lalu masuk lagi.",
      );
    }

    await auditService.record({
      action: "user.impersonate.end",
      actorId: adminId,
      actorRole: "SUPER_ADMIN",
      targetType: "User",
      targetId: ctx.user.id,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    return { userId: ctx.user.id };
  });

/* ============================================================
 *  BUILD
 * ============================================================ */

export const adminCancelBuild = authActionClient
  .metadata({ actionName: "admin.build.cancel", ...SUPER_ADMIN })
  .inputSchema(adminJobIdSchema)
  .action(async ({ parsedInput }) => {
    const { projectId, ...audit } = await adminBuild.cancel(parsedInput.jobId);
    revalidateAdmin();
    revalidatePath(`/projects/${projectId}/builder`);
    return { ok: true, audit };
  });

export const adminRetryBuild = authActionClient
  .metadata({ actionName: "admin.build.retry", ...SUPER_ADMIN })
  .inputSchema(adminJobIdSchema)
  .action(async ({ parsedInput }) => {
    const { projectId, newJobId, ...audit } = await adminBuild.retry(parsedInput.jobId);

    after(() => buildService.run(newJobId));

    revalidateAdmin();
    revalidatePath(`/projects/${projectId}/builder`);
    return { ok: true, jobId: newJobId, audit };
  });

/* ============================================================
 *  PENERBITAN — runbook "hasil AI merusak situs" (docs/12 §12.7)
 * ============================================================ */

export const adminRollbackDeployment = authActionClient
  .metadata({ actionName: "admin.deploy.rollback", ...SUPER_ADMIN })
  .inputSchema(adminRollbackSchema)
  .action(async ({ parsedInput }) => {
    const { deploymentId, ...audit } = await adminProject.rollbackAsAdmin(parsedInput);

    after(() => deployService.start(deploymentId));

    revalidateAdmin();
    revalidatePath(`/projects/${parsedInput.projectId}`, "layout");
    return { ok: true, deploymentId, audit };
  });

/* ============================================================
 *  PAKET
 * ============================================================ */

export const adminUpsertPlan = authActionClient
  .metadata({ actionName: "admin.plan.upsert", ...SUPER_ADMIN })
  .inputSchema(planSchema)
  .action(async ({ parsedInput }) => {
    const { planId, ...audit } = await planService.upsert(parsedInput);
    revalidateAdmin();
    return { ok: true, planId, audit };
  });

/* ============================================================
 *  SISTEM & AI
 * ============================================================ */

export const adminSetToggle = authActionClient
  .metadata({ actionName: "admin.setting.toggle", ...SUPER_ADMIN })
  .inputSchema(toggleSettingSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await systemService.setToggle({
      ...parsedInput,
      actorId: ctx.user.id,
    });
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminSetDefaultModel = authActionClient
  .metadata({ actionName: "admin.setting.model", ...SUPER_ADMIN })
  .inputSchema(defaultModelSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await systemService.setDefaultModel({
      model: parsedInput.model,
      actorId: ctx.user.id,
    });
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminSaveRules = authActionClient
  .metadata({ actionName: "admin.prompt.save", ...SUPER_ADMIN })
  .inputSchema(saveRulesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await systemService.saveRules({
      text: parsedInput.text,
      actorId: ctx.user.id,
    });
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminRestoreRules = authActionClient
  .metadata({ actionName: "admin.prompt.restore", ...SUPER_ADMIN })
  .inputSchema(restoreRulesSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await systemService.restoreRules({
      version: parsedInput.version,
      actorId: ctx.user.id,
    });
    revalidateAdmin();
    return { ok: true, audit };
  });

/* ============================================================
 *  AMBANG BIAYA & PEMANTAUAN — docs/10 §10.3, §10.7; docs/12 §12.8
 * ============================================================ */

export const adminSetDailyCostThreshold = authActionClient
  .metadata({ actionName: "admin.setting.cost_threshold", ...SUPER_ADMIN })
  .inputSchema(dailyCostThresholdSchema)
  .action(async ({ parsedInput, ctx }) => {
    const audit = await systemService.setDailyCostThreshold({
      valueIdr: parsedInput.valueIdr,
      actorId: ctx.user.id,
    });
    revalidateAdmin();
    return { ok: true, audit };
  });

export const adminSendSentryTest = authActionClient
  .metadata({ actionName: "admin.monitoring.sentry_test", ...SUPER_ADMIN })
  .action(async ({ ctx }) => {
    const { sent, ...audit } = await systemService.sendMonitoringTest({
      actorId: ctx.user.id,
    });
    return { ok: true, sent, audit };
  });
