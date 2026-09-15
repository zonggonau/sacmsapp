import { createUser, dbTask, expect, signInViaForm, test } from "./support/fixtures";

/**
 * Tata letak Builder yang pernah rusak di pemakaian nyata.
 */

test("pesan panjang tanpa spasi tidak membuat panel chat bergulir ke samping", async ({
  page,
}) => {
  const user = await createUser({ label: "chat-lebar" });
  const project = await dbTask<{ id: string }>("createProject", {
    userId: user.id,
    name: "Chat Panjang",
    initialPrompt: "Website uji tata letak chat builder.",
  });

  // Tautan atau teks tempelan tanpa spasi — kasus yang memicu gulir menyamping.
  const longWord = "https://contoh.test/" + "a".repeat(380);
  await dbTask("seedChat", {
    projectId: project.id,
    // Alamat pratinjau v0 yang diizinkan CSP; isinya tidak perlu termuat.
    previewUrl: "https://uji-tata-letak-sacms.vercel.app/",
    content: longWord,
  });

  await signInViaForm(page, user.email);
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(`/projects/${project.id}/builder`);

  const bubble = page.getByText(longWord.slice(0, 40));
  await expect(bubble).toBeVisible();

  const layout = await bubble.evaluate((el) => {
    const scroller = el.closest("[class*='overflow-y-auto']");
    const panel = el.closest("[class*='rounded-lg'][class*='border']")?.parentElement;
    if (!scroller || !panel) return null;
    return {
      scrollerOverflow: scroller.scrollWidth - scroller.clientWidth,
      bubbleRight: el.getBoundingClientRect().right,
      scrollerRight: scroller.getBoundingClientRect().right,
      pageOverflow:
        document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  expect(layout, "wadah chat ditemukan").not.toBeNull();
  expect(
    layout!.scrollerOverflow,
    "gulir menyamping di panel chat",
  ).toBeLessThanOrEqual(0);
  expect(layout!.bubbleRight).toBeLessThanOrEqual(layout!.scrollerRight + 1);
  expect(layout!.pageOverflow, "gulir menyamping di halaman").toBeLessThanOrEqual(0);
});
