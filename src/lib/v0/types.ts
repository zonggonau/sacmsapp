import type { V0Model } from "@/config/ai-models";

/**
 * Kontrak internal SaCMS ke mesin AI — docs/09-AI-BUILDER-PIPELINE.md §9.7.
 *
 * Tipe di berkas ini adalah MILIK KITA, bukan tipe vendor. Bila v0 mengganti
 * nama field, yang berubah hanya pemetaan di `client.ts`; seluruh service di
 * atasnya tidak ikut tersentuh.
 */

export interface GenerateInput {
  /** Ruang kerja v0. Wajib supaya semua chat satu project terkumpul. */
  v0ProjectId: string;
  /** Ada -> pesan lanjutan pada chat yang sama. Kosong -> chat baru. */
  v0ChatId?: string | undefined;
  /** Prompt pengguna, sudah disanitasi. */
  prompt: string;
  /** System prompt SaCMS. Tidak pernah dikirim ke klien. */
  system: string;
  model: V0Model;
}

export interface GenerateResult {
  chatId: string;
  versionId: string | null;
  demoUrl: string | null;
  /** Balasan AI. Diperlakukan sebagai konten tidak dipercaya (docs/02 §2.6). */
  assistantText: string;
  versionStatus: "pending" | "completed" | "failed";
}

export interface CreateWorkspaceInput {
  name: string;
  description?: string | undefined;
  instructions: string;
}

/**
 * Kelas kegagalan — docs/09 §9.8.
 *
 * Pemisahan ini yang menentukan apakah job diulang, dijadwalkan ulang, atau
 * langsung gagal. Tanpa klasifikasi, semua kegagalan diperlakukan sama dan
 * kesalahan konfigurasi (kunci API salah) akan di-retry tiga kali tanpa guna.
 */
export type V0FailureClass =
  | "TRANSIENT" // timeout, 5xx -> retry dengan backoff
  | "RATE_LIMIT" // 429 -> jadwalkan ulang, jangan pakai jatah attempt
  | "CONFIG" // 401/403 -> gagal segera, PERINGATKAN Super Admin
  | "REJECTED" // 400, prompt ditolak -> gagal, sarankan tulis ulang
  | "EMPTY" // sukses tapi tanpa versi/demo URL -> gagal, log lengkap
  | "UNKNOWN";

export class V0Error extends Error {
  readonly failureClass: V0FailureClass;
  readonly status: number | undefined;

  constructor(
    failureClass: V0FailureClass,
    message: string,
    options?: { status?: number; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "V0Error";
    this.failureClass = failureClass;
    this.status = options?.status;
  }
}

/**
 * Kontrak mesin AI.
 *
 * TIDAK ADA `stop()`. Dua alasan, keduanya nyata:
 *
 * 1. `chats.stop` milik v0 mensyaratkan `messageId` dari pesan yang sedang
 *    dihasilkan, dan kontrak kita tidak melacaknya.
 * 2. Generate dijalankan dengan `responseMode: "sync"`, yaitu satu panggilan
 *    yang kita tunggu. Saat pengguna menekan Batalkan, permintaan itu sudah
 *    berjalan; menghentikannya dari sisi kita tidak mengubah apa pun.
 *
 * Pembatalan karena itu bersifat LOKAL: job ditandai CANCELLED, langkah sisanya
 * dilewati, dan kredit pengguna dikembalikan. Konsekuensi yang perlu diketahui:
 * biaya vendor untuk panggilan yang sudah terkirim TIDAK kembali — SaCMS yang
 * menanggungnya. Itu keputusan sadar demi pengalaman pengguna, dan itulah
 * sebabnya `usage_event.vendorCostIdr` dicatat terpisah dari kredit pengguna
 * (docs/11 §11.8).
 */
export interface V0Engine {
  createWorkspace(input: CreateWorkspaceInput): Promise<string>;
  generate(input: GenerateInput): Promise<GenerateResult>;
}
