import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

/**
 * Pengaturan sistem global — docs/10-SUPER-ADMIN.md §10.7.
 *
 * Nilainya hidup di tabel SystemSetting, bukan di environment variable, supaya
 * Super Admin bisa mengubahnya dari panel TANPA deploy ulang. Itu syarat mutlak
 * untuk kill switch: saat biaya AI melonjak, menunggu deploy bukan pilihan.
 */

export const SETTING_KEYS = {
  aiKillSwitch: "ai.killSwitch",
  aiDefaultModel: "ai.defaultModel",
  aiDailyCostThreshold: "ai.dailyCostThresholdIdr",
  maintenance: "system.maintenance",
  signupEnabled: "signup.enabled",
} as const;

async function readSetting<T>(key: string, fallback: T): Promise<T> {
  try {
    const row = await db.systemSetting.findUnique({
      where: { key },
      select: { value: true },
    });
    if (!row) return fallback;
    return row.value as T;
  } catch (error) {
    // Database bermasalah tidak boleh membuat kill switch "menyala" diam-diam
    // dan memblokir seluruh pengguna. Kita pakai nilai baku dan mencatatnya.
    logger.error("system.setting_read_failed", {
      key,
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return fallback;
  }
}

/** true = seluruh permintaan generate baru ditolak. */
export async function isKillSwitchOn(): Promise<boolean> {
  return readSetting<boolean>(SETTING_KEYS.aiKillSwitch, false);
}

export async function isMaintenanceMode(): Promise<boolean> {
  return readSetting<boolean>(SETTING_KEYS.maintenance, false);
}

export async function isSignupEnabled(): Promise<boolean> {
  return readSetting<boolean>(SETTING_KEYS.signupEnabled, true);
}

export async function getDefaultModel(): Promise<string | null> {
  return readSetting<string | null>(SETTING_KEYS.aiDefaultModel, null);
}
