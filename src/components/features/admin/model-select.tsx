"use client";

import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import { adminSetDefaultModel } from "@/actions/admin.actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { V0_MODELS, type V0Model } from "@/config/ai-models";

export function ModelSelect({ value }: { value: string | null }) {
  const { execute, isPending } = useAction(adminSetDefaultModel, {
    onSuccess: () => toast.success("Model default diperbarui untuk build berikutnya."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal mengubah model default."),
  });

  return (
    <Select
      value={value ?? undefined}
      disabled={isPending}
      onValueChange={(model) => execute({ model: model as V0Model })}
    >
      <SelectTrigger className="w-full font-mono sm:w-56" aria-label="Model default">
        <SelectValue placeholder="Ikuti paket" />
      </SelectTrigger>
      <SelectContent>
        {V0_MODELS.map((m) => (
          <SelectItem key={m} value={m} className="font-mono">
            {m}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
