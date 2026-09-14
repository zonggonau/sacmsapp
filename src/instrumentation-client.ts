import * as Sentry from "@sentry/nextjs";

/** Sentry sisi browser. No-op tanpa NEXT_PUBLIC_SENTRY_DSN. */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,
  // Replay tidak diaktifkan: merekam sesi pengguna berbenturan dengan aturan
  // privasi kita (docs/12 §12.6). Aktifkan hanya lewat keputusan tertulis.
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
