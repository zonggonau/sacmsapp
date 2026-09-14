"use client";

import { useAction } from "next-safe-action/hooks";
import { formAction } from "@/lib/form-action";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPassword } from "@/actions/auth.actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const { execute, result, isPending } = useAction(resetPassword, {
    onError: ({ error }) => {
      if (error.serverError) toast.error(error.serverError);
    },
  });

  const errors = result.validationErrors;

  return (
    <form action={formAction(execute)} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="password">Kata sandi baru</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          aria-invalid={Boolean(errors?.password)}
          aria-describedby="password-error password-hint"
        />
        <FieldError id="password-error" message={errors?.password?._errors?.[0]} />
        <p id="password-hint" className="text-muted-foreground text-xs">
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

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {isPending ? "Menyimpan…" : "Simpan Kata Sandi"}
      </Button>

      <p className="text-muted-foreground text-xs">
        Menyimpan kata sandi baru akan mengeluarkan Anda dari semua perangkat lain.
      </p>
    </form>
  );
}
