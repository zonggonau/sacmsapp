import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Info } from "lucide-react";

import { AddDomainForm } from "@/components/features/domain/add-domain-form";
import { DnsProviderGuides } from "@/components/features/domain/dns-provider-guides";
import { DomainList } from "@/components/features/domain/domain-list";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guard";
import { loadProject } from "@/lib/project-loader";
import * as domainService from "@/services/domain.service";

import { DomainSkeleton } from "./skeleton";

export const metadata: Metadata = {
  title: "Custom Domain",
  robots: { index: false, follow: false },
};

type Project = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

export default async function ProjectDomainPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  // Kepemilikan diperiksa SEBELUM batas Suspense → status 404 sungguhan.
  const project = await loadProject(projectId, user.id);
  if (!project) notFound();

  return (
    <Suspense fallback={<DomainSkeleton />}>
      <DomainData project={project} userId={user.id} />
    </Suspense>
  );
}

async function DomainData({ project, userId }: { project: Project; userId: string }) {
  const domains = await domainService.list(project.id, userId);

  const pending = domains.some((d) => d.status !== "ACTIVE");

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Custom Domain</h2>
        <p className="text-muted-foreground max-w-xl text-sm">
          Pakai alamat milik Anda sendiri, misalnya{" "}
          <span className="font-mono">sekolahku.sch.id</span>. HTTPS dipasang otomatis
          setelah DNS benar.
        </p>
      </div>

      {project.productionUrl ? (
        <AddDomainForm projectId={project.id} />
      ) : (
        <Alert>
          <Info />
          <AlertTitle>Terbitkan website terlebih dahulu</AlertTitle>
          <AlertDescription>
            <p>Custom domain baru bisa dihubungkan setelah website Anda tayang.</p>
            <Button variant="outline" size="sm" asChild className="mt-2">
              <Link href={`/projects/${project.id}/deployment`}>Buka Deployment</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <DomainList domains={domains} />

      {pending ? <DnsProviderGuides /> : null}
    </div>
  );
}
