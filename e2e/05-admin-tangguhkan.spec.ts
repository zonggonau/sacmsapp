import {
  createUser,
  dbTask,
  expect,
  randomIp,
  signInViaForm,
  test,
} from "./support/fixtures";

/**
 * docs/13 §13.3 alur 5: Super Admin tangguhkan pengguna → pengguna tidak bisa
 * masuk → audit tercatat.
 */
test("super admin menangguhkan pengguna yang lalu tidak bisa masuk", async ({
  page,
  browser,
}) => {
  const admin = await createUser({
    label: "admin",
    role: "SUPER_ADMIN",
    planSlug: "business",
  });
  const target = await createUser({ label: "target" });

  // Sesi target yang sudah terbuka harus ikut dicabut.
  const targetContext = await browser.newContext({
    extraHTTPHeaders: { "x-forwarded-for": randomIp() },
  });
  const targetPage = await targetContext.newPage();
  await signInViaForm(targetPage, target.email);
  await expect(targetPage).toHaveURL(/\/dashboard/);

  await signInViaForm(page, admin.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(`/admin/pengguna/${target.id}`);
  await expect(page.getByRole("heading", { name: target.name })).toBeVisible();

  await page.getByRole("button", { name: "Tangguhkan Akun" }).click();
  await page.getByLabel("Alasan (wajib)").fill("Uji E2E: pelanggaran syarat layanan.");
  await page.getByRole("button", { name: "Tangguhkan", exact: true }).click();
  await expect(
    page.getByText("Akun ditangguhkan. Semua sesinya sudah dicabut."),
  ).toBeVisible();

  // Sesi lama target ditolak seketika.
  await targetPage.goto("/dashboard");
  await expect(targetPage).toHaveURL(/\/masuk/);

  // Masuk ulang ditolak.
  await signInViaForm(targetPage, target.email);
  await expect(targetPage.getByText(/salah|ditangguhkan/i)).toBeVisible();
  await expect(targetPage).not.toHaveURL(/\/dashboard/);
  await targetContext.close();

  // Audit tercatat dan terlihat di panel.
  const audited = await dbTask<boolean>("hasAudit", {
    action: "admin.user.suspend",
    targetId: target.id,
    actorId: admin.id,
  });
  expect(audited).toBe(true);

  await page.goto(`/admin/audit?targetId=${target.id}`);
  await expect(page.getByText("admin.user.suspend")).toBeVisible();
});
