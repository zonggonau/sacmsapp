import { NextResponse } from "next/server";

import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { verifyWebhookSignature } from "@/lib/vercel/webhook";
import { syncFromWebhook } from "@/services/deploy.service";

/**
 * Webhook Vercel — docs/12 ancaman A7, ADR-008.
 *
 * Dua aturan:
 * 1. Tanda tangan wajib valid. Tanpa VERCEL_WEBHOOK_SECRET semua ditolak.
 * 2. Isi payload TIDAK dipercaya sebagai status. Ia hanya memberi tahu deployment
 *    mana yang perlu diperiksa; statusnya dibaca ulang dari API Vercel. Dengan
 *    begitu secret yang bocor pun tidak bisa dipakai memalsukan "website live".
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  if (
    !verifyWebhookSignature(
      rawBody,
      req.headers.get("x-vercel-signature"),
      env.VERCEL_WEBHOOK_SECRET,
    )
  ) {
    logger.warn("webhook.vercel.invalid_signature");
    return new Response("Tanda tangan tidak valid", { status: 401 });
  }

  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response("Payload bukan JSON", { status: 400 });
  }

  const type = readString(event, ["type"]);
  if (!type?.startsWith("deployment.")) {
    return NextResponse.json({ received: true });
  }

  const vercelDeploymentId = readString(event, ["payload", "deployment", "id"]);
  const vercelProjectId = readString(event, ["payload", "project", "id"]);

  try {
    const known = await syncFromWebhook({ vercelDeploymentId, vercelProjectId });
    logger.info("webhook.vercel.received", { type, vercelDeploymentId, known });
  } catch (error) {
    logger.error("webhook.vercel.failed", {
      type,
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    // 500 supaya Vercel mengirim ulang.
    return NextResponse.json({ received: false }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function readString(value: unknown, path: string[]): string | null {
  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) return null;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : null;
}
