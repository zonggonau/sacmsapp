"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { rollbackDeployment } from "@/actions/deploy.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function RollbackDialog({
  projectId,
  deploymentId,
  versionNumber,
}: {
  projectId: string;
  deploymentId: string;
  versionNumber: number;
}) {
  const [open, setOpen] = useState(false);

  const { execute, isPending } = useAction(rollbackDeployment, {
    onSuccess: () => {
      setOpen(false);
      toast.success(`Mengembalikan ke versi ${versionNumber}. Penerbitan dimulai.`);
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal mengembalikan versi. Silakan coba lagi."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Undo2 className="size-4" />
          Kembalikan
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kembalikan ke versi {versionNumber}?</DialogTitle>
          <DialogDescription>
            Versi {versionNumber} akan diterbitkan ulang dan menggantikan versi yang
            sedang tayang. Website yang sekarang tetap aktif sampai penerbitan selesai,
            dan tidak berubah bila penerbitan gagal.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            type="button"
            disabled={isPending}
            onClick={() => execute({ projectId, deploymentId })}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {isPending ? "Memulai…" : `Terbitkan Versi ${versionNumber}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
