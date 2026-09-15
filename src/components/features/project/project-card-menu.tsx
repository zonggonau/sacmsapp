"use client";

import { useState } from "react";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import {
  Archive,
  ArchiveRestore,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  archiveProject,
  duplicateProject,
  unarchiveProject,
} from "@/actions/project.actions";
import { DeleteProjectDialog } from "@/components/features/project/delete-project-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toastActionError } from "@/lib/notify";
import type { ProjectStatus } from "@/types/db";

/**
 * Menu titik tiga pada kartu project.
 *
 * Dialog hapus dirender DI LUAR menu dan dibuka setelah menu tertutup — dialog
 * yang ditanam di dalam dropdown ikut hilang saat dropdown menutup.
 */
export function ProjectCardMenu({
  projectId,
  projectName,
  status,
  liveUrl,
}: {
  projectId: string;
  projectName: string;
  status: ProjectStatus;
  liveUrl: string | null;
}) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const archived = status === "ARCHIVED";

  const dup = useAction(duplicateProject, {
    onError: ({ error }) => toastActionError(error.serverError, "Gagal menduplikasi."),
  });
  const arc = useAction(archiveProject, {
    onSuccess: () => toast.success("Project diarsipkan."),
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal mengarsipkan."),
  });
  const unarc = useAction(unarchiveProject, {
    onSuccess: () => toast.success("Project dikeluarkan dari arsip."),
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal memulihkan."),
  });

  const busy = dup.isPending || arc.isPending || unarc.isPending;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="relative z-10 size-8"
            aria-label={`Tindakan untuk ${projectName}`}
            disabled={busy}
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem asChild>
            <Link href={`/projects/${projectId}`}>
              <ExternalLink className="size-4" />
              Buka
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/projects/${projectId}/builder`}>
              <Sparkles className="size-4" />
              Builder
            </Link>
          </DropdownMenuItem>
          {liveUrl ? (
            <DropdownMenuItem asChild>
              <a href={liveUrl} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="size-4" />
                Buka website
              </a>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href={`/projects/${projectId}/pengaturan`}>
              <Settings className="size-4" />
              Pengaturan
            </Link>
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={() => dup.execute({ projectId })}>
            <Copy className="size-4" />
            Duplikat
          </DropdownMenuItem>
          {archived ? (
            <DropdownMenuItem onSelect={() => unarc.execute({ projectId })}>
              <ArchiveRestore className="size-4" />
              Keluarkan dari arsip
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onSelect={() => arc.execute({ projectId })}>
              <Archive className="size-4" />
              Arsipkan
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <DropdownMenuItem variant="destructive" onSelect={() => setDeleteOpen(true)}>
            <Trash2 className="size-4" />
            Hapus
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteProjectDialog
        projectId={projectId}
        projectName={projectName}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        hideTrigger
      />
    </>
  );
}
