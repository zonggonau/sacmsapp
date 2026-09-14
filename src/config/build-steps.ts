import type { BuildJobKind } from "@/types/db";

/**
 * Sepuluh langkah build — docs/09-AI-BUILDER-PIPELINE.md §9.3.
 *
 * Urutan dan label TIDAK boleh diubah tanpa memperbarui dokumen itu. Label
 * inilah yang dibaca pengguna awam saat menunggu, jadi ia bagian dari produk,
 * bukan detail teknis.
 */

export interface BuildStepConfig {
  key: string;
  label: string;
  order: number;
  /**
   * Bobot progres, total 100.
   *
   * Progres dihitung dari bobot dan BUKAN dari selesai/total. Kalau memakai
   * selesai/total, bar akan macet lama di 40% selama langkah GENERATE berjalan
   * — yang justru langkah terlama dan paling membuat cemas.
   */
  weight: number;
}

export const BUILD_STEPS: BuildStepConfig[] = [
  { key: "UNDERSTAND", label: "Memahami kebutuhan Anda", order: 1, weight: 3 },
  { key: "PLAN", label: "Menyusun rencana halaman", order: 2, weight: 5 },
  { key: "PROVISION", label: "Menyiapkan ruang kerja", order: 3, weight: 5 },
  { key: "COMPOSE", label: "Menyiapkan instruksi untuk AI", order: 4, weight: 2 },
  { key: "GENERATE", label: "Membuat halaman dan komponen", order: 5, weight: 45 },
  { key: "VALIDATE", label: "Memeriksa hasil", order: 6, weight: 5 },
  { key: "PERSIST", label: "Menyimpan versi", order: 7, weight: 3 },
  { key: "PREVIEW", label: "Menyiapkan pratinjau", order: 8, weight: 5 },
  { key: "DEPLOY", label: "Menerbitkan ke internet", order: 9, weight: 22 },
  { key: "FINALIZE", label: "Merapikan", order: 10, weight: 5 },
];

export type BuildStepKey = (typeof BUILD_STEPS)[number]["key"];

const TOTAL_WEIGHT = BUILD_STEPS.reduce((sum, s) => sum + s.weight, 0);

export function getStepConfig(key: string): BuildStepConfig | undefined {
  return BUILD_STEPS.find((s) => s.key === key);
}

/**
 * Langkah yang dilewati per jenis job — docs/09 §9.3.
 * - EDIT_GENERATE: ruang kerja v0 sudah ada, PROVISION dilewati
 * - DEPLOY: tidak ada generate sama sekali
 */
export function stepsForKind(kind: BuildJobKind): BuildStepConfig[] {
  if (kind === "DEPLOY") {
    return BUILD_STEPS.filter((s) => s.key === "DEPLOY" || s.key === "FINALIZE");
  }
  return BUILD_STEPS;
}

/** Progres 0–100 dari daftar key langkah yang sudah selesai. */
export function progressFromDone(doneKeys: string[]): number {
  const done = BUILD_STEPS.filter((s) => doneKeys.includes(s.key));
  const sum = done.reduce((acc, s) => acc + s.weight, 0);
  return Math.min(100, Math.round((sum / TOTAL_WEIGHT) * 100));
}
