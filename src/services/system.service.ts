import { isV0Model, type V0Model } from "@/config/ai-models";
import { SETTING_KEYS, TOGGLE_KEYS, type ToggleKey } from "@/config/settings";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { DEFAULT_RULES, rulesContainDelimiter } from "@/lib/v0/system-prompt";
import type { AuditTrail } from "@/services/audit.service";

/**
 * Pengaturan sistem global — docs/10-SUPER-ADMIN.md §10.7–10.8.
 *
 * Nilainya hidup di tabel SystemSetting, bukan di environment variable, supaya
 * Super Admin bisa mengubahnya dari panel TANPA deploy ulang. Itu syarat mutlak
 * untuk kill switch: saat biaya AI melonjak, menunggu deploy bukan pilihan.
 */

export { SETTING_KEYS, TOGGLE_KEYS };
export type { ToggleKey };

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

export interface SettingsSnapshot {
  killSwitch: boolean;
  maintenance: boolean;
  signupEnabled: boolean;
  defaultModel: string | null;
}

export async function getSettings(): Promise<SettingsSnapshot> {
  const [killSwitch, maintenance, signupEnabled, defaultModel] = await Promise.all([
    isKillSwitchOn(),
    isMaintenanceMode(),
    isSignupEnabled(),
    getDefaultModel(),
  ]);
  return { killSwitch, maintenance, signupEnabled, defaultModel };
}

/* ============================================================
 *  TULIS — hanya dipanggil action admin
 * ============================================================ */

async function writeSetting(key: string, value: unknown, actorId: string) {
  const json = JSON.parse(JSON.stringify(value));
  await db.systemSetting.upsert({
    where: { key },
    update: { value: json, updatedById: actorId },
    create: { key, value: json, updatedById: actorId },
  });
}

export async function setToggle(input: {
  key: ToggleKey;
  value: boolean;
  actorId: string;
}): Promise<AuditTrail> {
  const fallback = input.key === SETTING_KEYS.signupEnabled;
  const before = await readSetting<boolean>(input.key, fallback);

  await writeSetting(input.key, input.value, input.actorId);
  logger.warn("system.toggle_changed", { key: input.key, before, after: input.value });

  return {
    targetType: "SystemSetting",
    targetId: input.key,
    before: { value: before },
    after: { value: input.value },
  };
}

export async function setDefaultModel(input: {
  model: V0Model;
  actorId: string;
}): Promise<AuditTrail> {
  if (!isV0Model(input.model)) {
    throw new AppError("VALIDATION", "Model tidak dikenal.");
  }
  const before = await getDefaultModel();
  await writeSetting(SETTING_KEYS.aiDefaultModel, input.model, input.actorId);

  return {
    targetType: "SystemSetting",
    targetId: SETTING_KEYS.aiDefaultModel,
    before: { value: before },
    after: { value: input.model },
  };
}

/* ============================================================
 *  ATURAN SYSTEM PROMPT — berversi, append-only
 * ============================================================ */

/** Riwayat disimpan dalam satu baris SystemSetting. Versi lama tidak pernah diubah. */
const MAX_RULE_VERSIONS = 30;

export interface RuleVersion {
  version: number;
  text: string;
  createdAt: string;
  createdById: string | null;
  /** Versi asal bila entri ini hasil "kembalikan". */
  restoredFrom: number | null;
}

function isRuleVersion(value: unknown): value is RuleVersion {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.version === "number" && typeof v.text === "string";
}

export async function getRuleVersions(): Promise<RuleVersion[]> {
  const stored = await readSetting<{ versions?: unknown }>(
    SETTING_KEYS.aiSystemPromptRules,
    {},
  );
  const versions = Array.isArray(stored.versions)
    ? stored.versions.filter(isRuleVersion)
    : [];

  if (versions.length > 0) return versions;

  // Belum pernah diubah: versi 1 = aturan bawaan di kode.
  return [
    {
      version: 1,
      text: DEFAULT_RULES,
      createdAt: new Date(0).toISOString(),
      createdById: null,
      restoredFrom: null,
    },
  ];
}

/** Aturan aktif yang dipakai build. */
export async function getSystemPromptRules(): Promise<string> {
  const versions = await getRuleVersions();
  const latest = versions[versions.length - 1];
  return latest && !rulesContainDelimiter(latest.text) ? latest.text : DEFAULT_RULES;
}

function validateRules(text: string) {
  const trimmed = text.trim();
  if (trimmed.length < 40) {
    throw new AppError("VALIDATION", "Aturan terlalu pendek. Minimal 40 karakter.");
  }
  if (trimmed.length > 8000) {
    throw new AppError(
      "VALIDATION",
      "Aturan terlalu panjang. Maksimal 8.000 karakter.",
    );
  }
  if (rulesContainDelimiter(trimmed)) {
    throw new AppError(
      "VALIDATION",
      "Aturan tidak boleh memuat penanda PERMINTAAN_PENGGUNA — itu pembatas pengaman prompt pengguna.",
    );
  }
  return trimmed;
}

async function appendRuleVersion(
  text: string,
  actorId: string,
  restoredFrom: number | null,
): Promise<AuditTrail> {
  return db.$transaction(async (tx) => {
    // Kunci baris supaya dua admin yang menyimpan bersamaan tidak menghasilkan
    // nomor versi yang sama.
    await tx.$queryRaw`SELECT key FROM "system_setting" WHERE key = ${SETTING_KEYS.aiSystemPromptRules} FOR UPDATE`;

    const versions = await getRuleVersions();
    const latest = versions[versions.length - 1]!;

    if (latest.text === text) {
      throw new AppError("CONFLICT", "Tidak ada perubahan dibanding versi aktif.");
    }

    const next: RuleVersion = {
      version: latest.version + 1,
      text,
      createdAt: new Date().toISOString(),
      createdById: actorId,
      restoredFrom,
    };
    const kept = [...versions, next].slice(-MAX_RULE_VERSIONS);

    const value = JSON.parse(JSON.stringify({ versions: kept }));
    await tx.systemSetting.upsert({
      where: { key: SETTING_KEYS.aiSystemPromptRules },
      update: { value, updatedById: actorId },
      create: {
        key: SETTING_KEYS.aiSystemPromptRules,
        value,
        updatedById: actorId,
        description: "Riwayat berversi blok ATURAN system prompt.",
      },
    });

    logger.warn("system.prompt_rules_changed", { version: next.version, restoredFrom });

    return {
      targetType: "SystemSetting",
      targetId: SETTING_KEYS.aiSystemPromptRules,
      before: { version: latest.version, text: latest.text },
      after: { version: next.version, text: next.text, restoredFrom },
    };
  });
}

export async function saveRules(input: {
  text: string;
  actorId: string;
}): Promise<AuditTrail> {
  return appendRuleVersion(validateRules(input.text), input.actorId, null);
}

export async function restoreRules(input: {
  version: number;
  actorId: string;
}): Promise<AuditTrail> {
  const versions = await getRuleVersions();
  const target = versions.find((v) => v.version === input.version);
  if (!target) throw new AppError("NOT_FOUND", "Versi aturan tidak ditemukan.");

  return appendRuleVersion(validateRules(target.text), input.actorId, target.version);
}
