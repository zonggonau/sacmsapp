import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/features/auth/auth-card";
import { ForgotPasswordForm } from "@/components/features/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Lupa Kata Sandi",
  robots: { index: false, follow: false },
};

export default function LupaSandiPage() {
  return (
    <AuthCard
      title="Lupa kata sandi"
      description="Masukkan email Anda. Kami kirimkan tautan untuk mengatur ulang kata sandi."
      footer={
        <>
          Ingat kata sandi Anda?{" "}
          <Link
            href="/masuk"
            className="text-primary-text font-medium underline-offset-4 hover:underline"
          >
            Masuk
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
