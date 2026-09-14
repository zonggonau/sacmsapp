"use client";

import { useAction } from "next-safe-action/hooks";
import { formAction } from "@/lib/form-action";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp } from "@/actions/auth.actions";

export function SignUpForm() {
  const { execute, result, isPending } = useAction(signUp, {
    onError: ({ error }) => {
      if (error.serverError) toast.error(error.serverError);
    },
  });

  const errors = result.validationErrors;

  return (
    <form action={formAction(execute)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nama lengkap</Label>
        <Input
          id="name"
          name="name"
          autoComplete="name"
          placeholder="Budi Santoso"
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
          name="email"
          type="email"
          autoComplete="email"
          placeholder="nama@instansi.go.id"
          required
          aria-invalid={Boolean(errors?.email)}
          aria-describedby="email-error"
        />
        <FieldError id="email-error" message={errors?.email?._errors?.[0]} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Kata sandi</Label>
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

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {isPending ? "Membuat akun…" : "Buat Akun"}
      </Button>
    </form>
  );
}
