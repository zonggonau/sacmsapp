"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteProject } from "@/actions/project.actions";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formAction } from "@/lib/form-action";

/**
 * Hapus project dengan konfirmasi ketik-untuk-yakin (docs/10 §10.9).
 *
 * Nama yang diketik dicocokkan ulang DI SERVER. Tombol yang dinonaktifkan di
 * klien hanyalah kenyamanan, bukan pengamanan.
 */
export function DeleteProjectDialog({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const { execute, isPending } = useAction(deleteProject, {
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal menghapus project."),
  });

  const matches = typed.trim() === projectName;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setTyped("");
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="size-4" />
          Hapus Project
        </Button>
      </DialogTrigger>

      <DialogContent>
        <form action={formAction(execute)} className="space-y-5">
          <input type="hidden" name="projectId" value={projectId} />

          <DialogHeader>
            <DialogTitle>Hapus project ini?</DialogTitle>
            <DialogDescription>
              Project akan dihapus beserta seluruh riwayat versi dan pesan AI-nya.
              Website yang sudah diterbitkan tidak akan bisa diakses lagi. Tindakan ini
              tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="confirmName">
              Ketik <span className="text-foreground font-semibold">{projectName}</span>{" "}
              untuk konfirmasi
            </Label>
            <Input
              id="confirmName"
              name="confirmName"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={!matches || isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {isPending ? "Menghapus…" : "Hapus Permanen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
