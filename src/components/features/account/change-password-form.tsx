"use client";

import { useAction } from "next-safe-action/hooks";
import { formAction } from "@/lib/form-action";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { changePassword } from "@/actions/auth.actions";

export function ChangePasswordForm() {
  const { execute, result, isPending } = useAction(changePassword, {
    onSuccess: () =>
      toast.success("Kata sandi diubah. Perangkat lain sudah dikeluarkan."),
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Gagal mengubah kata sandi.");
    },
  });

  const errors = result.validationErrors;

  return (
    <form action={formAction(execute)} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="currentPassword">Kata sandi saat ini</Label>
        <Input
          id="currentPassword"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors?.currentPassword)}
          aria-describedby="current-error"
        />
        <FieldError
          id="current-error"
          message={errors?.currentPassword?._errors?.[0]}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="newPassword">Kata sandi baru</Label>
        <Input
          id="newPassword"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors?.newPassword)}
          aria-describedby="new-error new-hint"
        />
        <FieldError id="new-error" message={errors?.newPassword?._errors?.[0]} />
        <p id="new-hint" className="text-muted-foreground text-xs">
          Minimal 10 karakter.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Ulangi kata sandi baru</Label>
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors?.confirmPassword)}
          aria-describedby="confirm-error"
        />
        <FieldError
          id="confirm-error"
          message={errors?.confirmPassword?._errors?.[0]}
        />
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {isPending ? "Menyimpan…" : "Ubah Kata Sandi"}
      </Button>
    </form>
  );
}
