import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

/** RENCANA-FRONTEND.md §7 — halaman Enterprise publik dan tautan keluarnya. */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("halaman /enterprise", () => {
  it("terbuka tanpa sesi — tidak dialihkan ke /masuk", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest("http://localhost:3001/enterprise"));

    expect(res.headers.get("location")).toBeNull();
    expect(res.status).toBe(200);
  });

  it("halaman yang dilindungi tetap dialihkan — pembanding uji di atas", async () => {
    const { proxy } = await import("@/proxy");
    const res = await proxy(new NextRequest("http://localhost:3001/dashboard"));

    expect(res.headers.get("location")).toContain("/masuk");
  });
});

describe("tautan SaCMS Developer", () => {
  it("bawaan mengarah ke developer.sacms.cloud", async () => {
    vi.stubEnv("NEXT_PUBLIC_SACMS_DEVELOPER_URL", "");
    const { SACMS_DEVELOPER } = await import("@/config/enterprise");

    expect(SACMS_DEVELOPER.registerHref).toBe(
      "https://developer.sacms.cloud/register?plan=enterprise",
    );
    expect(SACMS_DEVELOPER.docsHref).toBe("https://developer.sacms.cloud/docs");
    expect(SACMS_DEVELOPER.host).toBe("developer.sacms.cloud");
  });

  it("bisa diarahkan ke alamat SaCMS saat ini sebelum cutover domain", async () => {
    vi.stubEnv("NEXT_PUBLIC_SACMS_DEVELOPER_URL", "https://sacms.cloud/");
    const { SACMS_DEVELOPER } = await import("@/config/enterprise");

    expect(SACMS_DEVELOPER.registerHref).toBe(
      "https://sacms.cloud/register?plan=enterprise",
    );
  });
});

describe("validasi env kanal dukungan", () => {
  it("menerima nomor WhatsApp asli dan menolak yang bukan angka", async () => {
    // Regresi: regex sempat tertulis /^d{8,15}$/ sehingga nomor asli ditolak
    // dan aplikasi gagal start begitu NEXT_PUBLIC_SUPPORT_WHATSAPP diisi.
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "6281234567890");
    await expect(import("@/lib/env")).resolves.toBeDefined();

    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPPORT_WHATSAPP", "dddddddd");
    await expect(import("@/lib/env")).rejects.toThrow(/NEXT_PUBLIC_SUPPORT_WHATSAPP/);
  });
});
