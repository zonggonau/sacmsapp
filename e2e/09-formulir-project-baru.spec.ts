import { createUser, dbTask, expect, signInViaForm, test } from "./support/fixtures";

/**
 * docs/08 §8.6 — formulir project baru.
 *
 * Sengaja TIDAK pernah mengirim data yang valid: uji ini aman dijalankan
 * terhadap server dev yang memakai mesin v0 sungguhan (kredit tidak terpakai).
 */
test("jenis website mengisi contoh prompt, nama wajib, website referensi divalidasi", async ({
  page,
}) => {
  const user = await createUser({ label: "form-baru", planSlug: "pro" });
  // Pengguna uji dibuat langsung di database (tanpa alur daftar), jadi dompetnya
  // masih kosong dan tombol Buat Project akan nonaktif — ADR-012.
  await dbTask("seedCredits", { userId: user.id, amount: 5 });
  await signInViaForm(page, user.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/projects/baru");

  const card = (name: string) =>
    page.locator("label").filter({ has: page.getByRole("radio", { name }) });
  const prompt = page.getByLabel("Ceritakan website yang Anda inginkan");

  await card("Sekolah").click();
  await expect(prompt).toHaveValue(/^Buat website \[nama sekolah atau kampus\]/);

  // Contoh prompt yang belum diubah boleh diganti jenis lain.
  await card("Restoran & Kafe").click();
  await expect(prompt).toHaveValue(/\[nama restoran atau kafe\]/);

  // Teks yang sudah diubah pengguna tidak ditimpa.
  const own = "Website toko roti keluarga dengan menu dan lokasi. Uji E2E.";
  await prompt.fill(own);
  await card("Toko Online").click();
  await expect(prompt).toHaveValue(own);
  await page.getByRole("button", { name: "Isi contoh prompt Toko Online" }).click();
  await expect(prompt).toHaveValue(/^Buat toko online \[nama toko\]/);

  const name = page.getByLabel(/Nama project/);
  await expect(name).toHaveAttribute("required", "");

  // Nama terlalu pendek + alamat tidak sah → ditolak server, tidak ada project.
  await name.fill("ab");
  await page.getByLabel(/Website referensi/).fill("bukan alamat website");
  await page.getByRole("button", { name: "Buat Project" }).click();
  await expect(page.getByText("Nama minimal 3 karakter")).toBeVisible();
  await expect(page.getByText(/Alamat website referensi tidak valid/)).toBeVisible();
  expect(await dbTask<number>("countProjects", { userId: user.id })).toBe(0);
});
