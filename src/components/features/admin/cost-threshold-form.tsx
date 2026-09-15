"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminSetDailyCostThreshold } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { rupiah } from "@/lib/format";

/**
 * Ambang biaya vendor harian — docs/10 §10.3 & §10.7.
 * Melewati ambang → kill switch menyala OTOMATIS (docs/09 §9.11). 0 = nonaktif.
 */
export function CostThresholdForm({ valueIdr }: { valueIdr: number }) {
  const [value, setValue] = useState(String(valueIdr));
  const { execute, isPending, result } = useAction(adminSetDailyCostThreshold, {
    onSuccess: () => toast.success("Ambang biaya harian disimpan."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal menyimpan ambang biaya."),
  });
  const fieldError = result.validationErrors?.valueIdr?._errors?.[0];

  return (
    <form
      className="flex flex-col gap-3 py-3 sm:flex-row sm:items-start sm:justify-between"
      onSubmit={(e) => {
        e.preventDefault();
        execute({ valueIdr: Number(value) });
      }}
    >
      <div className="space-y-0.5">
        <label htmlFor="ambang-biaya" className="text-sm font-medium">
          Ambang biaya harian
        </label>
        <p className="text-muted-foreground text-xs">
          Biaya vendor sehari melewati angka ini → kill switch menyala otomatis dan
          Super Admin diberi notifikasi. Saat ini:{" "}
          {valueIdr > 0 ? rupiah(valueIdr) : "nonaktif"}. Isi 0 untuk menonaktifkan.
        </p>
        {fieldError ? <p className="text-destructive text-xs">{fieldError}</p> : null}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground text-sm">Rp</span>
        <Input
          id="ambang-biaya"
          type="number"
          min={0}
          step={1000}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-40 font-mono"
        />
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
          Simpan
        </Button>
      </div>
    </form>
  );
}
