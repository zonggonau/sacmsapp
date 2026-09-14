import { ExternalLink, History } from "lucide-react";

import { RollbackDialog } from "@/components/features/deployment/rollback-dialog";
import { Badge } from "@/components/ui/badge";
import { tanggalWaktu, urlRingkas } from "@/lib/format";
import type { DeploymentItem } from "@/services/deploy.service";
import type { DeploymentStatus } from "@/types/db";

/** Selalu berteks — warna tidak pernah satu-satunya penanda (docs/04 §4.10). */
const STATUS: Record<
  DeploymentStatus,
  { label: string; variant: "neutral" | "subtle" | "success" | "danger" }
> = {
  QUEUED: { label: "Antre", variant: "neutral" },
  BUILDING: { label: "Membangun", variant: "subtle" },
  READY: { label: "Berhasil", variant: "success" },
  ERROR: { label: "Gagal", variant: "danger" },
  CANCELLED: { label: "Dibatalkan", variant: "neutral" },
};

export function DeploymentList({
  projectId,
  deployments,
  canRollback,
}: {
  projectId: string;
  deployments: DeploymentItem[];
  canRollback: boolean;
}) {
  if (deployments.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
        <History className="text-muted-foreground size-6" />
        <p className="text-sm font-medium">Belum ada riwayat penerbitan</p>
        <p className="text-muted-foreground max-w-sm text-xs">
          Setiap kali Anda menerbitkan, hasilnya tercatat di sini — termasuk versi mana
          yang sedang tayang.
        </p>
      </div>
    );
  }

  return (
    <ul className="border-border divide-border divide-y rounded-lg border">
      {deployments.map((d) => {
        const status = STATUS[d.status];
        return (
          <li
            key={d.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {d.versionNumber !== null
                    ? `Versi ${d.versionNumber}`
                    : "Versi terhapus"}
                </span>
                <Badge variant={status.variant}>{status.label}</Badge>
                {d.isLive ? (
                  <Badge variant="outline">
                    <span
                      className="bg-success size-1.5 rounded-full"
                      aria-hidden="true"
                    />
                    Sedang tayang
                  </Badge>
                ) : null}
              </div>

              {d.versionSummary ? (
                <p className="text-muted-foreground line-clamp-1 text-xs">
                  {d.versionSummary}
                </p>
              ) : null}

              {d.errorMessage && (d.status === "ERROR" || d.status === "CANCELLED") ? (
                <p className="text-destructive text-xs">{d.errorMessage}</p>
              ) : null}

              <p className="text-muted-foreground text-xs">
                {tanggalWaktu(d.createdAt)}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {d.status === "READY" &&
              !d.isLive &&
              canRollback &&
              d.versionNumber !== null ? (
                <RollbackDialog
                  projectId={projectId}
                  deploymentId={d.id}
                  versionNumber={d.versionNumber}
                />
              ) : null}
              {d.isLive && d.url ? (
                <a
                  href={d.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="text-foreground inline-flex items-center gap-1 font-mono text-xs underline-offset-4 hover:underline"
                >
                  {urlRingkas(d.url)}
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
