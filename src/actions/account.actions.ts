"use server";

import { redirect } from "next/navigation";

import { authActionClient } from "@/lib/safe-action";
import { deleteAccountSchema } from "@/schemas/account.schema";
import * as accountService from "@/services/account.service";

/**
 * Aksi akun milik pengguna sendiri — docs/08 §8.6.
 *
 * `updateProfile` dan `changePassword` masih berada di `auth.actions.ts` karena
 * keduanya memanggil Better Auth secara langsung; `markNotificationsRead` ada di
 * `notification.actions.ts`.
 *
 * Nama action diakhiri `.delete` supaya cocok dengan pola DESTRUCTIVE_ACTION di
 * lib/safe-action.ts: Super Admin yang sedang menyamar TIDAK bisa menghapus akun
 * pengguna dari sini (docs/07 §7.5).
 *
 * `audit` sengaja TIDAK dipasang di metadata: middleware mencatat audit setelah
 * action selesai, dan saat itu baris penggunanya sudah hilang sehingga
 * penulisannya gagal. Service yang mencatatnya lebih dulu (docs/12 §12.6).
 */
export const deleteOwnAccount = authActionClient
  .metadata({ actionName: "user.account.delete" })
  .inputSchema(deleteAccountSchema)
  .action(async ({ parsedInput, ctx }) => {
    await accountService.deleteOwnAccount({
      userId: ctx.user.id,
      confirmEmail: parsedInput.confirmEmail,
      confirmPhrase: parsedInput.confirmPhrase,
      ipAddress: ctx.ip,
      userAgent: ctx.userAgent,
    });

    // Sesi sudah terhapus bersama akunnya, tetapi cookie-nya masih ada di
    // peramban. Rute ini membersihkannya lalu mengantar ke /masuk.
    redirect("/api/sesi-berakhir");
  });
