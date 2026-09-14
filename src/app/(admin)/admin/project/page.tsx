import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import { AdminFilters } from "@/components/features/admin/admin-filters";
import {
  DataTable,
  EmptyRow,
  PageHeader,
  Pager,
  Td,
  Th,
} from "@/components/features/admin/admin-ui";
import { ProjectStatusBadge } from "@/components/features/project/project-status-badge";
import { getWebsiteType } from "@/config/website-types";
import { angka, tanggal } from "@/lib/format";
import { pickParams } from "@/schemas/admin.schema";
import * as adminProject from "@/services/admin-project.service";

export const metadata: Metadata = { title: "Project" };

const KEYS = ["q", "status", "cursor"] as const;

const filtersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z
    .enum(["DRAFT", "BUILDING", "READY", "LIVE", "FAILED", "ARCHIVED"])
    .optional()
    .catch(undefined),
  cursor: z.string().max(100).optional(),
});

export default async function AdminProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = pickParams(await searchParams, KEYS);
  const filters = filtersSchema.parse(raw);
  const { items, nextCursor } = await adminProject.list({
    q: filters.q || undefined,
    status: filters.status,
    cursor: filters.cursor || undefined,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Project"
        description="Semua project lintas pengguna, termasuk yang dihapus."
      />

      <AdminFilters
        fields={[
          {
            key: "q",
            label: "Cari",
            type: "text",
            placeholder: "Nama project atau email pemilik…",
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "DRAFT", label: "Draf" },
              { value: "BUILDING", label: "Membangun" },
              { value: "READY", label: "Siap" },
              { value: "LIVE", label: "Live" },
              { value: "FAILED", label: "Gagal" },
              { value: "ARCHIVED", label: "Diarsipkan" },
            ],
          },
        ]}
      />

      <DataTable minWidth="48rem">
        <thead>
          <tr>
            <Th>Project</Th>
            <Th>Pemilik</Th>
            <Th>Status</Th>
            <Th className="text-right">Versi</Th>
            <Th className="text-right">Build</Th>
            <Th>Dibuat</Th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <EmptyRow colSpan={6}>Tidak ada project yang cocok.</EmptyRow>
          ) : (
            items.map((p) => (
              <tr key={p.id}>
                <Td>
                  <Link
                    href={`/admin/project/${p.id}`}
                    className="font-medium hover:underline"
                  >
                    {p.name}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {getWebsiteType(p.websiteType).label}
                    {p.deletedAt ? " · dihapus" : ""}
                  </div>
                </Td>
                <Td>
                  <Link
                    href={`/admin/pengguna/${p.user.id}`}
                    className="text-xs break-all hover:underline"
                  >
                    {p.user.email}
                  </Link>
                </Td>
                <Td>
                  <ProjectStatusBadge status={p.status} />
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {angka(p._count.versions)}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {angka(p._count.buildJobs)}
                </Td>
                <Td className="text-muted-foreground text-xs">
                  {tanggal(p.createdAt)}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      <Pager basePath="/admin/project" params={raw} nextCursor={nextCursor} />
    </div>
  );
}
