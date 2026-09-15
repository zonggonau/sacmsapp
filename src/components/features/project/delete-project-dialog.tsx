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
import { DELETE_CONFIRM_PHRASE } from "@/config/project";
import { formAction } from "@/lib/form-action";

/**
 * Hapus project dengan dua konfirmasi ketik-untuk-yakin (docs/10 §10.9):
 * nama project DAN kalimat "delete my project".
 *
 * Keduanya dicocokkan ulang DI SERVER. Tombol yang dinonaktifkan di klien
 * hanyalah kenyamanan, bukan pengamanan.
 *
 * Dipakai di halaman Pengaturan (dengan tombol pemicu bawaan) dan dari menu
 * titik tiga kartu project (terkendali lewat `open` / `onOpenChange`).
 */
export function DeleteProjectDialog({
  projectId,
  projectName,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  projectId: string;
  projectName: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [typedName, setTypedName] = useState("");
  const [typedPhrase, setTypedPhrase] = useState("");

  const open = controlledOpen ?? internalOpen;
  const setOpen = (next: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(next);
    onOpenChange?.(next);
    if (!next) {
      setTypedName("");
      setTypedPhrase("");
    }
  };

  const { execute, isPending } = useAction(deleteProject, {
    onSuccess: () => toast.success("Project dihapus."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal menghapus project."),
  });

  const nameMatches = typedName.trim() === projectName;
  const phraseMatches = typedPhrase.trim().toLowerCase() === DELETE_CONFIRM_PHRASE;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {hideTrigger ? null : (
        <DialogTrigger asChild>
          <Button variant="destructive">
            <Trash2 className="size-4" />
            Hapus Project
          </Button>
        </DialogTrigger>
      )}

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
            <Label htmlFor={`confirmName-${projectId}`}>
              Ketik <span className="text-foreground font-semibold">{projectName}</span>{" "}
              untuk konfirmasi
            </Label>
            <Input
              id={`confirmName-${projectId}`}
              name="confirmName"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              autoComplete="off"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`confirmPhrase-${projectId}`}>
              Ketik{" "}
              <span className="text-foreground font-mono font-semibold">
                {DELETE_CONFIRM_PHRASE}
              </span>
            </Label>
            <Input
              id={`confirmPhrase-${projectId}`}
              name="confirmPhrase"
              value={typedPhrase}
              onChange={(e) => setTypedPhrase(e.target.value)}
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
              disabled={!nameMatches || !phraseMatches || isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {isPending ? "Menghapus…" : "Hapus"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
