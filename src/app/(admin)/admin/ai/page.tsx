import type { Metadata } from "next";

import { PageHeader } from "@/components/features/admin/admin-ui";
import { ModelSelect } from "@/components/features/admin/model-select";
import { RulesEditor } from "@/components/features/admin/rules-editor";
import { SettingSwitch } from "@/components/features/admin/setting-switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SETTING_KEYS } from "@/config/settings";
import * as systemService from "@/services/system.service";

export const metadata: Metadata = { title: "AI & Model" };

export default async function AdminAiPage() {
  const [settings, versions] = await Promise.all([
    systemService.getSettings(),
    systemService.getRuleVersions(),
  ]);
  const latest = versions[versions.length - 1]?.version ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI & Model"
        description="Kendali mesin pembuat website. Semua perubahan tercatat di audit."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kendali mesin</CardTitle>
        </CardHeader>
        <CardContent className="divide-border divide-y">
          <SettingSwitch
            settingKey={SETTING_KEYS.aiKillSwitch}
            checked={settings.killSwitch}
            label="Kill switch generate"
            description="Semua build baru ditolak dengan pesan pemeliharaan yang sopan. Job yang mengantre dihentikan."
            confirm={{
              when: true,
              title: "Nyalakan kill switch?",
              body: "Tidak ada pengguna yang bisa membuat atau mengedit website sampai kill switch dimatikan.",
              action: "Nyalakan Kill Switch",
            }}
          />
          <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-0.5">
              <p className="text-sm font-medium">Model default</p>
              <p className="text-muted-foreground text-xs">
                Dipakai bila diizinkan paket pengguna; bila tidak, model pertama paket
                dipakai. Model per paket diatur di halaman Paket.
              </p>
            </div>
            <ModelSelect value={settings.defaultModel} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aturan system prompt</CardTitle>
          <CardDescription>
            Perubahan buruk di sini merusak semua hasil generate berikutnya. Setiap
            simpan menjadi versi baru dan bisa dikembalikan.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* key = versi aktif: editor dimuat ulang setelah simpan atau kembalikan */}
          <RulesEditor key={latest} versions={versions} />
        </CardContent>
      </Card>
    </div>
  );
}
