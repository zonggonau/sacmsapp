import * as Sentry from "@sentry/nextjs";

import { logger } from "@/lib/logger";

/**
 * Integrasi pemantauan — docs/12 §12.8 & docs/14 §14.6.
 *
 * Mengirim satu event uji ke Sentry. Mengembalikan false bila SENTRY_DSN belum
 * diisi, supaya panel admin bisa mengatakannya dengan jujur.
 */
export function sendTestEvent(): boolean {
  if (!process.env.SENTRY_DSN) {
    logger.warn("monitoring.sentry_not_configured", {
      hint: "SENTRY_DSN kosong — event uji tidak dikirim.",
    });
    return false;
  }

  Sentry.captureMessage("Uji Sentry dari panel admin SaCMS", "info");
  logger.info("monitoring.sentry_test_sent", {});
  return true;
}
