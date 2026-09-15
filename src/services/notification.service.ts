import { db } from "@/lib/db";

/**
 * Notifikasi pengguna — docs/11 §11.6 (kredit menipis) & docs/09 (website siap).
 *
 * Notifikasi dibuat oleh service lain; berkas ini hanya membaca dan menandai
 * dibaca. Setiap query memuat userId (docs/06 §6.7).
 */

const PAGE_SIZE = 50;

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: Date;
}

export async function listForUser(userId: string): Promise<NotificationItem[]> {
  return db.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
    select: {
      id: true,
      type: true,
      title: true,
      body: true,
      href: true,
      read: true,
      createdAt: true,
    },
  });
}

export async function countUnread(userId: string): Promise<number> {
  return db.notification.count({ where: { userId, read: false } });
}

export async function markAllRead(userId: string): Promise<number> {
  const { count } = await db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  return count;
}
