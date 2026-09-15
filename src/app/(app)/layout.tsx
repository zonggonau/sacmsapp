import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { getImpersonator, isAdminRole, requireUser } from "@/lib/auth-guard";
import * as notificationService from "@/services/notification.service";
import * as quotaService from "@/services/quota.service";
import * as systemService from "@/services/system.service";

/**
 * Gerbang tunggal area terautentikasi — lapis 2 pertahanan (docs/07 §7.4).
 *
 * Karena guard tinggal di layout grup, setiap halaman di dalam (app) otomatis
 * terlindungi. Tidak ada halaman yang bisa lupa memasang pemeriksaan.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [impersonator, maintenance, credits, unreadNotifications] = await Promise.all([
    getImpersonator(),
    systemService.isMaintenanceMode(),
    quotaService.getCreditSummary(user.id),
    notificationService.countUnread(user.id),
  ]);

  // Maintenance: pengguna biasa dialihkan; admin tetap bisa bekerja, termasuk
  // saat menyamar untuk melihat masalah pengguna (docs/10 §10.8).
  if (maintenance && !isAdminRole(user.role) && !impersonator) {
    redirect("/pemeliharaan");
  }

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      }}
      impersonation={
        impersonator
          ? { userName: user.name, userEmail: user.email, adminName: impersonator.name }
          : null
      }
      credits={credits}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppShell>
  );
}
