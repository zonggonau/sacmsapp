import type { Metadata } from "next";
import { Download } from "lucide-react";

import { AdminFilters } from "@/components/features/admin/admin-filters";
import { PageHeader, Pager } from "@/components/features/admin/admin-ui";
import { Button } from "@/components/ui/button";
import { tanggalWaktu } from "@/lib/format";
import { auditFiltersSchema, pickParams } from "@/schemas/admin.schema";
import * as auditService from "@/services/audit.service";

export const metadata: Metadata = { title: "Audit Log" };

const KEYS = [
  "action",
  "actor",
  "targetType",
  "targetId",
  "from",
  "to",
  "cursor",
] as const;

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <pre className="bg-muted max-h-72 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
        {value === null || value === undefined ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Audit log — docs/10 §10.8. Append-only: tidak ada tombol hapus, di sini maupun
 * di action mana pun.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = pickParams(await searchParams, KEYS);
  const filters = auditFiltersSchema.parse(raw);
  const { items, nextCursor } = await auditService.list(filters);

  const exportParams = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (k !== "cursor" && v) exportParams.set(k, v);
  }
  const exportHref = `/admin/audit/ekspor${exportParams.size ? `?${exportParams}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Siapa melakukan apa, kapan. Catatan tidak bisa diubah atau dihapus."
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href={exportHref}>
              <Download className="size-4" />
              Ekspor CSV
            </a>
          </Button>
        }
      />

      <AdminFilters
        fields={[
          {
            key: "action",
            label: "Aksi",
            type: "text",
            placeholder: "mis. admin.user",
          },
          { key: "actor", label: "Pelaku", type: "text", placeholder: "Email pelaku…" },
          {
            key: "targetType",
            label: "Target",
            type: "select",
            options: [
              { value: "User", label: "Pengguna" },
              { value: "BuildJob", label: "Build" },
              { value: "Plan", label: "Paket" },
              { value: "SystemSetting", label: "Pengaturan" },
              { value: "Action", label: "Akses ditolak" },
            ],
          },
          { key: "from", label: "Dari tanggal", type: "date" },
          { key: "to", label: "Sampai tanggal", type: "date" },
        ]}
      />

      <ul className="border-border divide-border divide-y rounded-lg border">
        {items.length === 0 ? (
          <li className="text-muted-foreground p-10 text-center text-sm">
            Tidak ada catatan yang cocok.
          </li>
        ) : (
          items.map((row) => (
            <li key={row.id}>
              <details className="group">
                <summary className="flex cursor-pointer flex-col gap-1 px-4 py-3 select-none sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-mono text-xs font-medium">{row.action}</span>
                  <span className="text-muted-foreground text-xs">
                    {row.actorEmail ?? "sistem / akun terhapus"}
                    {row.targetType ? ` → ${row.targetType}` : ""} ·{" "}
                    {tanggalWaktu(row.createdAt)}
                  </span>
                </summary>
                <div className="border-border space-y-3 border-t px-4 py-3">
                  <dl className="text-muted-foreground grid gap-1 text-xs sm:grid-cols-3">
                    <div>Peran: {row.actorRole ?? "—"}</div>
                    <div className="break-all">ID target: {row.targetId ?? "—"}</div>
                    <div>IP: {row.ipAddress ?? "—"}</div>
                  </dl>
                  <div className="grid gap-3 md:grid-cols-2">
                    <Json label="Sebelum" value={row.before} />
                    <Json label="Sesudah" value={row.after} />
                  </div>
                </div>
              </details>
            </li>
          ))
        )}
      </ul>

      <Pager basePath="/admin/audit" params={raw} nextCursor={nextCursor} />
    </div>
  );
}
