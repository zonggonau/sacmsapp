"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminRollbackDeployment } from "@/actions/admin.actions";
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

/**
 * Runbook "hasil AI merusak situs pengguna" — docs/12 §12.7.
 *
 * Super Admin menerbitkan ulang versi yang pernah berhasil, atas nama pemilik
 * project. Seluruh penjagaan deploy (satu penerbitan aktif, batas harian)
 * tetap berlaku di service.
 */
export function AdminRollbackButton({
  projectId,
  deploymentId,
  createdAtLabel,
}: {
  projectId: string;
  deploymentId: string;
  createdAtLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const { execute, isPending } = useAction(adminRollbackDeployment, {
    onSuccess: () => {
      setOpen(false);
      toast.success(
        "Versi lama sedang diterbitkan ulang. Pantau statusnya di daftar ini.",
      );
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal mengembalikan versi. Coba lagi."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Kembalikan ke versi ini
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kembalikan situs ke versi ini?</DialogTitle>
          <DialogDescription>
            Versi yang terbit pada {createdAtLabel} diterbitkan ulang menggantikan versi
            yang sedang tayang. Pemilik project tetap bisa menerbitkan versi lain
            sesudahnya. Tindakan ini dicatat di audit.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            variant="destructive"
            disabled={isPending}
            onClick={() => execute({ projectId, deploymentId })}
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Kembalikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
