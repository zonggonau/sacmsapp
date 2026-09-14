import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Potongan UI bersama panel admin. Server Component — tanpa state.
 * Semua status selalu berteks (docs/04 §4.10).
 */

type Variant = "neutral" | "subtle" | "success" | "warning" | "danger" | "default";

const BUILD_STATUS: Record<string, { label: string; variant: Variant }> = {
  QUEUED: { label: "Antre", variant: "neutral" },
  RUNNING: { label: "Berjalan", variant: "subtle" },
  SUCCEEDED: { label: "Berhasil", variant: "success" },
  FAILED: { label: "Gagal", variant: "danger" },
  CANCELLED: { label: "Dibatalkan", variant: "neutral" },
};

const STEP_STATUS: Record<string, { label: string; variant: Variant }> = {
  PENDING: { label: "Menunggu", variant: "neutral" },
  RUNNING: { label: "Berjalan", variant: "subtle" },
  DONE: { label: "Selesai", variant: "success" },
  SKIPPED: { label: "Dilewati", variant: "neutral" },
  FAILED: { label: "Gagal", variant: "danger" },
};

const USER_STATUS: Record<string, { label: string; variant: Variant }> = {
  ACTIVE: { label: "Aktif", variant: "success" },
  SUSPENDED: { label: "Ditangguhkan", variant: "danger" },
};

const ROLE: Record<string, { label: string; variant: Variant }> = {
  USER: { label: "Pengguna", variant: "neutral" },
  ADMIN: { label: "Admin", variant: "subtle" },
  SUPER_ADMIN: { label: "Super Admin", variant: "warning" },
};

function MappedBadge({
  map,
  value,
}: {
  map: Record<string, { label: string; variant: Variant }>;
  value: string;
}) {
  const config = map[value] ?? { label: value, variant: "neutral" as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

export const BuildStatusBadge = ({ status }: { status: string }) => (
  <MappedBadge map={BUILD_STATUS} value={status} />
);
export const StepStatusBadge = ({ status }: { status: string }) => (
  <MappedBadge map={STEP_STATUS} value={status} />
);
export const UserStatusBadge = ({ status }: { status: string }) => (
  <MappedBadge map={USER_STATUS} value={status} />
);
export const RoleBadge = ({ role }: { role: string }) => (
  <MappedBadge map={ROLE} value={role} />
);

export const BUILD_KIND_LABEL: Record<string, string> = {
  INITIAL_GENERATE: "Pembuatan awal",
  EDIT_GENERATE: "Edit prompt",
  DEPLOY: "Deploy",
};

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="text-muted-foreground max-w-2xl text-sm">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Pembungkus tabel: gulir horizontal di layar sempit. */
export function DataTable({
  children,
  minWidth = "40rem",
}: {
  children: React.ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="border-border overflow-x-auto rounded-lg border">
      <table className="w-full text-left text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      scope="col"
      className={cn(
        "bg-muted text-muted-foreground px-3 py-2 text-xs font-medium",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("border-border border-t px-3 py-2.5 align-top", className)}>
      {children}
    </td>
  );
}

export function EmptyRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        colSpan={colSpan}
        className="text-muted-foreground px-3 py-10 text-center text-sm"
      >
        {children}
      </td>
    </tr>
  );
}

/** Pagination kursor: mempertahankan filter, mengganti `cursor`. */
export function Pager({
  basePath,
  params,
  nextCursor,
}: {
  basePath: string;
  params: Record<string, string | undefined>;
  nextCursor: string | null;
}) {
  const hasCursor = Boolean(params.cursor);
  if (!nextCursor && !hasCursor) return null;

  const build = (cursor: string | null) => {
    const search = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (k !== "cursor" && v) search.set(k, v);
    }
    if (cursor) search.set("cursor", cursor);
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex items-center justify-end gap-3 text-sm">
      {hasCursor ? (
        <Link
          href={build(null)}
          className="text-muted-foreground hover:text-foreground"
        >
          Kembali ke halaman pertama
        </Link>
      ) : null}
      {nextCursor ? (
        <Link
          href={build(nextCursor)}
          className="border-border hover:bg-accent rounded-md border px-3 py-1.5 font-medium"
        >
          Halaman berikutnya
        </Link>
      ) : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card space-y-1 rounded-lg border p-4">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className="min-w-0 text-right break-words">{children}</dd>
    </div>
  );
}
