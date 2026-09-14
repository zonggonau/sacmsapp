import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import { PageHeader, StatCard } from "@/components/features/admin/admin-ui";
import { SettingSwitch } from "@/components/features/admin/setting-switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SETTING_KEYS } from "@/config/settings";
import { angka, tanggal } from "@/lib/format";
import * as overviewService from "@/services/admin-overview.service";

export const metadata: Metadata = { title: "Ringkasan Sistem" };

export default async function AdminOverviewPage() {
  const o = await overviewService.getOverview();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ringkasan Sistem"
        description={`Keadaan SaCMS per ${tanggal(new Date())}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Pengguna"
          value={angka(o.users)}
          hint={`+${angka(o.newUsers)} dalam 7 hari`}
        />
        <StatCard
          label="Project"
          value={angka(o.projects)}
          hint={`+${angka(o.newProjects)} dalam 7 hari`}
        />
        <StatCard
          label="Build selesai hari ini"
          value={angka(o.buildsToday)}
          hint={
            o.successRate === null
              ? `${o.runningNow} sedang berjalan`
              : `${o.failedToday} gagal · sukses ${o.successRate}% · ${o.runningNow} berjalan`
          }
        />
        <StatCard
          label="Kredit terpakai bulan ini"
          value={angka(o.creditsThisMonth)}
          hint="Estimasi biaya vendor tersedia setelah Fase 6"
        />
      </div>

      {o.attention.length > 0 ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TriangleAlert className="text-destructive size-4" />
              Perlu perhatian
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {o.attention.map((item) => (
                <li key={item.message}>
                  <Link
                    href={item.href}
                    className="hover:text-foreground flex items-center justify-between gap-3 py-2.5 text-sm"
                  >
                    <span>{item.message}</span>
                    <ArrowRight className="text-muted-foreground size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kendali cepat</CardTitle>
          <CardDescription>
            Berlaku seketika untuk seluruh sistem, tanpa deploy.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border divide-y">
          <SettingSwitch
            settingKey={SETTING_KEYS.aiKillSwitch}
            checked={o.settings.killSwitch}
            label="Kill switch AI"
            description="Menolak semua pembuatan website baru. Build yang sedang berjalan dihentikan di langkah berikutnya."
            confirm={{
              when: true,
              title: "Nyalakan kill switch AI?",
              body: "Semua pengguna tidak bisa membuat atau mengedit website sampai kill switch dimatikan. Mereka melihat pesan pemeliharaan.",
              action: "Nyalakan Kill Switch",
            }}
          />
          <SettingSwitch
            settingKey={SETTING_KEYS.maintenance}
            checked={o.settings.maintenance}
            label="Maintenance mode"
            description="Hanya admin yang bisa memakai aplikasi. Website yang sudah tayang tetap bisa diakses."
            confirm={{
              when: true,
              title: "Aktifkan maintenance mode?",
              body: "Semua pengguna biasa dialihkan ke halaman pemeliharaan dan tidak bisa bekerja sampai mode ini dimatikan.",
              action: "Aktifkan Maintenance",
            }}
          />
          <SettingSwitch
            settingKey={SETTING_KEYS.signupEnabled}
            checked={o.settings.signupEnabled}
            label="Pendaftaran baru"
            description="Bila mati, tidak ada akun baru yang bisa dibuat — termasuk lewat Google."
          />
        </CardContent>
      </Card>
    </div>
  );
}
