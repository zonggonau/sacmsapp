import { createUser, dbTask, expect, signInViaForm, test } from "./support/fixtures";

/** docs/13 §13.3 alur 4: Batas kuota ditegakkan → pesan upgrade muncul. */
test("kredit habis: generate ditolak dengan tawaran Lihat Paket", async ({ page }) => {
  const limit = await dbTask<number>("planCredits", { slug: "free" });
  const user = await createUser({ label: "kuota", creditsUsed: limit });
  const project = await dbTask<{ id: string }>("createProject", {
    userId: user.id,
    name: "Kuota E2E",
    initialPrompt: "Website toko kopi sederhana untuk uji kuota.",
  });

  await signInViaForm(page, user.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText(`${limit} / ${limit} kredit`)).toBeVisible();

  await page.goto(`/projects/${project.id}/builder`);

  // docs/11 §11.6: saat kuota habis tombol TETAP terlihat tetapi nonaktif,
  // disertai penjelasan dan tombol Lihat Paket.
  const bangun = page.getByRole("button", { name: "Bangun Sekarang" });
  await expect(bangun).toBeVisible();
  await expect(bangun).toBeDisabled();
  await expect(page.getByText(/Kredit bulan ini sudah habis/).first()).toBeVisible();
  expect(await dbTask<number>("countBuildJobs", { projectId: project.id })).toBe(0);

  await page.getByRole("link", { name: "Lihat Paket" }).click();
  await expect(page).toHaveURL(/\/akun\/paket/);
  await expect(page.getByText("Kredit bulan ini")).toBeVisible();
});
