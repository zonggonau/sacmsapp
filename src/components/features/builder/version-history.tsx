"use client";

import { useAction } from "next-safe-action/hooks";
import { Check, History, Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { restoreVersion } from "@/actions/builder.actions";
import { Button } from "@/components/ui/button";
import { tanggalWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface VersionItem {
  id: string;
  number: number;
  summary: string | null;
  createdAt: Date;
  isCurrent: boolean;
}

/**
 * Riwayat versi — docs/09 §9.9.
 *
 * Memulihkan versi hanya mengubah versi AKTIF dan pratinjau. Production tidak
 * tersentuh sampai pengguna menerbitkan ulang secara sadar — itulah janji
 * "generate tidak pernah otomatis mengubah situs yang sudah hidup".
 */
export function VersionHistory({
  projectId,
  versions,
}: {
  projectId: string;
  versions: VersionItem[];
}) {
  const { execute, isPending } = useAction(restoreVersion, {
    onSuccess: ({ data }) =>
      toast.success(`Versi ${data?.versionNumber ?? ""} dijadikan versi aktif.`),
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal memulihkan versi."),
  });

  if (versions.length === 0) {
    return (
      <p className="text-muted-foreground p-4 text-sm">
        Belum ada versi. Versi pertama dibuat setelah website selesai dibangun.
      </p>
    );
  }

  return (
    <ol className="divide-border divide-y">
      {versions.map((v) => (
        <li key={v.id} className="flex items-start gap-3 p-4">
          <span
            className={cn(
              "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md font-mono text-xs",
              v.isCurrent
                ? "bg-primary text-primary-foreground font-semibold"
                : "bg-muted text-muted-foreground",
            )}
          >
            {v.number}
          </span>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">Versi {v.number}</p>
              {v.isCurrent ? (
                <span className="text-primary-text inline-flex items-center gap-1 text-xs">
                  <Check className="size-3" />
                  aktif
                </span>
              ) : null}
            </div>

            {v.summary ? (
              <p className="text-muted-foreground line-clamp-2 text-xs">{v.summary}</p>
            ) : null}

            <p className="text-muted-foreground font-mono text-[11px]">
              {tanggalWaktu(v.createdAt)}
            </p>
          </div>

          {v.isCurrent ? null : (
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => execute({ projectId, versionId: v.id })}
            >
              {isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Undo2 className="size-3.5" />
              )}
              Pulihkan
            </Button>
          )}
        </li>
      ))}
    </ol>
  );
}

export function VersionHistoryHeader({ count }: { count: number }) {
  return (
    <div className="border-border flex items-center gap-2 border-b px-4 py-3">
      <History className="text-muted-foreground size-4" />
      <h3 className="text-sm font-semibold">Riwayat versi</h3>
      <span className="text-muted-foreground font-mono text-xs">({count})</span>
    </div>
  );
}
