import {
  createUser,
  expect,
  PASSWORD,
  randomIp,
  signInViaForm,
  test,
  uniqueEmail,
} from "./support/fixtures";

/**
 * docs/07 §7.8 — butir uji keamanan akses yang dibuktikan di peramban.
 * Pemanggilan action langsung (DevTools) dan impersonasi diuji di
 * tests/actions/akses-rbac.test.ts.
 */

test.describe("Keamanan akses", () => {
  test("pengguna biasa membuka /admin mendapat 403, bukan halaman kosong", async ({
    page,
  }) => {
    const user = await createUser({ label: "bukan-admin" });
    await signInViaForm(page, user.email);
    await expect(page).toHaveURL(/\/dashboard/);

    for (const path of ["/admin", "/admin/pengguna", "/admin/audit", "/admin/sistem"]) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBe(403);
      await expect(page.getByRole("heading", { name: "Akses ditolak" })).toBeVisible();
    }
  });

  test("masuk dan lupa sandi tidak membocorkan email terdaftar", async ({ page }) => {
    const user = await createUser({ label: "enumerasi" });
    const unknown = uniqueEmail("tidak-terdaftar");

    for (const email of [unknown, user.email]) {
      await signInViaForm(page, email, "sandi-salah-sekali");
      await expect(page.getByText("Email atau kata sandi salah.")).toBeVisible();
    }

    for (const email of [unknown, user.email]) {
      await page.goto("/lupa-sandi");
      await page.getByLabel("Email").fill(email);
      await page.getByRole("button", { name: "Kirim Tautan" }).click();
      await expect(page.getByText("Cek kotak masuk Anda")).toBeVisible();
    }
  });

  test("ganti sandi dari halaman akun mengeluarkan sesi lama", async ({
    page,
    browser,
  }) => {
    const user = await createUser({ label: "ganti-sandi" });

    const other = await browser.newContext({
      extraHTTPHeaders: { "x-forwarded-for": randomIp() },
    });
    const oldPage = await other.newPage();
    await signInViaForm(oldPage, user.email);
    await expect(oldPage).toHaveURL(/\/dashboard/);

    await signInViaForm(page, user.email);
    await expect(page).toHaveURL(/\/dashboard/);
    await page.goto("/akun/keamanan");
    const baru = "Sandi-Ganti-E2E-24680";
    await page.getByLabel("Kata sandi saat ini").fill(PASSWORD);
    await page.getByLabel("Kata sandi baru", { exact: true }).fill(baru);
    await page.getByLabel("Ulangi kata sandi baru").fill(baru);
    await page.getByRole("button", { name: "Ubah Kata Sandi" }).click();
    await expect(
      page.getByText("Kata sandi diubah. Perangkat lain sudah dikeluarkan."),
    ).toBeVisible();

    await oldPage.goto("/dashboard");
    await expect(oldPage).toHaveURL(/\/masuk/);
    await other.close();

    // Perangkat yang mengganti sandi tetap masuk.
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
