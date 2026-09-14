"use client";

import { useAction } from "next-safe-action/hooks";
import { Archive, ArchiveRestore, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  archiveProject,
  duplicateProject,
  unarchiveProject,
} from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import type { ProjectStatus } from "@/types/db";

export function ProjectQuickActions({
  projectId,
  status,
}: {
  projectId: string;
  status: ProjectStatus;
}) {
  const dup = useAction(duplicateProject, {
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal menduplikasi."),
  });

  const arc = useAction(archiveProject, {
    onSuccess: () => toast.success("Project diarsipkan."),
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal mengarsipkan."),
  });

  const unarc = useAction(unarchiveProject, {
    onSuccess: () => toast.success("Project dikeluarkan dari arsip."),
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal memulihkan."),
  });

  const archived = status === "ARCHIVED";
  const busy = dup.isPending || arc.isPending || unarc.isPending;

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => dup.execute({ projectId })}
      >
        {dup.isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Copy className="size-4" />
        )}
        Duplikat
      </Button>

      {archived ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => unarc.execute({ projectId })}
        >
          {unarc.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArchiveRestore className="size-4" />
          )}
          Keluarkan dari Arsip
        </Button>
      ) : (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => arc.execute({ projectId })}
        >
          {arc.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Archive className="size-4" />
          )}
          Arsipkan
        </Button>
      )}
    </div>
  );
}
