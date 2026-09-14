import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateProjectForm } from "@/components/features/project/create-project-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guard";

export const metadata: Metadata = {
  title: "Project Baru",
  robots: { index: false, follow: false },
};

/**
 * Halaman penuh "Project Baru".
 *
 * Dipakai saat URL dibuka langsung, di-refresh, atau dibagikan. Dari /projects,
 * rute yang sama ditampilkan sebagai dialog lewat @modal/(.)baru — dengan
 * komponen form yang SAMA. docs/05 §5.4
 */
export default async function ProjectBaruPage() {
  await requireUser();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="space-y-3">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/projects">
            <ArrowLeft className="size-4" />
            Kembali ke daftar
          </Link>
        </Button>

        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Project baru</h1>
          <p className="text-muted-foreground text-sm">
            Pilih jenis website, lalu ceritakan apa yang Anda inginkan.
          </p>
        </div>
      </div>

      <CreateProjectForm />
    </div>
  );
}
