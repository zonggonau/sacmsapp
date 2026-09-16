"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { deleteOwnAccount } from "@/actions/account.actions";
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
import { ACCOUNT_DELETE_PHRASE } from "@/config/account";
import { formAction } from "@/lib/form-action";

/**
 * Hapus akun sendiri — docs/12 §12.6.
 *
 * Dua konfirmasi ketik-untuk-yakin (email akun + kalimat baku), sama seperti
 * hapus project. Keduanya dicocokkan ulang di server; tombol nonaktif di klien
 * hanya kenyamanan.
 */
export function DeleteAccountDialog({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [typedEmail, setTypedEmail] = useState("");
  const [typedPhrase, setTypedPhrase] = useState("");

  const { execute, isPending } = useAction(deleteOwnAccount, {
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal menghapus akun."),
  });

  const emailMatches = typedEmail.trim().toLowerCase() === email.toLowerCase();
  const phraseMatches = typedPhrase.trim().toLowerCase() === ACCOUNT_DELETE_PHRASE;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTypedEmail("");
          setTypedPhrase("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="size-4" />
          Hapus Akun Saya
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <form action={formAction(execute)} className="space-y-5">
          <DialogHeader>
            <DialogTitle>Hapus akun ini secara permanen?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>Begitu dihapus, hal berikut terjadi dan tidak bisa dibatalkan:</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Semua project, versi, dan percakapan AI Anda dihapus.</li>
                  <li>Website yang sudah terbit diturunkan dan alamatnya mati.</li>
                  <li>Sisa kredit hangus dan tidak bisa dipindahkan.</li>
                  <li>Anda keluar dari semua perangkat saat itu juga.</li>
                </ul>
                <p>
                  Catatan pembukuan dan jejak audit tetap disimpan tanpa identitas Anda,
                  sesuai kewajiban hukum.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {/* Email ditaruh di barisnya sendiri: alamat panjang membuat label
                satu baris terbelah dan sulit dibaca. */}
            <Label htmlFor="confirmEmail" className="block space-y-1">
              <span className="block">Ketik email akun ini untuk konfirmasi:</span>
              <span className="text-foreground block font-mono text-xs break-all">
                {email}
              </span>
            </Label>
            <Input
              id="confirmEmail"
              name="confirmEmail"
              value={typedEmail}
              onChange={(e) => setTypedEmail(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPhrase">
              Ketik{" "}
              <span className="text-foreground font-mono font-semibold">
                {ACCOUNT_DELETE_PHRASE}
              </span>
            </Label>
            <Input
              id="confirmPhrase"
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
              disabled={!emailMatches || !phraseMatches || isPending}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              {isPending ? "Menghapus…" : "Hapus Akun"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
