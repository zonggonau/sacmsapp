import type { Metadata } from "next";
import Link from "next/link";
import { BellOff } from "lucide-react";

import { MarkNotificationsRead } from "@/components/features/account/mark-notifications-read";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guard";
import { sejak } from "@/lib/format";
import * as notificationService from "@/services/notification.service";

export const metadata: Metadata = {
  title: "Notifikasi",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const items = await notificationService.listForUser(user.id);
  const unread = items.filter((n) => !n.read).length;

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
        <CardTitle className="text-base">Notifikasi</CardTitle>
        <MarkNotificationsRead disabled={unread === 0} />
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <BellOff className="text-muted-foreground size-6" />
            <p className="text-muted-foreground text-sm">
              Belum ada notifikasi. Kabar tentang website dan kuota Anda akan muncul di
              sini.
            </p>
          </div>
        ) : (
          <ul className="divide-border divide-y">
            {items.map((n) => (
              <li key={n.id} className="flex flex-col gap-1 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  {n.href ? (
                    <Link href={n.href} className="text-sm font-medium hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium">{n.title}</span>
                  )}
                  {n.read ? null : <Badge variant="subtle">baru</Badge>}
                </div>
                {n.body ? (
                  <p className="text-muted-foreground text-sm">{n.body}</p>
                ) : null}
                <span className="text-muted-foreground text-xs">
                  {sejak(n.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
