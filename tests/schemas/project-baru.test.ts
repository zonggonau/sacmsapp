import { describe, expect, it } from "vitest";

import { promptTemplate, WEBSITE_TYPES } from "@/config/website-types";
import { createProjectSchema, referenceUrlSchema } from "@/schemas/project.schema";

/** docs/08 §8.6 — formulir project baru: nama wajib, contoh prompt, website referensi. */

describe("website referensi", () => {
  it("menormalkan alamat tanpa https dan membiarkan kolom kosong", () => {
    expect(referenceUrlSchema.parse("www.websitecontoh.com")).toBe(
      "https://www.websitecontoh.com/",
    );
    expect(referenceUrlSchema.parse(" https://contoh.co.id/profil ")).toBe(
      "https://contoh.co.id/profil",
    );
    expect(referenceUrlSchema.parse("")).toBeUndefined();
    expect(referenceUrlSchema.parse(undefined)).toBeUndefined();
  });

  it.each([
    "bukan alamat website",
    "localhost:3000",
    "http://192.168.1.10",
    "javascript:alert(1)",
    "ftp://contoh.com",
    "https://user:rahasia@contoh.com",
    "intranet",
  ])("menolak %s", (value) => {
    expect(referenceUrlSchema.safeParse(value).success).toBe(false);
  });
});

describe("formulir project baru", () => {
  const base = {
    websiteType: "SCHOOL",
    prompt: "Website sekolah dasar dengan profil dan berita.",
  };

  it("nama project wajib", () => {
    const empty = createProjectSchema.safeParse({ ...base, name: "" });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.message).toBe("Nama project wajib diisi");

    expect(createProjectSchema.safeParse(base).success).toBe(false);
    expect(createProjectSchema.safeParse({ ...base, name: "SD Harapan" }).success).toBe(
      true,
    );
  });

  it("setiap jenis website punya contoh prompt yang lolos validasi", () => {
    for (const type of WEBSITE_TYPES) {
      const text = promptTemplate(type.value);
      expect(text.startsWith("Buat "), type.value).toBe(true);
      expect(
        createProjectSchema.safeParse({
          name: "Uji Template",
          websiteType: type.value,
          prompt: text,
        }).success,
        type.value,
      ).toBe(true);
    }
  });
});
