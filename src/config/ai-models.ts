/**
 * Model v0 yang tersedia.
 *
 * KOREKSI PENTING: dokumen perancangan awal menyebut `v0-1.5-sm`, dan nilai itu
 * TIDAK ADA. Daftar di bawah diverifikasi langsung dari tipe `ChatsCreateRequest`
 * pada v0-sdk 0.16.7 — mengirim id model yang tidak dikenal akan ditolak API.
 *
 * Satu-satunya sumber kebenaran id model di seluruh basis kode. Seed, paket, dan
 * pemilihan model saat build semuanya membaca dari sini.
 */

export const V0_MODELS = [
  "v0-mini",
  "v0-auto",
  "v0-pro",
  "v0-max",
  "v0-max-fast",
] as const;

export type V0Model = (typeof V0_MODELS)[number];

/**
 * Model yang dipakai SEMUA build — ADR-011: sama dengan pilihan "Auto" di v0.app,
 * supaya hasil SaCMS identik dengan v0.app. Daftar model per paket tidak lagi
 * menentukan model build.
 */
export const V0_APP_MODEL: V0Model = "v0-auto";

/** Default paling murah — dipakai bila paket atau env tidak menentukan. */
export const DEFAULT_V0_MODEL: V0Model = "v0-mini";

/** Model yang diizinkan per paket. Nilai ini ditulis ke tabel Plan oleh seed. */
export const PLAN_MODELS: Record<string, V0Model[]> = {
  free: ["v0-mini"],
  pro: ["v0-mini", "v0-auto", "v0-pro"],
  business: ["v0-mini", "v0-auto", "v0-pro", "v0-max", "v0-max-fast"],
};

export function isV0Model(value: string): value is V0Model {
  return (V0_MODELS as readonly string[]).includes(value);
}

/**
 * Memilih model yang dipakai untuk sebuah build.
 *
 * Urutan: model yang diminta (bila diizinkan paket) -> model pertama yang
 * diizinkan paket -> default. Tidak pernah mengembalikan id yang tidak valid,
 * karena itu berarti build gagal di panggilan pertama.
 */
export function resolveModel(
  allowedModels: string[],
  requested?: string | null,
): V0Model {
  const allowed = allowedModels.filter(isV0Model);

  if (requested && isV0Model(requested) && allowed.includes(requested)) {
    return requested;
  }

  return allowed[0] ?? DEFAULT_V0_MODEL;
}
