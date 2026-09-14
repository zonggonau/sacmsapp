"use client";

import { useMemo, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { adminRestoreRules, adminSaveRules } from "@/actions/admin.actions";
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
import { Textarea } from "@/components/ui/textarea";
import { tanggalWaktu } from "@/lib/format";
import { diffLines, hasChanges } from "@/lib/text-diff";
import { cn } from "@/lib/utils";
import type { RuleVersion } from "@/services/system.service";

/**
 * Editor aturan system prompt — docs/10 §10.7.
 *
 * "Kendali paling tajam di sistem": perubahan buruk merusak SEMUA hasil generate
 * berikutnya. Karena itu simpan hanya bisa lewat pratinjau diff, setiap simpan
 * menjadi versi baru, dan versi lama bisa dikembalikan kapan saja.
 */
export function RulesEditor({ versions }: { versions: RuleVersion[] }) {
  const current = versions[versions.length - 1]!;
  const [text, setText] = useState(current.text);
  const [reviewing, setReviewing] = useState(false);

  const diff = useMemo(() => diffLines(current.text, text), [current.text, text]);
  const changed = hasChanges(diff);

  const save = useAction(adminSaveRules, {
    onSuccess: () => {
      setReviewing(false);
      toast.success(
        "Aturan disimpan sebagai versi baru. Berlaku untuk build berikutnya.",
      );
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal menyimpan aturan."),
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">
            Blok ATURAN{" "}
            <span className="text-muted-foreground font-normal">
              · versi aktif {current.version}
            </span>
          </p>
          {changed && !reviewing ? (
            <Button variant="ghost" size="sm" onClick={() => setText(current.text)}>
              Buang perubahan
            </Button>
          ) : null}
        </div>
        <Textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setReviewing(false);
          }}
          rows={12}
          className="font-mono text-xs"
          aria-label="Aturan system prompt"
        />
        <p className="text-muted-foreground text-xs">
          Hanya blok ATURAN yang bisa diubah. Kerangka teknologi, spesifikasi, dan
          pembatas prompt pengguna dikunci di kode demi keamanan.
        </p>
      </div>

      {reviewing ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">Pratinjau perubahan</p>
          <pre className="border-border max-h-96 overflow-auto rounded-md border font-mono text-xs">
            {diff.map((line, i) => (
              <div
                key={i}
                className={cn(
                  "px-3 py-0.5 whitespace-pre-wrap",
                  line.kind === "added" && "bg-success/15 text-success",
                  line.kind === "removed" &&
                    "bg-destructive/15 text-destructive line-through",
                )}
              >
                {line.kind === "added" ? "+ " : line.kind === "removed" ? "- " : "  "}
                {line.text || " "}
              </div>
            ))}
          </pre>
          <div className="flex flex-wrap gap-2">
            <Button disabled={save.isPending} onClick={() => save.execute({ text })}>
              {save.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Simpan sebagai Versi {current.version + 1}
            </Button>
            <Button variant="outline" onClick={() => setReviewing(false)}>
              Kembali mengedit
            </Button>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          disabled={!changed}
          onClick={() => setReviewing(true)}
        >
          Tinjau Perubahan
        </Button>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">Riwayat versi</p>
        <ul className="border-border divide-border divide-y rounded-lg border">
          {[...versions].reverse().map((v) => (
            <li
              key={v.version}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
            >
              <span>
                <span className="font-mono">v{v.version}</span>
                <span className="text-muted-foreground ml-2 text-xs">
                  {v.createdById === null ? "aturan bawaan" : tanggalWaktu(v.createdAt)}
                  {v.restoredFrom !== null
                    ? ` · dikembalikan dari v${v.restoredFrom}`
                    : ""}
                </span>
              </span>
              {v.version === current.version ? (
                <span className="text-muted-foreground text-xs">aktif</span>
              ) : (
                <RestoreButton version={v.version} />
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RestoreButton({ version }: { version: number }) {
  const [open, setOpen] = useState(false);
  const restore = useAction(adminRestoreRules, {
    onSuccess: () => {
      setOpen(false);
      toast.success(`Aturan v${version} dikembalikan sebagai versi baru.`);
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal mengembalikan versi."),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Undo2 className="size-4" />
          Kembalikan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kembalikan aturan versi {version}?</DialogTitle>
          <DialogDescription>
            Isi versi {version} disimpan sebagai versi baru dan langsung dipakai build
            berikutnya. Riwayat tidak dihapus.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button
            disabled={restore.isPending}
            onClick={() => restore.execute({ version })}
          >
            {restore.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            Kembalikan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
