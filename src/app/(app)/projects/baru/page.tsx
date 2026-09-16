import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { CreateProjectForm } from "@/components/features/project/create-project-form";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guard";
import * as quotaService from "@/services/quota.service";

export const metadata: Metadata = {
  title: "Project Baru",
  robots: { index: false, follow: false },
};

/**
 * Halaman penuh "Project Baru".
 *
 * Satu-satunya tampilan untuk membuat project: diklik dari /projects, dibuka
 * dari URL, dibagikan, atau di-refresh — semuanya halaman ini. Dialog yang
 * dicegat sudah dihapus (ADR-013). docs/05 §5.4
 */
export default async function ProjectBaruPage() {
  const user = await requireUser();
  const blockers = await quotaService.getActionBlockers(user.id);

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

      <CreateProjectForm
        quota={
          blockers
            ? {
                creditsLeft: blockers.creditsLeft,
                creditLimit: blockers.creditLimit,
                blocker: blockers.project ?? blockers.credit,
              }
            : null
        }
      />
    </div>
  );
}
