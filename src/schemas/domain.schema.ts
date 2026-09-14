import { z } from "zod";

/**
 * Skema aksi Domain — docs/08 §8.6 & docs/09 §9.10.
 */

/**
 * Nama host yang sah: label 1–63 karakter (huruf kecil, angka, tanda hubung,
 * tidak diawali/diakhiri tanda hubung), minimal dua label, TLD huruf saja.
 * Garis bawah TIDAK sah di nama host, walau versi sebelumnya menerimanya.
 */
const HOSTNAME =
  /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** Pengguna sering menempel alamat lengkap dari peramban. Rapikan dulu. */
function normalizeDomain(value: unknown) {
  if (typeof value !== "string") return value;
  return value
    .trim()
    .toLowerCase()
    .replace(/^[a-z]+:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
}

export const domainNameSchema = z.preprocess(
  normalizeDomain,
  z
    .string()
    .min(3, "Domain minimal 3 karakter")
    .max(253, "Domain maksimal 253 karakter")
    .refine(
      (d) => HOSTNAME.test(d),
      "Format domain tidak valid. Contoh: sekolahku.sch.id atau www.perusahaan.com",
    )
    .refine(
      (d) => !d.endsWith(".vercel.app") && d !== "vercel.app",
      "Alamat vercel.app sudah diberikan otomatis dan tidak perlu ditambahkan.",
    )
    .refine(
      (d) => !/(^|\.)sacms\.(id|cloud)$/.test(d),
      "Domain milik SaCMS tidak dapat dipakai sebagai custom domain.",
    ),
);

export const addDomainSchema = z.object({
  projectId: z.string().min(1, "ID project wajib diisi"),
  domain: domainNameSchema,
});

export const domainIdSchema = z.object({
  domainId: z.string().min(1, "ID domain wajib diisi"),
});
