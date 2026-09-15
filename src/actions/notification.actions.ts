"use server";

import { revalidatePath } from "next/cache";

import { authActionClient } from "@/lib/safe-action";
import * as notificationService from "@/services/notification.service";

/** Menandai semua notifikasi milik pengguna sebagai dibaca. */
export const markNotificationsRead = authActionClient
  .metadata({ actionName: "notification.read_all" })
  .action(async ({ ctx }) => {
    const updated = await notificationService.markAllRead(ctx.user.id);
    revalidatePath("/", "layout");
    return { updated };
  });
