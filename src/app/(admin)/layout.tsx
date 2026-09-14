import type { Metadata } from "next";

import { AdminShell } from "@/components/layout/admin-shell";
import { requireSuperAdmin } from "@/lib/auth-guard";
import * as systemService from "@/services/system.service";

export const metadata: Metadata = {
  title: { default: "Panel Admin", template: "%s | Admin SaCMS" },
  robots: { index: false, follow: false },
};

/** Rute admin tidak pernah di-cache — docs/10 §10.9 aturan 5. */
export const dynamic = "force-dynamic";

/**
 * Gerbang tunggal panel admin — docs/10 §10.9 aturan 1.
 *
 * Guard ada di layout GRUP, bukan per halaman: halaman admin baru otomatis
 * terlindungi. Pengguna biasa (termasuk sesi impersonasi) mendapat 403.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();
  const maintenance = await systemService.isMaintenanceMode();

  return (
    <AdminShell
      user={{ name: user.name, email: user.email, image: user.image }}
      maintenance={maintenance}
    >
      {children}
    </AdminShell>
  );
}
