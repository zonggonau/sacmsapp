import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { AuthCard } from "@/components/features/auth/auth-card";
import { ResetPasswordForm } from "@/components/features/auth/reset-password-form";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Atur Kata Sandi",
  robots: { index: false, follow: false },
};

export default async function AturSandiPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <AuthCard title="Tautan tidak berlaku">
        <div className="border-border bg-card flex gap-3 rounded-lg border p-4">
          <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" />
          <p className="text-muted-foreground text-sm">
            Tautan atur ulang kata sandi sudah kedaluwarsa atau sudah pernah dipakai.
            Tautan hanya berlaku 1 jam dan sekali pakai.
          </p>
        </div>
        <Button asChild className="w-full">
          <Link href="/lupa-sandi">Minta Tautan Baru</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Atur kata sandi baru"
      description="Pilih kata sandi yang belum pernah Anda pakai di layanan lain."
    >
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
