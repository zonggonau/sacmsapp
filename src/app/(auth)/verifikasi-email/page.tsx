import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";

import { AuthCard } from "@/components/features/auth/auth-card";
import { ResendVerificationForm } from "@/components/features/auth/resend-verification-form";

export const metadata: Metadata = {
  title: "Konfirmasi Email",
  robots: { index: false, follow: false },
};

export default async function VerifikasiEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <AuthCard
      title="Cek email Anda"
      description={
        email ? (
          <>
            Kami mengirim tautan konfirmasi ke{" "}
            <span className="text-foreground font-medium">{email}</span>. Klik tautan
            itu untuk mengaktifkan akun Anda.
          </>
        ) : (
          "Kami mengirim tautan konfirmasi ke email Anda. Klik tautan itu untuk mengaktifkan akun."
        )
      }
      footer={
        <>
          Sudah dikonfirmasi?{" "}
          <Link
            href="/masuk"
            className="text-primary-text font-medium underline-offset-4 hover:underline"
          >
            Masuk
          </Link>
        </>
      }
    >
      <div className="border-border bg-card flex gap-3 rounded-lg border p-4">
        <MailCheck className="text-primary-text mt-0.5 size-5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Tautan berlaku 1 jam</p>
          <p className="text-muted-foreground text-sm">
            Tidak menemukan emailnya? Periksa folder spam atau promosi.
          </p>
        </div>
      </div>

      <ResendVerificationForm email={email} />
    </AuthCard>
  );
}
