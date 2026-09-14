"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminSetToggle } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { ToggleKey } from "@/config/settings";

/**
 * Sakelar pengaturan global — kill switch, maintenance, pendaftaran.
 *
 * Perubahan yang berdampak ke SEMUA pengguna meminta konfirmasi dengan kalimat
 * yang menyebutkan dampaknya, bukan sekadar "Anda yakin?".
 */
export function SettingSwitch({
  settingKey,
  checked,
  label,
  description,
  confirm,
}: {
  settingKey: ToggleKey;
  checked: boolean;
  label: string;
  description: string;
  /** Konfirmasi saat nilai berubah ke `confirm.when`. */
  confirm?: { when: boolean; title: string; body: string; action: string };
}) {
  const [pendingValue, setPendingValue] = useState<boolean | null>(null);

  const { execute, isPending } = useAction(adminSetToggle, {
    onSuccess: () => {
      setPendingValue(null);
      toast.success(`${label} diperbarui.`);
    },
    onError: ({ error }) => {
      setPendingValue(null);
      toast.error(error.serverError ?? `Gagal mengubah ${label.toLowerCase()}.`);
    },
  });

  function request(next: boolean) {
    if (confirm && confirm.when === next) {
      setPendingValue(next);
      return;
    }
    execute({ key: settingKey, value: next });
  }

  const id = `setting-${settingKey}`;

  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        {isPending ? (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        ) : null}
        <span className="text-muted-foreground w-12 text-right text-xs">
          {checked ? "AKTIF" : "MATI"}
        </span>
        <Switch
          id={id}
          checked={checked}
          disabled={isPending}
          onCheckedChange={request}
        />
      </div>

      {confirm ? (
        <Dialog
          open={pendingValue !== null}
          onOpenChange={(o) => !o && setPendingValue(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{confirm.title}</DialogTitle>
              <DialogDescription>{confirm.body}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPendingValue(null)}>
                Batal
              </Button>
              <Button
                variant="destructive"
                disabled={isPending}
                onClick={() =>
                  pendingValue !== null &&
                  execute({ key: settingKey, value: pendingValue })
                }
              >
                {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {confirm.action}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}
