"use client";

import { useAction } from "next-safe-action/hooks";
import { formAction } from "@/lib/form-action";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfile } from "@/actions/auth.actions";

export function ProfileForm({
  defaultName,
  email,
}: {
  defaultName: string;
  email: string;
}) {
  const { execute, result, isPending } = useAction(updateProfile, {
    onSuccess: () => toast.success("Profil diperbarui."),
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Gagal menyimpan profil.");
    },
  });

  const errors = result.validationErrors;

  return (
    <form action={formAction(execute)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="name">Nama lengkap</Label>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          autoComplete="name"
          required
          aria-invalid={Boolean(errors?.name)}
          aria-describedby="name-error"
        />
        <FieldError id="name-error" message={errors?.name?._errors?.[0]} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          value={email}
          disabled
          readOnly
          aria-describedby="email-hint"
        />
        <p id="email-hint" className="text-muted-foreground text-xs">
          Email tidak bisa diubah sendiri. Hubungi dukungan bila perlu diganti.
        </p>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {isPending ? "Menyimpan…" : "Simpan Perubahan"}
      </Button>
    </form>
  );
}
