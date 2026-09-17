import { createUser, dbTask, expect, signInViaForm, test } from "./support/fixtures";

/**
 * docs/13 §13.3
 *   alur 2: Buat project → generate → pratinjau tampil
 *   alur 3: Edit lewat prompt → versi baru → terbitkan → URL publik hidup
 *
 * Dengan mesin tiruan, alamat publik berakhiran `.invalid` dan tidak bisa
 * dibuka; yang diuji adalah alurnya sampai deployment READY dan project LIVE.
 * Uji nyata terhadap v0/Vercel dijalankan manual sebelum rilis (docs/13 §13.3).
 */
test("buat project, pratinjau tampil, edit lewat chat, lalu terbitkan", async ({
  page,
}) => {
  const user = await createUser({ label: "bangun" });
  // Dompet kredit ADR-012: pengguna uji tidak melewati alur daftar.
  await dbTask("seedCredits", { userId: user.id, amount: 10 });
  await signInViaForm(page, user.email);
  await expect(page).toHaveURL(/\/dashboard/);

  // ---- alur 2 ----
  await page.goto("/projects/baru");
  await page
    .getByLabel("Ceritakan website yang Anda inginkan")
    .fill("Website sekolah dasar negeri dengan profil, berita, dan kontak. Uji E2E.");
  await page.getByLabel(/Nama project/).fill("Sekolah E2E");
  await page.getByRole("button", { name: "Buat Project" }).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/builder/);
  const projectId = page.url().split("/projects/")[1]!.split("/")[0]!;

  await expect(page.getByTitle("Pratinjau Sekolah E2E")).toBeVisible({
    timeout: 90_000,
  });

  // docs/12 §12.5 & DoD Fase 3: pratinjau terkurung di iframe sandbox tanpa
  // allow-same-origin, sehingga kode hasil AI tidak bisa membaca sesi SaCMS.
  const sandbox = await page
    .getByTitle("Pratinjau Sekolah E2E")
    .getAttribute("sandbox");
  expect(sandbox).toContain("allow-scripts");
  expect(sandbox).not.toContain("allow-same-origin");

  // ---- alur 3: edit ----
  const chat = page.getByLabel("Permintaan perubahan");
  await chat.fill("Tambahkan halaman galeri kegiatan siswa dengan foto terbaru.");
  await page.getByRole("button", { name: "Kirim permintaan" }).click();

  await expect
    .poll(() => dbTask<number>("countVersions", { projectId }), {
      timeout: 90_000,
      intervals: [3_000],
    })
    .toBe(2);

  // ---- alur 3: terbitkan ----
  // ADR-012: website hanya boleh tayang bila Paket Project-nya aktif.
  await dbTask("seedSubscription", { projectId, planSlug: "business" });
  await page.goto(`/projects/${projectId}/deployment`);
  await page.getByRole("button", { name: "Terbitkan" }).click();

  await expect(page.getByText("Sedang tayang", { exact: true })).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByText(/Alamat ini bisa dibuka siapa saja/)).toBeVisible();

  const project = await dbTask<{ status: string; productionUrl: string | null }>(
    "getProject",
    {
      id: projectId,
    },
  );
  expect(project.status).toBe("LIVE");
  expect(project.productionUrl).toMatch(/^https:\/\//);
});
