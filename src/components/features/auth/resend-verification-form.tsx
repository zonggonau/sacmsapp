"use client";

import { useAction } from "next-safe-action/hooks";
import { formAction } from "@/lib/form-action";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resendVerification } from "@/actions/auth.actions";

export function ResendVerificationForm({ email }: { email?: string }) {
  const { execute, result, isPending } = useAction(resendVerification, {
    onSuccess: () => toast.success("Email konfirmasi dikirim ulang."),
    onError: ({ error }) => {
      toast.error(error.serverError ?? "Gagal mengirim ulang. Coba lagi nanti.");
    },
  });

  return (
    <form action={formAction(execute)} className="space-y-4">
      {email ? (
        <input type="hidden" name="email" value={email} />
      ) : (
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="nama@instansi.go.id"
            required
          />
        </div>
      )}

      <Button
        type="submit"
        variant="outline"
        className="w-full"
        disabled={isPending || Boolean(result.data?.sent)}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        {result.data?.sent ? "Terkirim" : "Kirim Ulang Email Konfirmasi"}
      </Button>

      <p className="text-muted-foreground text-center text-xs">
        Bisa dikirim ulang sekali setiap 60 detik.
      </p>
    </form>
  );
}
