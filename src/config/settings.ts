/**
 * Kunci pengaturan sistem (tabel SystemSetting) — docs/10 §10.7–10.8.
 *
 * Berkas murni tanpa I/O supaya bisa diimpor skema validasi maupun service.
 */
export const SETTING_KEYS = {
  aiKillSwitch: "ai.killSwitch",
  aiDefaultModel: "ai.defaultModel",
  aiDailyCostThreshold: "ai.dailyCostThresholdIdr",
  aiSystemPromptRules: "ai.systemPromptRules",
  maintenance: "system.maintenance",
  signupEnabled: "signup.enabled",
} as const;

/** Sakelar yang boleh diubah lewat satu aksi generik. */
export const TOGGLE_KEYS = [
  SETTING_KEYS.aiKillSwitch,
  SETTING_KEYS.maintenance,
  SETTING_KEYS.signupEnabled,
] as const;

export type ToggleKey = (typeof TOGGLE_KEYS)[number];
