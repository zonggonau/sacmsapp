"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Loader2, UserRoundCog } from "lucide-react";
import { toast } from "sonner";

import { stopImpersonation } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";

/**
 * Banner impersonasi — docs/07 §7.5, docs/10 §10.2.
 *
 * WAJIB terlihat di setiap halaman. Super Admin yang lupa sedang menyamar lalu
 * mengubah sesuatu adalah insiden data yang nyata.
 */
export function ImpersonationBanner({
  userName,
  userEmail,
  adminName,
}: {
  userName: string;
  userEmail: string;
  adminName: string;
}) {
  const router = useRouter();

  const { execute, isPending } = useAction(stopImpersonation, {
    onSuccess: ({ data }) => {
      router.push(data ? `/admin/pengguna/${data.userId}` : "/admin");
      router.refresh();
    },
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal kembali ke akun Anda."),
  });

  return (
    <div
      role="alert"
      className="bg-primary text-primary-foreground flex flex-wrap items-center justify-center gap-x-4 gap-y-2 px-4 py-2 text-sm"
    >
      <p className="flex items-center gap-2">
        <UserRoundCog className="size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong>{adminName}</strong>, Anda sedang masuk sebagai{" "}
          <strong>{userName}</strong> ({userEmail}). Tindakan yang merusak diblokir.
        </span>
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={isPending}
        onClick={() => execute()}
        className="border-primary-foreground/50 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground bg-transparent"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
        Kembali ke akun saya
      </Button>
    </div>
  );
}
