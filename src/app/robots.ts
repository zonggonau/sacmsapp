import type { MetadataRoute } from "next";

/** docs/14 §14.9: robots.txt memblokir area terautentikasi. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/harga", "/legal/"],
      disallow: [
        "/admin",
        "/projects",
        "/dashboard",
        "/akun",
        "/api/",
        "/masuk",
        "/daftar",
        "/lupa-sandi",
        "/atur-sandi",
        "/verifikasi-email",
        "/pemeliharaan",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
