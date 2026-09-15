import type { Metadata } from "next";

import { PageHeader } from "@/components/features/admin/admin-ui";
import { SettingSwitch } from "@/components/features/admin/setting-switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SETTING_KEYS } from "@/config/settings";
import { V0_APP_MODEL } from "@/config/ai-models";
import * as systemService from "@/services/system.service";

export const metadata: Metadata = { title: "AI & Model" };

export default async function AdminAiPage() {
  const settings = await systemService.getSettings();

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mengikuti v0.app</CardTitle>
          <CardDescription>
            Keputusan ADR-011: hasil website harus sama dengan v0.app.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm">
            <li>
              Prompt pengguna dikirim apa adanya ke v0 — tanpa system prompt, aturan,
              atau template tipe website buatan SaCMS.
            </li>
            <li>
              Model semua build:{" "}
              <span className="text-foreground font-mono">{V0_APP_MODEL}</span> (sama
              dengan &ldquo;Auto&rdquo; di v0.app).
            </li>
            <li>Skills memakai bawaan v0; SaCMS tidak menambahkan skill sendiri.</li>
            <li>
              Prompt yang benar-benar terkirim tetap bisa dilihat di detail setiap
              build.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
