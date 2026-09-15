import type { MetadataRoute } from "next";

/** docs/14 §14.9: sitemap hanya memuat halaman publik. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/harga`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/legal/syarat`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/legal/privasi`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
