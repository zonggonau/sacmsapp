import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/components/features/auth/auth-card";
import { GoogleButton } from "@/components/features/auth/google-button";
import { SignUpForm } from "@/components/features/auth/sign-up-form";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Daftar",
  robots: { index: false, follow: false },
};

export default function DaftarPage() {
  return (
    <AuthCard
      title="Buat akun SaCMS"
      description="Gratis untuk satu website. Tanpa kartu kredit."
      footer={
        <>
          Sudah punya akun?{" "}
          <Link
            href="/masuk"
            className="text-primary-text font-medium underline-offset-4 hover:underline"
          >
            Masuk
          </Link>
        </>
      }
    >
      <SignUpForm />

      <div className="relative">
        <Separator />
        <span className="bg-background text-muted-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 px-3 text-xs">
          atau
        </span>
      </div>

      <GoogleButton />

      <p className="text-muted-foreground text-center text-xs leading-relaxed">
        Dengan mendaftar, Anda menyetujui{" "}
        <Link href="/legal/syarat" className="underline underline-offset-4">
          Syarat Layanan
        </Link>{" "}
        dan{" "}
        <Link href="/legal/privasi" className="underline underline-offset-4">
          Kebijakan Privasi
        </Link>
        .
      </p>
    </AuthCard>
  );
}
