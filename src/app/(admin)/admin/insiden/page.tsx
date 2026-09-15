import type { Metadata } from "next";
import Link from "next/link";

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
import * as systemService from "@/services/system.service";

export const metadata: Metadata = { title: "Runbook Insiden" };

/**
 * Runbook insiden — docs/12 §12.7.
 *
 * "Setiap kendali harus bisa dijalankan dari /admin tanpa akses terminal."
 * Halaman ini menyatukan langkah per skenario dengan kendali yang langsung
 * bisa dipakai. Kendalinya sendiri hidup di halaman masing-masing; di sini
 * hanya dipanggil ulang, sehingga aturan & audit tetap satu sumber.
 */

function StepLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-primary-text font-medium hover:underline">
      {children}
    </Link>
  );
}

function Scenario({
  title,
  when,
  children,
}: {
  title: string;
  when: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{when}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal space-y-2 pl-5 text-sm">{children}</ol>;
}

export default async function AdminIncidentPage() {
  const settings = await systemService.getSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Runbook Insiden"
        description="Langkah pertama untuk setiap keadaan darurat. Kerjakan berurutan; setiap tindakan tercatat di audit."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status kendali darurat</CardTitle>
          <CardDescription>
            Dua sakelar ini menghentikan kerusakan paling cepat. Keduanya bisa dimatikan
            lagi kapan saja.
          </CardDescription>
        </CardHeader>
        <CardContent className="divide-border divide-y">
          <SettingSwitch
            settingKey={SETTING_KEYS.aiKillSwitch}
            checked={settings.killSwitch}
            label="Kill switch generate"
            description="Semua build baru ditolak dengan pesan pemeliharaan yang sopan."
            confirm={{
              when: true,
              title: "Nyalakan kill switch?",
              body: "Tidak ada pengguna yang bisa membuat atau mengedit website sampai kill switch dimatikan.",
              action: "Nyalakan Kill Switch",
            }}
          />
          <SettingSwitch
            settingKey={SETTING_KEYS.maintenance}
            checked={settings.maintenance}
            label="Maintenance mode"
            description="Pengguna biasa dialihkan ke halaman pemeliharaan. Admin tetap bisa bekerja."
            confirm={{
              when: true,
              title: "Aktifkan maintenance mode?",
              body: "Semua pengguna biasa dialihkan ke halaman pemeliharaan dan aksi mereka ditolak sampai mode ini dimatikan.",
              action: "Aktifkan Maintenance",
            }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Scenario
          title="1. Kredit AI terkuras tidak wajar"
          when="Biaya v0 melonjak, notifikasi ambang biaya, atau build menumpuk tanpa sebab."
        >
          <Steps>
            <li>
              Nyalakan <strong>kill switch</strong> di atas.{" "}
              {settings.killSwitch ? (
                <Badge variant="warning">sudah menyala</Badge>
              ) : null}
            </li>
            <li>
              Buka{" "}
              <StepLink href="/admin/build?status=RUNNING">
                build yang berjalan
              </StepLink>{" "}
              dan <StepLink href="/admin/build?status=QUEUED">yang mengantre</StepLink>;
              batalkan yang mencurigakan.
            </li>
            <li>
              Temukan pelakunya di <StepLink href="/admin/pengguna">Pengguna</StepLink>,
              lalu <strong>Tangguhkan Akun</strong> dengan alasan tertulis.
            </li>
            <li>Matikan kill switch setelah sumbernya dihentikan.</li>
          </Steps>
        </Scenario>

        <Scenario
          title="2. Kunci API v0 bocor"
          when="Kunci terlihat di repositori, log, tangkapan layar, atau dipakai dari luar."
        >
          <Steps>
            <li>
              Nyalakan <strong>kill switch</strong> selama rotasi berlangsung.
            </li>
            <li>Cabut kunci lama di dasbor v0, lalu terbitkan kunci baru.</li>
            <li>
              Perbarui <code className="font-mono text-xs">V0_API_KEY</code> di Vercel
              (atau{" "}
              <code className="font-mono text-xs">pnpm env:vercel --terapkan</code>),
              lalu redeploy.
            </li>
            <li>
              Pastikan v0 berstatus <em>nyata</em> di{" "}
              <StepLink href="/admin/sistem">Sistem → Integrasi</StepLink>, lalu matikan
              kill switch.
            </li>
          </Steps>
          <p className="text-muted-foreground text-xs">
            Langkah 2–3 dikerjakan di dasbor vendor; kunci tidak pernah ditampilkan atau
            disimpan di panel ini.
          </p>
        </Scenario>

        <Scenario
          title="3. Akun Super Admin disusupi"
          when="Masuk dari lokasi asing, perubahan yang tidak dikenali di audit, atau sandi bocor."
        >
          <Steps>
            <li>
              Buka{" "}
              <StepLink href="/admin/pengguna?role=SUPER_ADMIN">
                daftar Super Admin
              </StepLink>{" "}
              → pilih akun → <strong>Cabut Semua Sesi</strong>.
            </li>
            <li>
              Ganti kata sandi di{" "}
              <StepLink href="/akun/keamanan">Keamanan akun</StepLink>.
            </li>
            <li>
              Periksa tindakan akun itu di{" "}
              <StepLink href="/admin/audit">Audit Log</StepLink> (saring berdasarkan
              email pelaku) dan pulihkan perubahan yang tidak sah.
            </li>
            <li>Bila pelaku memakai akun lain, tangguhkan akun tersebut.</li>
          </Steps>
        </Scenario>

        <Scenario
          title="4. Kebocoran data"
          when="Data pengguna terlihat oleh pihak yang tidak berhak."
        >
          <Steps>
            <li>
              Aktifkan <strong>maintenance mode</strong> di atas.{" "}
              {settings.maintenance ? (
                <Badge variant="warning">sudah aktif</Badge>
              ) : null}
            </li>
            <li>
              Pertahankan bukti:{" "}
              <StepLink href="/admin/audit/ekspor">unduh CSV audit</StepLink> sebelum
              melakukan perubahan apa pun.
            </li>
            <li>
              Tentukan cakupan dari <StepLink href="/admin/audit">Audit Log</StepLink>:
              siapa, data apa, sejak kapan.
            </li>
            <li>
              Beri tahu pengguna yang terdampak secara tertulis, lalu matikan
              maintenance.
            </li>
          </Steps>
        </Scenario>

        <Scenario
          title="5. Hasil AI merusak situs pengguna"
          when="Pengguna melapor situsnya rusak setelah menerbitkan versi baru."
        >
          <Steps>
            <li>
              Cari project di <StepLink href="/admin/project">Project</StepLink> (nama
              atau email pemilik).
            </li>
            <li>
              Di bagian <strong>Deployment &amp; domain</strong>, pilih deployment
              berhasil sebelumnya → <strong>Kembalikan ke versi ini</strong>.
            </li>
            <li>Pantau status hingga READY, lalu buka alamat live untuk memastikan.</li>
            <li>
              Bila build berikutnya juga rusak, periksa{" "}
              <StepLink href="/admin/ai">aturan system prompt</StepLink> yang aktif.
            </li>
          </Steps>
        </Scenario>
      </div>
    </div>
  );
}
