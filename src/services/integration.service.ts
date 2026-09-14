import { env } from "@/lib/env";
import { isMockEngine } from "@/lib/v0/client";
import { vercelClient } from "@/lib/vercel/client";

/**
 * Status konfigurasi integrasi untuk /admin/sistem — docs/10 §10.8.
 *
 * Hanya MEMERIKSA apakah terkonfigurasi dan mode apa yang aktif. Nilai rahasia
 * tidak pernah dibaca ke UI. Uji koneksi langsung ke vendor dicatat di BACKLOG.
 */

export type IntegrationState = "nyata" | "tiruan" | "belum diatur";

export interface IntegrationStatus {
  name: string;
  purpose: string;
  state: IntegrationState;
  note: string | null;
}

export function getIntegrationStatus(): IntegrationStatus[] {
  return [
    {
      name: "v0",
      purpose: "Mesin AI pembuat website",
      state: isMockEngine ? "tiruan" : env.V0_API_KEY ? "nyata" : "belum diatur",
      note: isMockEngine ? "V0_MOCK=true — tidak ada kredit AI yang terpakai." : null,
    },
    {
      name: "Vercel",
      purpose: "Status deployment & custom domain",
      state: vercelClient.isMock
        ? "tiruan"
        : env.VERCEL_TOKEN
          ? "nyata"
          : "belum diatur",
      note: vercelClient.isMock
        ? "Tidak ada website yang benar-benar diterbitkan."
        : null,
    },
    {
      name: "Webhook Vercel",
      purpose: "Pembaruan status deployment instan",
      state: env.VERCEL_WEBHOOK_SECRET ? "nyata" : "belum diatur",
      note: env.VERCEL_WEBHOOK_SECRET
        ? null
        : "Semua webhook ditolak; status tetap diperbarui lewat polling & cron.",
    },
    {
      name: "Resend",
      purpose: "Email transaksional",
      state: env.RESEND_API_KEY ? "nyata" : "belum diatur",
      note: env.RESEND_API_KEY ? null : "Email hanya dicatat ke log.",
    },
    {
      name: "Upstash Redis",
      purpose: "Rate limit lintas instance",
      state:
        env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
          ? "nyata"
          : "belum diatur",
      note:
        env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
          ? null
          : "Penghitung dalam memori — hanya layak untuk development.",
    },
    {
      name: "Cron",
      purpose: "Penyapu job, sinkron deployment, verifikasi domain",
      state: env.CRON_SECRET ? "nyata" : "belum diatur",
      note: env.CRON_SECRET
        ? null
        : "Endpoint cron menolak semua panggilan tanpa CRON_SECRET.",
    },
  ];
}
