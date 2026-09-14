"use client";

import { useRef } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

import { addDomain } from "@/actions/domain.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formAction } from "@/lib/form-action";
import { toastActionError } from "@/lib/notify";

export function AddDomainForm({ projectId }: { projectId: string }) {
  const formRef = useRef<HTMLFormElement>(null);

  const { execute, result, isPending } = useAction(addDomain, {
    onSuccess: ({ data }) => {
      formRef.current?.reset();
      toast.success(
        data?.status === "ACTIVE"
          ? `${data.name} sudah aktif.`
          : `${data?.name ?? "Domain"} ditambahkan. Pasang rekaman DNS di bawah.`,
      );
    },
    onError: ({ error }) => {
      if (error.serverError)
        toastActionError(error.serverError, "Gagal menambahkan domain.");
    },
  });

  const fieldError = result.validationErrors?.domain?._errors?.[0];

  return (
    <form
      ref={formRef}
      action={formAction(execute)}
      className="border-border bg-card space-y-3 rounded-lg border p-4"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <Label htmlFor="domain">Nama domain</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="domain"
          name="domain"
          placeholder="sekolahku.sch.id"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          required
          className="font-mono"
          aria-invalid={Boolean(fieldError)}
          aria-describedby="domain-help"
        />
        <Button type="submit" disabled={isPending} className="shrink-0">
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plus className="size-4" />
          )}
          {isPending ? "Menambahkan…" : "Tambah Domain"}
        </Button>
      </div>
      <p
        id="domain-help"
        className={
          fieldError ? "text-destructive text-xs" : "text-muted-foreground text-xs"
        }
      >
        {fieldError ??
          "Tulis tanpa https://. Untuk www dan tanpa www, tambahkan keduanya satu per satu."}
      </p>
    </form>
  );
}
