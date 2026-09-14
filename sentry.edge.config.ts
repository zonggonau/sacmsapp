import * as Sentry from "@sentry/nextjs";

/** Sentry untuk runtime edge (proxy.ts). No-op tanpa SENTRY_DSN. */
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 0,
  sendDefaultPii: false,
});
