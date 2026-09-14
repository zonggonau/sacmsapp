import * as Sentry from "@sentry/nextjs";

/**
 * Sentry sisi server.
 *
 * Tanpa SENTRY_DSN, init menjadi no-op — aplikasi tetap berjalan normal saat
 * pengembangan lokal tanpa akun Sentry.
 *
 * docs/02-ARSITEKTUR-SISTEM.md §2.9, docs/12-KEAMANAN.md §12.6
 */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV,

  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,

  /**
   * Penyamaran data sensitif. Aturan retensi log kita melarang email, prompt,
   * dan token masuk ke penyimpanan pihak ketiga (docs/12 §12.6).
   */
  beforeSend(event) {
    if (event.request?.cookies) delete event.request.cookies;
    if (event.request?.headers) {
      delete event.request.headers["authorization"];
      delete event.request.headers["cookie"];
    }
    if (event.user) {
      delete event.user.email;
      delete event.user.ip_address;
    }
    return event;
  },
});
