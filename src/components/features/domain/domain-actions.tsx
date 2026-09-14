"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { removeDomain, verifyDomain } from "@/actions/domain.actions";
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

export function DomainActions({
  domainId,
  name,
  active,
}: {
  domainId: string;
  name: string;
  active: boolean;
}) {
  const [open, setOpen] = useState(false);

  const verify = useAction(verifyDomain, {
    onSuccess: ({ data }) => {
      if (data?.status === "ACTIVE") toast.success(`${name} sudah aktif dengan HTTPS.`);
      else
        toast.info(data?.errorMessage ?? "Domain belum siap. Coba periksa lagi nanti.");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal memeriksa DNS."),
  });

  const remove = useAction(removeDomain, {
    onSuccess: () => {
      setOpen(false);
      toast.success(`${name} dilepas dari website ini.`);
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal melepas domain."),
  });

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {active ? null : (
        <Button
          variant="outline"
          size="sm"
          disabled={verify.isPending}
          onClick={() => verify.execute({ domainId })}
        >
          {verify.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {verify.isPending ? "Memeriksa…" : "Periksa DNS"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" aria-label={`Lepas domain ${name}`}>
            <Trash2 className="size-4" />
            Lepas
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lepas {name}?</DialogTitle>
            <DialogDescription>
              Domain ini tidak lagi membuka website Anda. Website tetap bisa diakses di
              alamat vercel.app. Rekaman DNS di penyedia domain tidak dihapus otomatis.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => remove.execute({ domainId })}
            >
              {remove.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {remove.isPending ? "Melepas…" : "Lepas Domain"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
