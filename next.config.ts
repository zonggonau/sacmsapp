import type { NextConfig } from "next";
// Diimpor dari "@sentry/nextjs/config", bukan "@sentry/nextjs" —
// jalur yang terakhir sudah deprecated dan berhenti bekerja di Sentry v11.
import { withSentryConfig } from "@sentry/nextjs/config";

/**
 * Header keamanan dasar — lihat docs/12-KEAMANAN.md §12.3.
 * CSP dengan nonce ditambahkan di Fase 7, setelah seluruh sumber skrip diketahui.
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Build production gagal bila ada error tipe.
  // Jangan pernah diubah menjadi true — lihat docs/03 §3.8.
  //
  // Catatan Next.js 16: opsi `eslint` sudah tidak ada di NextConfig — lint
  // tidak lagi dijalankan sebagai bagian dari `next build`. Gerbang lint
  // ditegakkan lewat langkah terpisah `pnpm lint` di CI (.github/workflows/ci.yml).
  typescript: { ignoreBuildErrors: false },

  experimental: {
    // Mengaktifkan forbidden() / unauthorized() dan berkas forbidden.tsx.
    // Tanpa ini, penolakan akses hanya bisa dilaporkan sebagai error 500 —
    // padahal 403 adalah status yang benar dan penting untuk pemantauan.
    // Satu-satunya flag experimental yang dipakai proyek ini (docs/03 §3.2).
    authInterrupts: true,
  },

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

/**
 * Pembungkus Sentry.
 *
 * Unggah source map hanya dilakukan bila SENTRY_AUTH_TOKEN ada — tanpa itu
 * build lokal dan CI tetap berjalan tanpa perlu akun Sentry.
 * docs/02-ARSITEKTUR-SISTEM.md §2.9
 */
export default withSentryConfig(nextConfig, {
  silent: true,
  telemetry: false,
  // `disableLogger` sengaja tidak dipakai: sudah deprecated dan tidak didukung
  // Turbopack, yang merupakan bundler kita.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  ...(process.env.SENTRY_ORG ? { org: process.env.SENTRY_ORG } : {}),
  ...(process.env.SENTRY_PROJECT ? { project: process.env.SENTRY_PROJECT } : {}),
});
