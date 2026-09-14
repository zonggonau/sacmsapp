import type { Metadata } from "next";

import { PageHeader } from "@/components/features/admin/admin-ui";
import { SettingSwitch } from "@/components/features/admin/setting-switch";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SETTING_KEYS } from "@/config/settings";
import * as integrationService from "@/services/integration.service";
import * as systemService from "@/services/system.service";

export const metadata: Metadata = { title: "Sistem" };

const STATE_VARIANT = {
  nyata: "success",
  tiruan: "warning",
  "belum diatur": "neutral",
} as const;

export default async function AdminSystemPage() {
  const settings = await systemService.getSettings();
  const integrations = integrationService.getIntegrationStatus();

  return (
    <div className="space-y-6">
      <PageHeader title="Sistem" description="Akses aplikasi dan status integrasi." />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Akses aplikasi</CardTitle>
        </CardHeader>
        <CardContent className="divide-border divide-y">
          <SettingSwitch
            settingKey={SETTING_KEYS.maintenance}
            checked={settings.maintenance}
            label="Maintenance mode"
            description="Pengguna biasa melihat halaman pemberitahuan. Admin tetap bisa masuk dan bekerja."
            confirm={{
              when: true,
              title: "Aktifkan maintenance mode?",
              body: "Semua pengguna biasa dialihkan ke halaman pemeliharaan dan aksi mereka ditolak sampai mode ini dimatikan.",
              action: "Aktifkan Maintenance",
            }}
          />
          <SettingSwitch
            settingKey={SETTING_KEYS.signupEnabled}
            checked={settings.signupEnabled}
            label="Pendaftaran baru"
            description="Bila mati, pendaftaran lewat formulir, API, maupun Google ditolak."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Integrasi</CardTitle>
          <CardDescription>
            Menunjukkan mode yang aktif berdasarkan konfigurasi. Nilai rahasia tidak
            pernah ditampilkan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-border divide-y">
            {integrations.map((i) => (
              <li
                key={i.name}
                className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">{i.name}</p>
                  <p className="text-muted-foreground text-xs">{i.purpose}</p>
                  {i.note ? (
                    <p className="text-muted-foreground text-xs">{i.note}</p>
                  ) : null}
                </div>
                <Badge variant={STATE_VARIANT[i.state]}>{i.state}</Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
