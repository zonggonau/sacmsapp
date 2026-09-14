import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { AuthCard } from "@/components/features/auth/auth-card";
import { GoogleButton } from "@/components/features/auth/google-button";
import { SignInForm } from "@/components/features/auth/sign-in-form";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Masuk",
  robots: { index: false, follow: false },
};

export default async function MasukPage({
  searchParams,
}: {
  // Next.js 16: searchParams adalah Promise dan wajib di-await.
  searchParams: Promise<{ lanjut?: string; sandi?: string }>;
}) {
  const { lanjut, sandi } = await searchParams;

  return (
    <AuthCard
      title="Masuk ke SaCMS"
      description="Lanjutkan membuat website Anda."
      footer={
        <>
          Belum punya akun?{" "}
          <Link
            href="/daftar"
            className="text-primary-text font-medium underline-offset-4 hover:underline"
          >
            Daftar gratis
          </Link>
        </>
      }
    >
      {sandi === "berhasil" ? (
        <div className="border-success/30 bg-success/10 flex gap-3 rounded-lg border p-3">
          <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
          <p className="text-sm">
            Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru Anda.
          </p>
        </div>
      ) : null}

      <SignInForm lanjut={lanjut} />

      <div className="relative">
        <Separator />
        <span className="bg-background text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 text-xs">
          atau
        </span>
      </div>

      <GoogleButton lanjut={lanjut} />
    </AuthCard>
  );
}
