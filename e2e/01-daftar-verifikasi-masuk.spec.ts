import {
  dbTask,
  expect,
  PASSWORD,
  signInViaForm,
  test,
  uniqueEmail,
  waitForMailLink,
} from "./support/fixtures";

/** docs/13 §13.3 alur 1: Daftar → verifikasi → masuk → dashboard. */
test("daftar, konfirmasi email, masuk, lalu tiba di dashboard", async ({ page }) => {
  const email = uniqueEmail("daftar");

  await page.goto("/daftar");
  await page.getByLabel("Nama lengkap").fill("Budi Santoso E2E");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Kata sandi").fill(PASSWORD);
  await page.getByRole("button", { name: "Buat Akun" }).click();

  await expect(page).toHaveURL(/\/verifikasi-email/);
  await expect(page.getByRole("heading", { name: "Cek email Anda" })).toBeVisible();

  // Belum terverifikasi: masuk harus ditolak dengan pesan yang jelas.
  await signInViaForm(page, email);
  await expect(page.getByText("Email Anda belum dikonfirmasi")).toBeVisible();

  const link = await waitForMailLink(email, "Konfirmasi email");
  await page.goto(link);

  // Verifikasi otomatis memasukkan pengguna; bila tidak, masuk lewat formulir.
  await page.goto("/dashboard");
  if (page.url().includes("/masuk")) {
    await signInViaForm(page, email);
  }

  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole("heading", { name: /Selamat datang, Budi/ }),
  ).toBeVisible();

  const user = await dbTask<{ emailVerified: boolean; role: string }>(
    "getUserByEmail",
    { email },
  );
  expect(user.emailVerified).toBe(true);
  expect(user.role).toBe("USER");
});
