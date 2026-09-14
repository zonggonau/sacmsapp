import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLink, Globe } from "lucide-react";

import { DeployButton } from "@/components/features/deployment/deploy-button";
import { DeploymentList } from "@/components/features/deployment/deployment-list";
import { DeploymentProgress } from "@/components/features/deployment/deployment-progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser } from "@/lib/auth-guard";
import { sejak, urlRingkas } from "@/lib/format";
import { loadProject } from "@/lib/project-loader";
import * as deployService from "@/services/deploy.service";

export const metadata: Metadata = {
  title: "Deployment",
  robots: { index: false, follow: false },
};

export default async function ProjectDeploymentPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  const [project, data] = await Promise.all([
    loadProject(projectId, user.id),
    deployService.getPageData(projectId, user.id),
  ]);
  if (!project || !data) notFound();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight">Deployment</h2>
          <p className="text-muted-foreground max-w-xl text-sm">
            Terbitkan website Anda ke internet. Website yang sedang tayang tidak
            terganggu selama proses berjalan, dan tetap aktif bila penerbitan gagal.
          </p>
        </div>
        <DeployButton
          projectId={project.id}
          versionNumber={data.nextVersionNumber}
          blocker={data.blocker}
        />
      </div>

      {data.active ? (
        <DeploymentProgress key={data.active.id} initial={data.active} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Globe className="text-muted-foreground size-4" />
            Alamat website
          </CardTitle>
          <CardDescription>
            {project.productionUrl
              ? "Alamat ini bisa dibuka siapa saja, dari perangkat apa pun."
              : "Website Anda belum pernah diterbitkan."}
          </CardDescription>
        </CardHeader>
        {project.productionUrl ? (
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <a
              href={project.productionUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-primary-text inline-flex min-w-0 items-center gap-1.5 font-mono text-sm underline-offset-4 hover:underline"
            >
              <span className="truncate">{urlRingkas(project.productionUrl)}</span>
              <ExternalLink className="size-3.5 shrink-0" />
            </a>
            {project.lastDeployAt ? (
              <span className="text-muted-foreground text-xs">
                Diterbitkan {sejak(project.lastDeployAt)}
              </span>
            ) : null}
          </CardContent>
        ) : null}
      </Card>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Riwayat penerbitan</h3>
        <DeploymentList
          projectId={project.id}
          deployments={data.deployments}
          canRollback={data.blocker === null}
        />
      </section>
    </div>
  );
}
