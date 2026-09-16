import {
  createUser,
  dbTask,
  expect,
  PASSWORD,
  randomIp,
  signInViaForm,
  test,
  uniqueEmail,
  waitForMailLink,
} from "./support/fixtures";

/**
 * Butir Definition of Done Fase 1–3 (docs/13) yang dibuktikan di peramban.
 * Alur utama (daftar, bangun, terbit, kuota, admin) ada di berkas 01–05.
 */

test.describe("Fase 1 — autentikasi & kerangka", () => {
  test("halaman terlindungi mengingat tujuan dan kembali setelah masuk", async ({
    page,
  }) => {
    const user = await createUser({ label: "lanjut" });

    await page.goto("/projects?q=kopi");
    await expect(page).toHaveURL(/\/masuk\?lanjut=%2Fprojects%3Fq%3Dkopi/);

    await page.getByLabel("Email").fill(user.email);
    await page.getByLabel("Kata sandi").fill(PASSWORD);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL(/\/projects\?q=kopi/);

    // Sudah masuk lalu membuka /masuk → dashboard.
    await page.goto("/masuk");
    await expect(page).toHaveURL(/\/dashboard/);

    // Tanpa sesi → /masuk?lanjut=/dashboard.
    await page.context().clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/masuk\?lanjut=%2Fdashboard/);
  });

  test("gagal masuk keenam kali diblokir rate limit", async ({ page }) => {
    const user = await createUser({ label: "brute" });

    for (let i = 1; i <= 5; i += 1) {
      await signInViaForm(page, user.email, "sandi-salah-sekali");
      await expect(page.getByText("Email atau kata sandi salah.")).toBeVisible();
    }
    await signInViaForm(page, user.email, "sandi-salah-sekali");
    await expect(page.getByText(/Terlalu banyak permintaan/)).toBeVisible();
  });

  test("peran SUPER_ADMIN yang disuntikkan saat daftar diabaikan", async ({ page }) => {
    const email = uniqueEmail("suntik");
    const res = await page.request.post("/api/auth/sign-up/email", {
      headers: { origin: new URL(page.url() || "http://localhost").origin },
      data: { name: "Penyusup", email, password: PASSWORD, role: "SUPER_ADMIN" },
      failOnStatusCode: false,
    });

    if (res.ok()) {
      const saved = await dbTask<{ role: string }>("getUserByEmail", { email });
      expect(saved.role).toBe("USER");
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(400);
    }
  });

  test("atur ulang sandi mencabut sesi lama", async ({ page, browser }) => {
    const user = await createUser({ label: "reset" });

    // Sesi lama di perangkat lain.
    const other = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": randomIp() },
    });
    const oldPage = await other.newPage();
    await signInViaForm(oldPage, user.email);
    await expect(oldPage).toHaveURL(/\/dashboard/);

    await page.goto("/lupa-sandi");
    await page.getByLabel("Email").fill(user.email);
    await page.getByRole("button", { name: "Kirim Tautan" }).click();
    await expect(page.getByText("Cek kotak masuk Anda")).toBeVisible();

    const link = await waitForMailLink(user.email, "Atur ulang kata sandi");
    await page.goto(link);
    const baru = "Sandi-Baru-E2E-67890";
    await page.getByLabel("Kata sandi baru", { exact: true }).fill(baru);
    await page.getByLabel("Ulangi kata sandi baru").fill(baru);
    await page.getByRole("button", { name: "Simpan Kata Sandi" }).click();
    await expect(page).toHaveURL(/\/masuk/);

    await oldPage.goto("/dashboard");
    await expect(oldPage).toHaveURL(/\/masuk/);
    await other.close();

    await signInViaForm(page, user.email, baru);
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("tema tersimpan diterapkan sebelum hidrasi dan nav aktif oranye", async ({
    page,
  }) => {
    const user = await createUser({ label: "tema" });
    await signInViaForm(page, user.email);
    await expect(page).toHaveURL(/\/dashboard/);

    await page.addInitScript(() => {
      localStorage.setItem("theme", "light");
      document.addEventListener("DOMContentLoaded", () => {
        (window as unknown as { __kelasAwal: string }).__kelasAwal =
          document.documentElement.className;
      });
    });
    await page.goto("/projects");
    const kelasAwal = await page.evaluate(
      () => (window as unknown as { __kelasAwal: string }).__kelasAwal,
    );
    expect(kelasAwal).toContain("light");

    const nav = page.getByRole("navigation", { name: "Navigasi utama" });
    const aktif = nav.getByRole("link", { name: "Project" });
    await expect(aktif).toHaveAttribute("aria-current", "page");
    await expect(aktif).toHaveClass(/text-primary-text/);
  });
});

test.describe("Fase 2 — CRUD project", () => {
  test("halaman project baru, filter di URL, tombol Back", async ({ page }) => {
    const user = await createUser({ label: "crud", planSlug: "pro" });
    const project = await dbTask<{ id: string }>("createProject", {
      userId: user.id,
      name: "Toko Kopi Senja",
      initialPrompt: "Website toko kopi untuk uji DoD Fase 2.",
    });
    await signInViaForm(page, user.email);
    await expect(page).toHaveURL(/\/dashboard/);

    // ADR-013: satu URL satu tampilan — selalu halaman penuh, tanpa dialog.
    await page.goto("/projects");
    await page.getByRole("link", { name: "Project Baru" }).click();
    await expect(page).toHaveURL(/\/projects\/baru/);
    await expect(page.getByRole("heading", { name: "Project baru" })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.reload();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByLabel("Ceritakan website yang Anda inginkan")).toBeVisible();

    // Back dari formulir kembali ke daftar.
    await page.goBack();
    await expect(page).toHaveURL(/\/projects(\?|$)/);

    await page.goto("/projects");
    await page.getByLabel("Cari project").fill("Senja");
    await expect(page).toHaveURL(/q=Senja/);
    await page.reload();
    await expect(page.getByLabel("Cari project")).toHaveValue("Senja");

    await page
      .getByRole("link", { name: /Toko Kopi Senja/ })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`/projects/${project.id}`));
    await page.goBack();
    await expect(page).toHaveURL(/\/projects\?q=Senja/);
  });

  test("project milik pengguna lain membalas 404 di semua tab", async ({ page }) => {
    const owner = await createUser({ label: "pemilik" });
    const stranger = await createUser({ label: "penyusup" });
    const project = await dbTask<{ id: string }>("createProject", {
      userId: owner.id,
      name: "Rahasia Pemilik",
      initialPrompt: "Website rahasia untuk uji kepemilikan.",
    });

    await signInViaForm(page, stranger.email);
    await expect(page).toHaveURL(/\/dashboard/);

    for (const tab of ["", "/builder", "/deployment", "/domain", "/pengaturan"]) {
      const res = await page.goto(`/projects/${project.id}${tab}`);
      expect(res?.status(), `status ${tab || "ringkasan"}`).toBe(404);
      await expect(page.getByText("Project tidak ditemukan")).toBeVisible();
      await expect(page.getByText("Rahasia Pemilik")).toHaveCount(0);
    }
  });
});
