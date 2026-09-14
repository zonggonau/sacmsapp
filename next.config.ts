import type { NextConfig } from "next";

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

  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
