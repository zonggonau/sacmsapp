import { createClient } from "v0-sdk";

import { logger } from "@/lib/logger";
import { mockEngine } from "@/lib/v0/mock";
import {
  V0Error,
  type CreateWorkspaceInput,
  type GenerateInput,
  type GenerateResult,
  type V0Engine,
  type V0FailureClass,
} from "@/lib/v0/types";

/**
 * Anti-corruption layer ke v0 — docs/02 §2.2, docs/09 §9.7.
 *
 * SATU-SATUNYA berkas di seluruh repositori yang boleh mengimpor `v0-sdk`.
 * Aturan itu ditegakkan lint (lihat eslint.config.mjs).
 *
 * Tugasnya tiga: memetakan tipe vendor ke kontrak SaCMS, menerjemahkan error
 * vendor menjadi V0Error berkelas, dan memilih antara mesin nyata dan tiruan.
 */

const USE_MOCK = process.env.V0_MOCK !== "false";

let client: ReturnType<typeof createClient> | null = null;

function getClient() {
  if (client) return client;

  const apiKey = process.env.V0_API_KEY;
  if (!apiKey) {
    throw new V0Error(
      "CONFIG",
      "V0_API_KEY belum diisi. Setel kunci API atau jalankan dengan V0_MOCK=true.",
    );
  }

  client = createClient({ apiKey });
  return client;
}

/* ============================================================
 *  Klasifikasi error — docs/09 §9.8
 * ============================================================ */

function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const e = error as Record<string, unknown>;

  for (const key of ["status", "statusCode"]) {
    const value = e[key];
    if (typeof value === "number") return value;
  }

  // Beberapa error membawa status di dalam `response`
  const response = e.response;
  if (typeof response === "object" && response !== null) {
    const status = (response as Record<string, unknown>).status;
    if (typeof status === "number") return status;
  }

  return undefined;
}

/**
 * Menentukan kelas kegagalan.
 *
 * Pemisahan ini menentukan perlakuan job: TRANSIENT diulang dengan backoff,
 * RATE_LIMIT dijadwalkan ulang tanpa memakai jatah percobaan, CONFIG gagal
 * segera dan memperingatkan Super Admin. Tanpa klasifikasi, kunci API yang
 * salah akan di-retry tiga kali tanpa guna dan menunda laporan masalahnya.
 */
export function classifyError(error: unknown): {
  failureClass: V0FailureClass;
  status: number | undefined;
  message: string;
} {
  const status = readStatus(error);
  const message = error instanceof Error ? error.message : String(error);

  if (status === 429) return { failureClass: "RATE_LIMIT", status, message };
  if (status === 401 || status === 403)
    return { failureClass: "CONFIG", status, message };
  if (status === 400 || status === 422)
    return { failureClass: "REJECTED", status, message };
  if (status !== undefined && status >= 500) {
    return { failureClass: "TRANSIENT", status, message };
  }

  // Tanpa status: tebak dari pesan. Timeout dan masalah jaringan bersifat
  // sementara dan layak diulang.
  if (
    /timeout|timed out|ETIMEDOUT|ECONNRESET|ENOTFOUND|fetch failed|network/i.test(
      message,
    )
  ) {
    return { failureClass: "TRANSIENT", status, message };
  }

  return { failureClass: "UNKNOWN", status, message };
}

function toV0Error(error: unknown): V0Error {
  if (error instanceof V0Error) return error;

  const { failureClass, status, message } = classifyError(error);
  return new V0Error(failureClass, message, { status, cause: error });
}

/* ============================================================
 *  Mesin nyata
 * ============================================================ */

/** Narrowing manual: respons sinkron membawa `id`, respons stream tidak. */
function asChatDetail(value: unknown): {
  id: string;
  text?: string;
  latestVersion?: {
    id: string;
    status: "pending" | "completed" | "failed";
    demoUrl?: string;
  };
} {
  if (typeof value !== "object" || value === null || !("id" in value)) {
    throw new V0Error(
      "EMPTY",
      "Respons v0 tidak berisi detail chat. Mode respons mungkin bukan 'sync'.",
    );
  }
  return value as ReturnType<typeof asChatDetail>;
}

const realEngine: V0Engine = {
  async createWorkspace(input: CreateWorkspaceInput): Promise<string> {
    try {
      const project = await getClient().projects.create({
        name: input.name,
        ...(input.description ? { description: input.description } : {}),
        instructions: input.instructions,
        privacy: "private",
      });
      return project.id;
    } catch (error) {
      throw toV0Error(error);
    }
  },

  async generate(input: GenerateInput): Promise<GenerateResult> {
    try {
      const v0 = getClient();

      const response = input.v0ChatId
        ? await v0.chats.sendMessage({
            chatId: input.v0ChatId,
            message: input.prompt,
            system: input.system,
            modelConfiguration: { modelId: input.model },
            responseMode: "sync",
          })
        : await v0.chats.create({
            message: input.prompt,
            system: input.system,
            projectId: input.v0ProjectId,
            modelConfiguration: { modelId: input.model },
            responseMode: "sync",
            chatPrivacy: "private",
          });

      const chat = asChatDetail(response);
      const version = chat.latestVersion;

      return {
        chatId: chat.id,
        versionId: version?.id ?? null,
        demoUrl: version?.demoUrl ?? null,
        assistantText: chat.text ?? "",
        versionStatus: version?.status ?? "pending",
      };
    } catch (error) {
      throw toV0Error(error);
    }
  },
};

/* ============================================================
 *  Pemilihan mesin
 * ============================================================ */

export const v0Engine: V0Engine = USE_MOCK ? mockEngine : realEngine;

export const isMockEngine = USE_MOCK;

if (USE_MOCK) {
  logger.warn("v0.mock_mode", {
    hint: "V0_MOCK aktif — tidak ada panggilan ke v0 dan tidak ada kredit terpakai.",
  });
}
