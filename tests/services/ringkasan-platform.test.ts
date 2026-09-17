import { afterEach, describe, expect, it, vi } from "vitest";

import { toPlatformSummary } from "@/services/platform-summary.service";

/** ADR-016 — ringkasan hanya-baca untuk panel admin SaCMS. Tanpa database. */

type Overview = Parameters<typeof toPlatformSummary>[0];
type Cost = Parameters<typeof toPlatformSummary>[1];

const overview: Overview = {
  users: 120,
  newUsers: 9,
  projects: 80,
  newProjects: 4,
  buildsToday: 20,
  failedToday: 2,
  successRate: 90,
  runningNow: 1,
  creditsThisMonth: 3400,
  attention: [
    {
      message: "2 build gagal dalam 1 jam terakhir",
      href: "/admin/build?status=FAILED",
    },
    {
      message: "budi@contoh.id sudah memakai 95 dari 100 kredit",
      href: "/admin/pengguna/usr_1",
    },
    {
      message: "sari@contoh.id sudah memakai 92 dari 100 kredit",
      href: "/admin/pengguna/usr_2",
    },
  ],
  settings: {
    killSwitch: false,
    maintenance: true,
    signupEnabled: true,
    defaultModel: "v0-mini",
  },
};

const cost: Cost = {
  days: 30,
  totalCostIdr: 700_000,
  newLiveWebsites: 6,
  avgCostPerWebsiteIdr: 116_667,
  activeUsers: 40,
  costPerActiveUserIdr: 17_500,
  unreconciledEvents: 3,
  topUsers: [
    { id: "usr_1", email: "budi@contoh.id", planName: "Pro", creditsUsed: 95 },
  ],
  plans: [
    {
      name: "Standar",
      users: 10,
      revenueIdr: 500_000,
      costIdr: 200_000,
      marginIdr: 300_000,
    },
    {
      name: "Pro",
      users: 5,
      revenueIdr: 1_000_000,
      costIdr: 500_000,
      marginIdr: 500_000,
    },
  ],
};

describe("ringkasan platform untuk SaCMS", () => {
  it("menjumlahkan pendapatan paket dan menghitung margin terhadap seluruh biaya AI", () => {
    const s = toPlatformSummary(overview, cost, new Date("2026-09-16T10:00:00Z"));

    expect(s.generatedAt).toBe("2026-09-16T10:00:00.000Z");
    expect(s.finance30Days.revenueIdr).toBe(1_500_000);
    expect(s.finance30Days.aiCostIdr).toBe(700_000);
    expect(s.finance30Days.marginIdr).toBe(800_000);
    expect(s.finance30Days.unreconciledEvents).toBe(3);
    expect(s.builds).toEqual({
      finishedToday: 20,
      failedToday: 2,
      successRatePercent: 90,
      runningNow: 1,
    });
    expect(s.system).toEqual({
      killSwitch: false,
      maintenance: true,
      signupEnabled: true,
    });
  });

  it("tidak mengirim email pengguna ke SaCMS", () => {
    const s = toPlatformSummary(overview, cost, new Date());
    const serialized = JSON.stringify(s);

    expect(serialized).not.toContain("@");
    expect(s.attention).toEqual([
      {
        message: "2 build gagal dalam 1 jam terakhir",
        path: "/admin/build?status=FAILED",
      },
      {
        message: "Ada pengguna yang sudah memakai 90% atau lebih dari kreditnya",
        path: "/admin/pengguna",
      },
    ]);
  });
});

describe("GET /api/platform/ringkasan", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.doUnmock("@/services/platform-summary.service");
    vi.resetModules();
  });

  async function loadRoute(key: string) {
    vi.stubEnv("PLATFORM_SUMMARY_KEY", key);
    vi.resetModules();
    return import("@/app/api/platform/ringkasan/route");
  }

  it("menerima kunci yang benar dan tidak mengizinkan cache", async () => {
    // Tanpa uji ini, pemeriksaan yang SELALU menolak pun akan lulus uji di bawah.
    vi.doMock("@/services/platform-summary.service", () => ({
      getPlatformSummary: async () => ({ users: { total: 1, newLast7Days: 0 } }),
    }));
    const key = "k".repeat(40);
    const { GET } = await loadRoute(key);
    const res = await GET(
      new Request("http://localhost/api/platform/ringkasan", {
        headers: { authorization: `Bearer ${key}` },
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ users: { total: 1, newLast7Days: 0 } });
  });

  it("menolak permintaan tanpa kunci", async () => {
    const { GET } = await loadRoute("k".repeat(40));
    const res = await GET(new Request("http://localhost/api/platform/ringkasan"));
    expect(res.status).toBe(401);
  });

  it("menolak kunci yang salah, termasuk yang panjangnya berbeda", async () => {
    const { GET } = await loadRoute("k".repeat(40));
    for (const wrong of ["salah", "k".repeat(39), "k".repeat(41)]) {
      const res = await GET(
        new Request("http://localhost/api/platform/ringkasan", {
          headers: { authorization: `Bearer ${wrong}` },
        }),
      );
      expect(res.status).toBe(401);
    }
  });

  it("menolak semua permintaan bila kunci belum dikonfigurasi", async () => {
    const { GET } = await loadRoute("");
    const res = await GET(
      new Request("http://localhost/api/platform/ringkasan", {
        headers: { authorization: "Bearer " },
      }),
    );
    expect(res.status).toBe(401);
  });
});
