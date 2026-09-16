import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BUILD_KIND_LABEL,
  BuildStatusBadge,
  DataTable,
  EmptyRow,
  Field,
  PageHeader,
  RoleBadge,
  Td,
  Th,
  UserStatusBadge,
} from "@/components/features/admin/admin-ui";
import { GrantCreditsForm } from "@/components/features/admin/grant-credits-form";
import { UserAdminActions } from "@/components/features/admin/user-admin-actions";
import { ProjectStatusBadge } from "@/components/features/project/project-status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { angka, durasi, sejak, tanggal, tanggalWaktu } from "@/lib/format";
import * as adminUser from "@/services/admin-user.service";

export const metadata: Metadata = { title: "Investigasi Pengguna" };

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [viewer, detail] = await Promise.all([
    requireSuperAdmin(),
    adminUser.getDetail(userId),
  ]);
  if (!detail) notFound();

  const { user, quota, wallet, lots, projects, builds, audit, plans } = detail;

  return (
    <div className="space-y-6">
      <PageHeader
        title={user.name}
        description={user.email}
        actions={
          <Link
            href="/admin/pengguna"
            className="text-muted-foreground text-sm hover:underline"
          >
            Kembali ke daftar
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profil</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Field label="Peran">
                <RoleBadge role={user.role} />
              </Field>
              <Field label="Status">
                <UserStatusBadge status={user.status} />
              </Field>
              {user.banReason ? <Field label="Alasan">{user.banReason}</Field> : null}
              <Field label="Email">
                {user.emailVerified ? (
                  <Badge variant="success">Terkonfirmasi</Badge>
                ) : (
                  <Badge variant="warning">Belum dikonfirmasi</Badge>
                )}
              </Field>
              <Field label="Terdaftar">{tanggal(user.createdAt)}</Field>
              <Field label="Terakhir masuk">
                {user.lastLoginAt ? sejak(user.lastLoginAt) : "—"}
              </Field>
              <Field label="Sesi aktif">{angka(user.activeSessions)}</Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pemakaian</CardTitle>
          </CardHeader>
          <CardContent>
            {quota ? (
              <dl>
                <Field label="Paket">{quota.planName}</Field>
                <Field label="Kredit">
                  <span className="font-mono tabular-nums">
                    {angka(quota.creditsUsed)} / {angka(quota.creditLimit)}
                  </span>
                  {quota.creditsOverridden ? " (manual)" : ""}
                </Field>
                <Field label="Project">
                  <span className="font-mono tabular-nums">
                    {angka(quota.projectCount)} / {angka(quota.projectLimit)}
                  </span>
                  {quota.projectsOverridden ? " (manual)" : ""}
                </Field>
                <Field label="Deploy hari ini">
                  <span className="font-mono tabular-nums">
                    {angka(quota.deploysToday)} / {angka(quota.deployLimit)}
                  </span>
                </Field>
                <Field label="Periode sejak">{tanggal(quota.periodStartedAt)}</Field>
              </dl>
            ) : null}
            <p className="text-muted-foreground mt-3 text-xs">
              Batas dihitung dari paket saat ini. Penegakan batas aktif di Fase 6.
            </p>
          </CardContent>
        </Card>

        {/* ADR-012: top-up kredit manual ke dompet akun pengguna ini. */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kredit AI</CardTitle>
            <CardDescription>
              Tambahkan kredit setelah pembayaran diterima. Kredit berlaku 12 bulan dan
              dipakai di semua website milik pengguna ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl>
              <Field label="Sisa kredit">
                <span className="font-mono tabular-nums">{angka(wallet.total)}</span>
              </Field>
              <Field label="Segera hangus">
                {wallet.expiringSoon > 0 && wallet.nextExpiry
                  ? `${angka(wallet.expiringSoon)} kredit pada ${tanggal(wallet.nextExpiry)}`
                  : "—"}
              </Field>
              <Field label="Jumlah lot">{angka(lots.length)}</Field>
            </dl>
            <GrantCreditsForm userId={user.id} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tindakan</CardTitle>
          </CardHeader>
          <CardContent>
            <UserAdminActions
              user={{
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                planId: user.planId,
                creditsOverride: user.creditsOverride,
                maxProjectsOverride: user.maxProjectsOverride,
              }}
              plans={plans}
              isSelf={viewer.id === user.id}
            />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Project</h2>
        <DataTable>
          <thead>
            <tr>
              <Th>Nama</Th>
              <Th>Status</Th>
              <Th>Diperbarui</Th>
            </tr>
          </thead>
          <tbody>
            {projects.length === 0 ? (
              <EmptyRow colSpan={3}>Pengguna ini belum punya project.</EmptyRow>
            ) : (
              projects.map((p) => (
                <tr key={p.id}>
                  <Td>
                    <Link
                      href={`/admin/project/${p.id}`}
                      className="font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                    {p.deletedAt ? (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (dihapus)
                      </span>
                    ) : null}
                  </Td>
                  <Td>
                    <ProjectStatusBadge status={p.status} />
                  </Td>
                  <Td className="text-muted-foreground text-xs">
                    {sejak(p.updatedAt)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Build terakhir</h2>
        <DataTable>
          <thead>
            <tr>
              <Th>Project</Th>
              <Th>Jenis</Th>
              <Th>Status</Th>
              <Th>Durasi</Th>
              <Th>Dibuat</Th>
            </tr>
          </thead>
          <tbody>
            {builds.length === 0 ? (
              <EmptyRow colSpan={5}>Belum ada build.</EmptyRow>
            ) : (
              builds.map((b) => (
                <tr key={b.id}>
                  <Td>
                    <Link href={`/admin/build/${b.id}`} className="hover:underline">
                      {b.project.name}
                    </Link>
                  </Td>
                  <Td>{BUILD_KIND_LABEL[b.kind] ?? b.kind}</Td>
                  <Td>
                    <BuildStatusBadge status={b.status} />
                  </Td>
                  <Td className="font-mono text-xs tabular-nums">
                    {durasi(
                      b.startedAt
                        ? (b.finishedAt ?? new Date()).getTime() - b.startedAt.getTime()
                        : null,
                    )}
                  </Td>
                  <Td className="text-muted-foreground text-xs">
                    {tanggalWaktu(b.createdAt)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Riwayat audit</h2>
          <Link
            href={`/admin/audit?targetId=${user.id}`}
            className="text-muted-foreground text-xs hover:underline"
          >
            Lihat semua
          </Link>
        </div>
        <ul className="border-border divide-border divide-y rounded-lg border">
          {audit.length === 0 ? (
            <li className="text-muted-foreground p-4 text-sm">Belum ada catatan.</li>
          ) : (
            audit.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <span className="font-mono text-xs">{a.action}</span>
                <span className="text-muted-foreground text-xs">
                  {a.actor?.email ?? "sistem"} · {tanggalWaktu(a.createdAt)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
