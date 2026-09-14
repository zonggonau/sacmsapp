import { splitDomain } from "@/lib/dns-records";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { isMockEngine } from "@/lib/v0/client";

/**
 * Anti-corruption layer ke Vercel REST API — docs/02 §2.2, docs/09 §9.10, ADR-008.
 *
 * Membangun & menerbitkan dikerjakan v0 (`lib/v0`). Berkas ini hanya:
 * - MEMBACA status deployment dan alamat production,
 * - mengelola custom domain pada project Vercel yang dibuat v0,
 * - memverifikasi tanda tangan webhook.
 *
 * Seluruh bentuk respons di bawah diverifikasi terhadap API sungguhan pada
 * 2026-09-15, bukan disalin dari ingatan. Dua temuan yang membentuk desain:
 *
 * 1. URL deployment (`<nama>-<hash>-<tim>.vercel.app`) DILINDUNGI login Vercel
 *    pada project buatan v0 (302 ke SSO). Alias production `<nama>.vercel.app`
 *    TERBUKA untuk publik (200). Karena itu alamat yang diberikan ke pengguna
 *    selalu alias production, tidak pernah URL deployment.
 * 2. Rekaman DNS yang dianjurkan Vercel berubah dari waktu ke waktu
 *    (`216.198.79.1` kini peringkat 1, `76.76.21.21` peringkat 2). Nilainya
 *    diambil dari API, bukan ditanam di kode.
 */

export type VercelReadyState =
  "QUEUED" | "INITIALIZING" | "BUILDING" | "READY" | "ERROR" | "CANCELED";

export interface VercelDeployment {
  id: string;
  /** Nama host tanpa skema. */
  url: string;
  readyState: VercelReadyState;
  target: string | null;
  createdAt: number;
}

export interface VercelVerificationChallenge {
  type: string;
  domain: string;
  value: string;
}

export interface VercelProjectDomain {
  name: string;
  apexName: string;
  verified: boolean;
  verification: VercelVerificationChallenge[];
}

export interface VercelDomainConfig {
  misconfigured: boolean;
  recommendedIPv4: string | null;
  recommendedCNAME: string | null;
}

/** Error dari API Vercel. Service yang menerjemahkannya menjadi pesan pengguna. */
export class VercelApiError extends Error {
  readonly status: number;
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "VercelApiError";
    this.status = status;
    this.code = code;
  }
}

export interface VercelClient {
  readonly isMock: boolean;
  /** null bila deployment tidak ditemukan. */
  getDeployment(deploymentId: string): Promise<VercelDeployment | null>;
  /** Deployment production sebuah project yang dibuat sejak `sinceMs`, terbaru dulu. */
  listProductionDeployments(
    projectId: string,
    sinceMs: number,
  ): Promise<VercelDeployment[]>;
  /** Alias production publik, mis. `portal-berita.vercel.app`. */
  getProductionHost(projectId: string): Promise<string | null>;
  addDomain(projectId: string, domain: string): Promise<VercelProjectDomain>;
  /** null bila domain tidak (lagi) terpasang di project. */
  getDomain(projectId: string, domain: string): Promise<VercelProjectDomain | null>;
  /** Meminta Vercel memeriksa tantangan TXT. Tidak melempar bila belum lolos. */
  verifyDomain(projectId: string, domain: string): Promise<VercelProjectDomain>;
  getDomainConfig(domain: string): Promise<VercelDomainConfig>;
  /** Tidak melempar bila domain memang sudah tidak ada. */
  removeDomain(projectId: string, domain: string): Promise<void>;
  /** Sertifikat HTTPS sudah terbit dan domain menjawab. */
  checkHttps(domain: string): Promise<boolean>;
}

/* ============================================================
 *  MESIN NYATA
 * ============================================================ */

const API = "https://api.vercel.com";

async function vercelFetch<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.VERCEL_TOKEN) {
    throw new VercelApiError(0, "config", "VERCEL_TOKEN belum diisi.");
  }

  const url = new URL(`${API}${path}`);
  if (env.VERCEL_TEAM_ID) url.searchParams.set("teamId", env.VERCEL_TEAM_ID);

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.VERCEL_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    signal: init?.signal ?? AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  const data: unknown = text ? safeJson(text) : null;

  if (!res.ok) {
    const error = isRecord(data) && isRecord(data.error) ? data.error : null;
    throw new VercelApiError(
      res.status,
      typeof error?.code === "string" ? error.code : null,
      typeof error?.message === "string" ? error.message : `Vercel API ${res.status}`,
    );
  }

  return data as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNotFound(error: unknown) {
  return error instanceof VercelApiError && error.status === 404;
}

interface RawDeployment {
  id?: string;
  uid?: string;
  url: string;
  readyState?: VercelReadyState;
  state?: VercelReadyState;
  target?: string | null;
  createdAt?: number;
  created?: number;
}

function mapDeployment(raw: RawDeployment): VercelDeployment {
  return {
    id: raw.id ?? raw.uid ?? "",
    url: raw.url,
    readyState: raw.readyState ?? raw.state ?? "QUEUED",
    target: raw.target ?? null,
    createdAt: raw.createdAt ?? raw.created ?? 0,
  };
}

interface RawProjectDomain {
  name: string;
  apexName: string;
  verified: boolean;
  redirect?: string | null;
  verification?: VercelVerificationChallenge[];
}

function mapDomain(raw: RawProjectDomain): VercelProjectDomain {
  return {
    name: raw.name,
    apexName: raw.apexName,
    verified: Boolean(raw.verified),
    verification: raw.verification ?? [],
  };
}

const enc = encodeURIComponent;

const realClient: VercelClient = {
  isMock: false,

  async getDeployment(deploymentId) {
    try {
      return mapDeployment(
        await vercelFetch<RawDeployment>(`/v13/deployments/${enc(deploymentId)}`),
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  async listProductionDeployments(projectId, sinceMs) {
    const res = await vercelFetch<{ deployments: RawDeployment[] }>(
      `/v6/deployments?projectId=${enc(projectId)}&target=production&since=${sinceMs}&limit=10`,
    );
    return res.deployments.map(mapDeployment).sort((a, b) => b.createdAt - a.createdAt);
  },

  async getProductionHost(projectId) {
    const res = await vercelFetch<{ domains: RawProjectDomain[] }>(
      `/v9/projects/${enc(projectId)}/domains`,
    );
    // Alias bawaan: domain vercel.app tanpa pengalihan. Custom domain pengguna
    // tidak dipakai di sini — itu bisa belum aktif.
    const alias = res.domains.find((d) => d.apexName === "vercel.app" && !d.redirect);
    return alias?.name ?? null;
  },

  async addDomain(projectId, domain) {
    return mapDomain(
      await vercelFetch<RawProjectDomain>(`/v10/projects/${enc(projectId)}/domains`, {
        method: "POST",
        body: JSON.stringify({ name: domain }),
      }),
    );
  },

  async getDomain(projectId, domain) {
    try {
      return mapDomain(
        await vercelFetch<RawProjectDomain>(
          `/v9/projects/${enc(projectId)}/domains/${enc(domain)}`,
        ),
      );
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  },

  async verifyDomain(projectId, domain) {
    try {
      return mapDomain(
        await vercelFetch<RawProjectDomain>(
          `/v9/projects/${enc(projectId)}/domains/${enc(domain)}/verify`,
          { method: "POST" },
        ),
      );
    } catch (error) {
      // 400 = tantangan belum terpenuhi. Itu keadaan normal, bukan kegagalan.
      if (error instanceof VercelApiError && error.status === 400) {
        const current = await realClient.getDomain(projectId, domain);
        if (current) return current;
      }
      throw error;
    }
  },

  async getDomainConfig(domain) {
    const res = await vercelFetch<{
      misconfigured: boolean;
      recommendedIPv4?: Array<{ rank: number; value: string[] }>;
      recommendedCNAME?: Array<{ rank: number; value: string }>;
    }>(`/v6/domains/${enc(domain)}/config`);

    const ipv4 = [...(res.recommendedIPv4 ?? [])].sort((a, b) => a.rank - b.rank)[0];
    const cname = [...(res.recommendedCNAME ?? [])].sort((a, b) => a.rank - b.rank)[0];

    return {
      misconfigured: Boolean(res.misconfigured),
      recommendedIPv4: ipv4?.value[0] ?? null,
      recommendedCNAME: cname?.value.replace(/\.$/, "") ?? null,
    };
  },

  async removeDomain(projectId, domain) {
    try {
      await vercelFetch(`/v9/projects/${enc(projectId)}/domains/${enc(domain)}`, {
        method: "DELETE",
      });
    } catch (error) {
      if (isNotFound(error)) return;
      throw error;
    }
  },

  async checkHttps(domain) {
    try {
      await fetch(`https://${domain}`, {
        method: "HEAD",
        redirect: "manual",
        signal: AbortSignal.timeout(8_000),
      });
      // Status apa pun berarti jabat tangan TLS berhasil — sertifikat sudah ada.
      return true;
    } catch {
      return false;
    }
  },
};

/* ============================================================
 *  MESIN TIRUAN
 * ============================================================ */

/**
 * Berapa lama deployment tiruan "membangun" sebelum selesai. Cukup lama agar UI
 * progres terlihat, cukup singkat agar uji tidak lambat.
 */
const MOCK_BUILD_MS = Number(process.env.VERCEL_MOCK_BUILD_MS ?? 6000);

/**
 * Host tiruan memakai TLD `.invalid` (RFC 2606) — dijamin tidak pernah ada di
 * internet. Versi sebelumnya mengarang `https://<slug>.vercel.app`, alamat nyata
 * yang bisa saja milik orang lain, dan menyimpannya sebagai "website live".
 */
function mockHost(projectId: string) {
  return `${projectId.replace(/^prj_mock_/, "")}.tiruan.invalid`;
}

const mockClient: VercelClient = {
  isMock: true,

  async getDeployment(deploymentId) {
    // Format dari mesin v0 tiruan: dpl_mock_<ms>_<ok|fail>_<acak>
    const match = /^dpl_mock_(\d+)_(ok|fail)_/.exec(deploymentId);
    if (!match) return null;

    const createdAt = Number(match[1]);
    const done = Date.now() - createdAt >= MOCK_BUILD_MS;

    return {
      id: deploymentId,
      url: `${deploymentId.replace(/_/g, "-")}.tiruan.invalid`,
      readyState: done ? (match[2] === "ok" ? "READY" : "ERROR") : "BUILDING",
      target: "production",
      createdAt,
    };
  },

  async listProductionDeployments() {
    return [];
  },

  async getProductionHost(projectId) {
    return mockHost(projectId);
  },

  /**
   * Pemicu uji di nama domain:
   * - memuat `simulasi-txt`       -> butuh verifikasi TXT
   * - memuat `simulasi-dns-belum` -> rekaman DNS belum terpasang
   * - memuat `simulasi-https`     -> DNS benar, sertifikat belum terbit
   */
  async addDomain(_projectId, domain) {
    const needsTxt = domain.includes("simulasi-txt");
    logger.info("vercel.mock.add_domain", { domain });
    return {
      name: domain,
      apexName: splitDomain(domain).apex,
      verified: !needsTxt,
      verification: needsTxt
        ? [
            {
              type: "TXT",
              domain: `_vercel.${domain}`,
              value: "vc-domain-verify=tiruan",
            },
          ]
        : [],
    };
  },

  async getDomain(projectId, domain) {
    return mockClient.addDomain(projectId, domain);
  },

  async verifyDomain(projectId, domain) {
    return mockClient.addDomain(projectId, domain);
  },

  async getDomainConfig(domain) {
    return {
      misconfigured: domain.includes("simulasi-dns-belum"),
      recommendedIPv4: "216.198.79.1",
      recommendedCNAME: "cname.vercel-dns.com",
    };
  },

  async removeDomain(_projectId, domain) {
    logger.info("vercel.mock.remove_domain", { domain });
  },

  async checkHttps(domain) {
    return !domain.includes("simulasi-https");
  },
};

/* ============================================================
 *  PEMILIHAN MESIN
 * ============================================================ */

/**
 * Mesin v0 tiruan menghasilkan project dan deployment tiruan yang tidak dikenal
 * Vercel sungguhan, jadi keduanya WAJIB tiruan bersamaan. Mode development TIDAK
 * lagi memaksa tiruan — itulah yang dulu membuat "deploy sukses" palsu tercatat
 * tanpa ada yang sadar.
 */
const USE_MOCK = env.VERCEL_MOCK || isMockEngine;

export const vercelClient: VercelClient = USE_MOCK ? mockClient : realClient;

if (USE_MOCK) {
  logger.warn("vercel.mock_mode", {
    hint: "Vercel tiruan aktif — tidak ada website yang benar-benar diterbitkan.",
    reason: env.VERCEL_MOCK ? "VERCEL_MOCK=true" : "V0_MOCK=true",
  });
}
