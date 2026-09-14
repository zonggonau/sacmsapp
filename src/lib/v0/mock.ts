import { logger } from "@/lib/logger";
import {
  V0Error,
  type CreateWorkspaceInput,
  type DeployInput,
  type DeployResult,
  type GenerateInput,
  type GenerateResult,
  type V0Engine,
  type V0FailureClass,
} from "@/lib/v0/types";

/**
 * Mesin AI tiruan — docs/09-AI-BUILDER-PIPELINE.md §9.7.
 *
 * Aktif saat V0_MOCK=true. Tujuannya bukan sekadar "supaya tidak error":
 * seluruh pipeline, UI progres, penanganan kegagalan, dan uji E2E bisa
 * dikembangkan dan dijalankan berulang kali TANPA membakar kredit AI dan tanpa
 * bergantung pada jaringan.
 *
 * Ini yang dikerjakan lebih dulu di Fase 3, sebelum integrasi nyata.
 */

/**
 * Pemicu kegagalan buatan.
 *
 * Menyertakan salah satu token ini di dalam prompt memaksa mesin tiruan gagal
 * dengan kelas tertentu. Tanpa ini, cabang penanganan kegagalan — retry,
 * backoff, refund kredit, pesan berbahasa Indonesia — tidak akan pernah
 * benar-benar diuji sampai kegagalan itu terjadi di production.
 */
const FAILURE_TRIGGERS: Array<{
  token: string;
  failure: V0FailureClass;
  message: string;
}> = [
  {
    token: "SIMULASI_GAGAL_SEMENTARA",
    failure: "TRANSIENT",
    message: "Mesin tiruan: kegagalan sementara",
  },
  {
    token: "SIMULASI_GAGAL_RATELIMIT",
    failure: "RATE_LIMIT",
    message: "Mesin tiruan: terlalu banyak permintaan",
  },
  {
    token: "SIMULASI_GAGAL_KONFIG",
    failure: "CONFIG",
    message: "Mesin tiruan: kunci API tidak berlaku",
  },
  {
    token: "SIMULASI_GAGAL_TOLAK",
    failure: "REJECTED",
    message: "Mesin tiruan: prompt ditolak",
  },
  {
    token: "SIMULASI_GAGAL_KOSONG",
    failure: "EMPTY",
    message: "Mesin tiruan: hasil kosong",
  },
];

/** Jeda singkat supaya UI progres terlihat bergerak seperti keadaan nyata. */
const STEP_DELAY_MS = Number(process.env.V0_MOCK_DELAY_MS ?? 600);

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function detectTrigger(prompt: string) {
  return FAILURE_TRIGGERS.find((t) => prompt.includes(t.token));
}

function randomId(prefix: string) {
  return `${prefix}_mock_${Math.random().toString(36).slice(2, 12)}`;
}

export const mockEngine: V0Engine = {
  async createWorkspace(input: CreateWorkspaceInput): Promise<string> {
    await delay(STEP_DELAY_MS / 2);
    const id = randomId("prj");
    logger.info("v0.mock.workspace_created", { workspaceId: id, name: input.name });
    return id;
  },

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const trigger = detectTrigger(input.prompt);

    if (trigger) {
      await delay(STEP_DELAY_MS / 2);
      logger.warn("v0.mock.simulated_failure", { failureClass: trigger.failure });
      throw new V0Error(trigger.failure, trigger.message);
    }

    // Generate nyata adalah langkah terlama; tiruan menahan lebih lama agar
    // bobot progres GENERATE benar-benar terasa dominan saat diuji.
    await delay(STEP_DELAY_MS * 3);

    const chatId = input.v0ChatId ?? randomId("chat");
    const versionId = randomId("ver");

    // Halaman pratinjau statis berisi ringkasan spesifikasi. Dilayani sebagai
    // data URI supaya tidak memerlukan jaringan sama sekali.
    const demoUrl = buildMockPreview(input);

    const isEdit = Boolean(input.v0ChatId);
    const assistantText = isEdit
      ? "Perubahan sudah diterapkan. Saya memperbarui komponen yang terkait dan menjaga struktur serta gaya yang sudah ada."
      : "Website sudah dibuat. Saya menyiapkan struktur halaman, komponen, dan konten contoh berbahasa Indonesia sesuai spesifikasi.";

    logger.info("v0.mock.generated", { chatId, versionId, isEdit });

    return {
      chatId,
      versionId,
      demoUrl,
      assistantText,
      versionStatus: "completed",
    };
  },

  async getVercelProjectId(v0ProjectId: string): Promise<string | null> {
    return `prj_mock_${v0ProjectId
      .replace(/[^a-z0-9]/gi, "")
      .slice(-12)
      .toLowerCase()}`;
  },

  /**
   * Deployment tiruan.
   *
   * Id-nya berbentuk id deployment Vercel tiruan yang MEMBAWA KEADAANNYA sendiri
   * (waktu dibuat + hasil akhir), sehingga mesin Vercel tiruan dapat menjawab
   * status secara konsisten dari proses mana pun — server Next, cron, atau skrip
   * uji — tanpa penyimpanan bersama.
   *
   * Versi yang v0VersionId-nya memuat SIMULASI_DEPLOY_GAGAL berakhir ERROR, supaya
   * jalur "deploy gagal, production lama tetap hidup" benar-benar teruji.
   */
  async deploy(input: DeployInput): Promise<DeployResult> {
    await delay(STEP_DELAY_MS / 2);
    const outcome = input.versionId.includes("SIMULASI_DEPLOY_GAGAL") ? "fail" : "ok";
    const id = `dpl_mock_${Date.now()}_${outcome}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info("v0.mock.deploy", { deploymentId: id, outcome });
    return { deploymentId: id, inspectorUrl: null };
  },
};

/**
 * Pratinjau tiruan sebagai data URI.
 *
 * Dipakai apa adanya oleh PreviewFrame, yang selalu memasang atribut `sandbox`.
 * Jadi jalur pratinjau — termasuk pengurungan iframe-nya — ikut teruji di mode
 * tiruan, bukan hanya di mode nyata.
 */
function buildMockPreview(input: GenerateInput): string {
  const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pratinjau Tiruan SaCMS</title>
<style>
  :root{color-scheme:dark}
  body{margin:0;background:#000;color:#fff;font:14px/1.6 system-ui,sans-serif;padding:32px}
  .wrap{max-width:640px;margin:0 auto}
  .tag{display:inline-block;background:#FF6B00;color:#000;font-weight:700;font-size:11px;
       letter-spacing:.08em;padding:4px 10px;border-radius:999px}
  h1{font-size:26px;margin:18px 0 8px;letter-spacing:-.02em}
  p{color:#A1A1A1;margin:0 0 22px}
  pre{background:#0A0A0A;border:1px solid #262626;border-radius:10px;padding:16px;
      font-size:12px;overflow:auto;color:#FFA274;white-space:pre-wrap}
</style></head>
<body><div class="wrap">
  <span class="tag">PRATINJAU TIRUAN</span>
  <h1>Mesin AI berjalan dalam mode tiruan</h1>
  <p>Halaman ini bukan hasil generate sungguhan. Ia membuktikan pipeline,
     progres, dan pengurungan iframe bekerja tanpa memakai kredit AI.
     Setel <code>V0_MOCK=false</code> untuk memakai v0 sungguhan.</p>
  <pre>${escapeHtml(JSON.stringify({ model: input.model, chat: input.v0ChatId ?? "(baru)" }, null, 2))}</pre>
</div></body></html>`;

  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
