"use client";

import Link from "next/link";
import { useAction } from "next-safe-action/hooks";
import { formAction } from "@/lib/form-action";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { FieldError } from "@/components/features/auth/auth-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { forgotPassword } from "@/actions/auth.actions";

export function ForgotPasswordForm() {
  const { execute, result, isPending } = useAction(forgotPassword, {
    onError: ({ error }) => {
      if (error.serverError) toast.error(error.serverError);
    },
  });

  // Jawaban SELALU sama apakah email terdaftar atau tidak — docs/12 ancaman A9.
  if (result.data?.sent) {
    return (
      <div className="space-y-4">
        <div className="border-border bg-card flex gap-3 rounded-lg border p-4">
          <MailCheck className="text-success mt-0.5 size-5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Cek kotak masuk Anda</p>
            <p className="text-muted-foreground text-sm">
              Kalau email tersebut terdaftar, kami sudah mengirim tautan untuk mengatur
              ulang kata sandi. Tautan berlaku 1 jam.
            </p>
          </div>
        </div>
        <Button asChild variant="outline" className="w-full">
          <Link href="/masuk">Kembali ke halaman masuk</Link>
        </Button>
      </div>
    );
  }

  const errors = result.validationErrors;

  return (
    <form action={formAction(execute)} className="space-y-4">
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

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {isPending ? "Mengirim…" : "Kirim Tautan"}
      </Button>
    </form>
  );
}
