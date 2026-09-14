"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { formAction } from "@/lib/form-action";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn } from "@/actions/auth.actions";

export function SignInForm({ lanjut }: { lanjut?: string }) {
  const { execute, result, isPending } = useAction(signIn, {
    onError: ({ error }) => {
      if (error.serverError) toast.error(error.serverError);
    },
  });

  const errors = result.validationErrors;

  return (
    <form action={formAction(execute)} className="space-y-4">
      {lanjut ? <input type="hidden" name="lanjut" value={lanjut} /> : null}

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
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Kata sandi</Label>
          <Link
            href="/lupa-sandi"
            className="text-primary-text text-sm underline-offset-4 hover:underline"
          >
            Lupa sandi?
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={Boolean(errors?.password)}
          aria-describedby="password-error"
        />
        <FieldError id="password-error" message={errors?.password?._errors?.[0]} />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {isPending ? "Memproses…" : "Masuk"}
      </Button>
    </form>
  );
}
