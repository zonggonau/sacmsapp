import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

import {
  DataTable,
  EmptyRow,
  PageHeader,
  StatCard,
  Td,
  Th,
} from "@/components/features/admin/admin-ui";
import { SettingSwitch } from "@/components/features/admin/setting-switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SETTING_KEYS } from "@/config/settings";
import { angka, rupiah, tanggal } from "@/lib/format";
import { cn } from "@/lib/utils";
import * as overviewService from "@/services/admin-overview.service";
import * as costService from "@/services/cost.service";

export const metadata: Metadata = { title: "Ringkasan Sistem" };

export default async function AdminOverviewPage() {
  const [o, cost] = await Promise.all([
    overviewService.getOverview(),
    costService.getCostMetrics(30),
  ]);

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
          hint={`Biaya vendor 30 hari: ${rupiah(cost.totalCostIdr)}`}
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
          <CardTitle className="text-base">Biaya vendor · 30 hari</CardTitle>
          <CardDescription>
            Dari rekonsiliasi harian laporan v0 (docs/11 §11.8).
            {cost.unreconciledEvents > 0
              ? ` ${angka(cost.unreconciledEvents)} generate belum punya data biaya — angka bisa lebih rendah dari sebenarnya.`
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Biaya rata-rata per website jadi"
              value={
                cost.avgCostPerWebsiteIdr === null
                  ? "—"
                  : rupiah(cost.avgCostPerWebsiteIdr)
              }
              hint={`${angka(cost.newLiveWebsites)} website tayang pertama kali`}
            />
            <StatCard
              label="Biaya per pengguna aktif"
              value={
                cost.costPerActiveUserIdr === null
                  ? "—"
                  : rupiah(cost.costPerActiveUserIdr)
              }
              hint={`${angka(cost.activeUsers)} pengguna aktif`}
            />
            <StatCard
              label="Total biaya vendor"
              value={rupiah(cost.totalCostIdr)}
              hint="Semua generate & edit"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-2">
              <h2 className="text-sm font-semibold">Margin per paket</h2>
              <DataTable minWidth="26rem">
                <thead>
                  <tr>
                    <Th>Paket</Th>
                    <Th className="text-right">Pengguna</Th>
                    <Th className="text-right">Pendapatan</Th>
                    <Th className="text-right">Biaya</Th>
                    <Th className="text-right">Margin</Th>
                  </tr>
                </thead>
                <tbody>
                  {cost.plans.map((p) => (
                    <tr key={p.name}>
                      <Td>{p.name}</Td>
                      <Td className="text-right font-mono tabular-nums">
                        {angka(p.users)}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {rupiah(p.revenueIdr)}
                      </Td>
                      <Td className="text-right tabular-nums">{rupiah(p.costIdr)}</Td>
                      <Td
                        className={cn(
                          "text-right tabular-nums",
                          p.marginIdr < 0 && "text-destructive",
                        )}
                      >
                        {rupiah(p.marginIdr)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
              <p className="text-muted-foreground text-xs">
                Pendapatan = harga paket × pengguna saat ini (pembayaran MVP manual).
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-sm font-semibold">10 pemakai kredit tertinggi</h2>
              <DataTable minWidth="22rem">
                <thead>
                  <tr>
                    <Th>Pengguna</Th>
                    <Th>Paket</Th>
                    <Th className="text-right">Kredit</Th>
                  </tr>
                </thead>
                <tbody>
                  {cost.topUsers.length === 0 ? (
                    <EmptyRow colSpan={3}>Belum ada pemakaian kredit.</EmptyRow>
                  ) : (
                    cost.topUsers.map((u) => (
                      <tr key={u.id}>
                        <Td>
                          <Link
                            href={`/admin/pengguna/${u.id}`}
                            className="text-xs break-all hover:underline"
                          >
                            {u.email}
                          </Link>
                        </Td>
                        <Td className="text-xs">{u.planName}</Td>
                        <Td className="text-right font-mono tabular-nums">
                          {angka(u.creditsUsed)}
                        </Td>
                      </tr>
                    ))
                  )}
                </tbody>
              </DataTable>
            </section>
          </div>
        </CardContent>
      </Card>

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
            description="Menolak semua pembuatan website baru. Build yang sedang berjalan dihentikan di langkah berikutnya. Menyala otomatis bila biaya harian melewati ambang."
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
