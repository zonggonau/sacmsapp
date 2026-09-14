import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";

import {
  BUILD_KIND_LABEL,
  BuildStatusBadge,
  DataTable,
  EmptyRow,
  PageHeader,
  Pager,
  Td,
  Th,
} from "@/components/features/admin/admin-ui";
import { Badge } from "@/components/ui/badge";
import { angka, durasi, sejak } from "@/lib/format";
import { cn } from "@/lib/utils";
import { pickParams } from "@/schemas/admin.schema";
import * as adminBuild from "@/services/admin-build.service";

export const metadata: Metadata = { title: "Build" };

const KEYS = ["status", "cursor"] as const;

const filtersSchema = z.object({
  status: z
    .enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"])
    .optional()
    .catch(undefined),
  cursor: z.string().max(100).optional(),
});

const LABELS: Record<string, string> = {
  QUEUED: "Antre",
  RUNNING: "Berjalan",
  SUCCEEDED: "Berhasil",
  FAILED: "Gagal",
  CANCELLED: "Dibatalkan",
};

export default async function AdminBuildsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = pickParams(await searchParams, KEYS);
  const filters = filtersSchema.parse(raw);
  const { items, nextCursor, counts } = await adminBuild.list({
    status: filters.status,
    cursor: filters.cursor || undefined,
  });

  const chips = [
    { value: undefined, label: "Semua" },
    ...adminBuild.BUILD_STATUSES.map((s) => ({ value: s, label: LABELS[s] ?? s })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Build"
        description="Pusat pemecahan masalah. Buka satu build untuk melihat timeline, error mentah, dan prompt yang dikirim."
      />

      <nav className="flex flex-wrap gap-2" aria-label="Filter status build">
        {chips.map((chip) => {
          const active = filters.status === chip.value;
          const count = chip.value ? (counts[chip.value] ?? 0) : null;
          return (
            <Link
              key={chip.label}
              href={chip.value ? `/admin/build?status=${chip.value}` : "/admin/build"}
              aria-current={active ? "page" : undefined}
              className={cn(
                "border-border rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                active
                  ? "bg-primary-subtle text-primary-text border-primary/40"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {chip.label}
              {count !== null ? (
                <span className="ml-1.5 font-mono tabular-nums">{angka(count)}</span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <DataTable minWidth="56rem">
        <thead>
          <tr>
            <Th>Job</Th>
            <Th>Pengguna</Th>
            <Th>Project</Th>
            <Th>Status</Th>
            <Th>Durasi</Th>
            <Th>Percobaan</Th>
            <Th>Dibuat</Th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <EmptyRow colSpan={7}>Tidak ada build dengan status ini.</EmptyRow>
          ) : (
            items.map((b) => (
              <tr key={b.id}>
                <Td>
                  <Link
                    href={`/admin/build/${b.id}`}
                    className="font-mono text-xs hover:underline"
                  >
                    {b.id.slice(0, 10)}…
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {BUILD_KIND_LABEL[b.kind] ?? b.kind}
                  </div>
                </Td>
                <Td className="text-xs break-all">{b.userEmail}</Td>
                <Td>
                  <Link
                    href={`/admin/project/${b.projectId}`}
                    className="text-xs hover:underline"
                  >
                    {b.projectName}
                  </Link>
                </Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <BuildStatusBadge status={b.status} />
                    {b.isSlow ? <Badge variant="warning">Lambat</Badge> : null}
                  </div>
                </Td>
                <Td className="font-mono text-xs tabular-nums">
                  {durasi(b.durationMs)}
                </Td>
                <Td className="font-mono text-xs tabular-nums">
                  {b.attempt}/{b.maxAttempts}
                </Td>
                <Td className="text-muted-foreground text-xs">{sejak(b.createdAt)}</Td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      <Pager basePath="/admin/build" params={raw} nextCursor={nextCursor} />
    </div>
  );
}
