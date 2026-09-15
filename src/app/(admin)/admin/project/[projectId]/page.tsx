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
  Td,
  Th,
} from "@/components/features/admin/admin-ui";
import { AdminRollbackButton } from "@/components/features/admin/admin-rollback-button";
import { CopyButton } from "@/components/features/admin/copy-button";
import { ProjectStatusBadge } from "@/components/features/project/project-status-badge";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getWebsiteType } from "@/config/website-types";
import { angka, tanggalWaktu, urlRingkas } from "@/lib/format";
import * as adminProject from "@/services/admin-project.service";

export const metadata: Metadata = { title: "Detail Project" };

function VendorId({ label, value }: { label: string; value: string | null }) {
  return (
    <Field label={label}>
      {value ? (
        <span className="inline-flex items-center gap-1 font-mono text-xs">
          <span className="break-all">{value}</span>
          <CopyButton value={value} label={`Salin ${label}`} />
        </span>
      ) : (
        "—"
      )}
    </Field>
  );
}

export default async function AdminProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const p = await adminProject.getDetail(projectId);
  if (!p) notFound();

  // Deployment terbaru yang berhasil = yang sedang tayang (daftar urut terbaru).
  const liveDeploymentId = p.deployments.find((d) => d.status === "READY")?.id;

  return (
    <div className="space-y-6">
      <PageHeader
        title={p.name}
        description={`${getWebsiteType(p.websiteType).label} · milik ${p.user.email}`}
        actions={
          <Link
            href="/admin/project"
            className="text-muted-foreground text-sm hover:underline"
          >
            Kembali ke daftar
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ringkasan</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Field label="Status">
                <ProjectStatusBadge status={p.status} />
              </Field>
              {p.deletedAt ? (
                <Field label="Dihapus">{tanggalWaktu(p.deletedAt)}</Field>
              ) : null}
              <Field label="Pemilik">
                <Link href={`/admin/pengguna/${p.user.id}`} className="hover:underline">
                  {p.user.name}
                </Link>
              </Field>
              <Field label="Kredit dihabiskan">{angka(p.creditsSpent)}</Field>
              <Field label="Alamat live">
                {p.productionUrl ? (
                  <a
                    href={p.productionUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="font-mono text-xs hover:underline"
                  >
                    {urlRingkas(p.productionUrl)}
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="Dibuat">{tanggalWaktu(p.createdAt)}</Field>
              <Field label="Terakhir dibangun">
                {p.lastBuildAt ? tanggalWaktu(p.lastBuildAt) : "—"}
              </Field>
              <Field label="Terakhir terbit">
                {p.lastDeployAt ? tanggalWaktu(p.lastDeployAt) : "—"}
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pengenal vendor</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <VendorId label="ID project" value={p.id} />
              <VendorId label="v0 project" value={p.v0ProjectId} />
              <VendorId label="v0 chat" value={p.v0ChatId} />
              <VendorId label="Vercel project" value={p.vercelProjectId} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Permintaan awal</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="bg-muted rounded-md p-3 text-sm whitespace-pre-wrap">
            {p.initialPrompt}
          </p>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Seluruh versi</h2>
        <DataTable>
          <thead>
            <tr>
              <Th>Versi</Th>
              <Th>Ringkasan</Th>
              <Th>v0 version</Th>
              <Th>Dibuat</Th>
            </tr>
          </thead>
          <tbody>
            {p.versions.length === 0 ? (
              <EmptyRow colSpan={4}>Belum ada versi.</EmptyRow>
            ) : (
              p.versions.map((v) => (
                <tr key={v.id}>
                  <Td className="font-mono">
                    {v.number}
                    {v.id === p.currentVersionId ? (
                      <Badge variant="subtle" className="ml-2">
                        aktif
                      </Badge>
                    ) : null}
                  </Td>
                  <Td className="text-xs">{v.summary ?? "—"}</Td>
                  <Td className="font-mono text-xs break-all">
                    {v.v0VersionId ?? "—"}
                  </Td>
                  <Td className="text-muted-foreground text-xs">
                    {tanggalWaktu(v.createdAt)}
                  </Td>
                </tr>
              ))
            )}
          </tbody>
        </DataTable>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Build terakhir</h2>
          <DataTable minWidth="24rem">
            <thead>
              <tr>
                <Th>Jenis</Th>
                <Th>Status</Th>
                <Th>Dibuat</Th>
              </tr>
            </thead>
            <tbody>
              {p.buildJobs.length === 0 ? (
                <EmptyRow colSpan={3}>Belum ada build.</EmptyRow>
              ) : (
                p.buildJobs.map((b) => (
                  <tr key={b.id}>
                    <Td>
                      <Link href={`/admin/build/${b.id}`} className="hover:underline">
                        {BUILD_KIND_LABEL[b.kind] ?? b.kind}
                      </Link>
                    </Td>
                    <Td>
                      <BuildStatusBadge status={b.status} />
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
          <h2 className="text-sm font-semibold">Deployment & domain</h2>
          <ul className="border-border divide-border divide-y rounded-lg border text-sm">
            {p.deployments.length === 0 && p.domains.length === 0 ? (
              <li className="text-muted-foreground p-4">Belum pernah diterbitkan.</li>
            ) : null}
            {p.deployments.map((d) => (
              <li key={d.id} className="space-y-1 px-4 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-xs">
                    {d.status}
                    {d.id === liveDeploymentId ? (
                      <Badge variant="success" className="ml-2">
                        tayang
                      </Badge>
                    ) : null}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {tanggalWaktu(d.createdAt)}
                  </span>
                </div>
                {d.status === "READY" && d.id !== liveDeploymentId && !p.deletedAt ? (
                  <AdminRollbackButton
                    projectId={p.id}
                    deploymentId={d.id}
                    createdAtLabel={tanggalWaktu(d.createdAt)}
                  />
                ) : null}
                {d.vercelDeploymentId ? (
                  <p className="text-muted-foreground font-mono text-xs break-all">
                    {d.vercelDeploymentId}
                  </p>
                ) : null}
                {d.errorMessage ? (
                  <p className="text-destructive text-xs">{d.errorMessage}</p>
                ) : null}
              </li>
            ))}
            {p.domains.map((d) => (
              <li key={d.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="font-mono text-xs">{d.name}</span>
                <span className="text-muted-foreground text-xs">{d.status}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
