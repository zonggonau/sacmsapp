/**
 * Error terkendali SaCMS.
 *
 * Aturan (docs/08-SERVER-ACTIONS.md §8.4):
 * - Setiap kegagalan yang bisa diantisipasi dilempar sebagai AppError.
 * - userMessage SELALU bahasa Indonesia dan boleh dilihat pengguna.
 * - Kode HTTP, nama tabel, dan stack trace TIDAK PERNAH sampai ke layar pengguna.
 */

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "RATE_LIMITED"
  | "QUOTA_EXCEEDED"
  | "AI_UNAVAILABLE"
  | "AI_TIMEOUT"
  | "DEPLOY_FAILED"
  | "DOMAIN_INVALID"
  | "SUSPENDED"
  | "MAINTENANCE"
  | "KILL_SWITCH"
  | "CONFLICT"
  | "INTERNAL";

export interface ErrorAction {
  label: string;
  href: string;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly action: ErrorAction | undefined;

  constructor(
    code: ErrorCode,
    userMessage: string,
    options?: { action?: ErrorAction; cause?: unknown },
  ) {
    super(userMessage, options?.cause ? { cause: options.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.userMessage = userMessage;
    this.action = options?.action;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Pesan baku per kode. Satu tempat, supaya kalimat yang sama tidak ditulis
 * berbeda-beda di banyak berkas.
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  UNAUTHORIZED: "Sesi Anda berakhir. Silakan masuk lagi.",
  FORBIDDEN: "Anda tidak punya akses ke tindakan ini.",
  NOT_FOUND: "Data yang Anda cari tidak ditemukan.",
  VALIDATION: "Ada isian yang belum benar. Periksa kembali formulir Anda.",
  RATE_LIMITED: "Terlalu banyak permintaan. Coba lagi sebentar.",
  QUOTA_EXCEEDED: "Kuota bulanan Anda sudah habis.",
  AI_UNAVAILABLE: "Layanan AI sedang sibuk. Coba beberapa saat lagi.",
  AI_TIMEOUT: "Pembuatan website memakan waktu terlalu lama dan dihentikan.",
  DEPLOY_FAILED: "Penerbitan gagal. Website Anda yang sekarang tidak berubah.",
  DOMAIN_INVALID: "Domain tidak valid atau sudah dipakai project lain.",
  SUSPENDED: "Akun Anda ditangguhkan. Hubungi dukungan.",
  MAINTENANCE: "Sistem sedang dalam pemeliharaan. Coba lagi nanti.",
  KILL_SWITCH: "Pembuatan website sementara dinonaktifkan untuk pemeliharaan.",
  CONFLICT: "Data sudah berubah. Muat ulang halaman lalu coba lagi.",
  INTERNAL: "Terjadi kesalahan. Tim kami sudah diberi tahu.",
};

/** Pintasan: AppError dengan pesan baku untuk kode tersebut. */
export function appError(code: ErrorCode, action?: ErrorAction) {
  return new AppError(code, ERROR_MESSAGES[code], action ? { action } : undefined);
}
