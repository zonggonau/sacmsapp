import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CalendarClock, ExternalLink, Globe } from "lucide-react";

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
import { sejak, tanggal, urlRingkas } from "@/lib/format";
import { loadProject } from "@/lib/project-loader";
import * as deployService from "@/services/deploy.service";
import * as quotaService from "@/services/quota.service";
import * as subscriptionService from "@/services/subscription.service";

import { DeploymentSkeleton } from "./skeleton";

export const metadata: Metadata = {
  title: "Deployment",
  robots: { index: false, follow: false },
};

type Project = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

export default async function ProjectDeploymentPage({
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
    <Suspense fallback={<DeploymentSkeleton />}>
      <DeploymentData project={project} userId={user.id} />
    </Suspense>
  );
}

async function DeploymentData({
  project,
  userId,
}: {
  project: Project;
  userId: string;
}) {
  const [data, blockers, subscription] = await Promise.all([
    deployService.getPageData(project.id, userId),
    quotaService.getActionBlockers(userId),
    subscriptionService.getForProject(project.id, userId),
  ]);
  if (!data) notFound();

  // ADR-012: tanpa Paket Project aktif, penerbitan ditolak di service. Tombol
  // tetap terlihat tetapi nonaktif dengan alasannya (docs/11 §11.6).
  const paketBlocker =
    subscription === null
      ? "Website ini belum punya Paket Project. Hubungi admin untuk mengaktifkannya."
      : subscription.status === "EXPIRED" || subscription.status === "CANCELLED"
        ? `Paket Project website ini berakhir pada ${tanggal(subscription.endsAt)}. Perpanjang untuk menerbitkan lagi.`
        : null;

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
          blocker={paketBlocker ?? data.blocker ?? blockers?.deploy ?? data.alreadyLive}
        />
      </div>

      {data.active ? (
        <DeploymentProgress key={data.active.id} initial={data.active} />
      ) : null}

      <Card className={subscription?.inGrace ? "border-primary/40" : undefined}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarClock className="text-muted-foreground size-4" />
            Paket Project
          </CardTitle>
          <CardDescription>
            {subscription === null
              ? "Belum aktif. Website bisa dibangun di Builder, tetapi belum bisa diterbitkan."
              : subscription.inGrace
                ? `Paket ${subscription.planName} berakhir ${tanggal(subscription.endsAt)} dan sedang dalam masa tenggang. Website diturunkan pada ${tanggal(subscription.takedownAt)} bila tidak diperpanjang.`
                : subscription.status === "ACTIVE"
                  ? `Paket ${subscription.planName} aktif sampai ${tanggal(subscription.endsAt)} (${subscription.daysLeft} hari lagi).`
                  : `Paket ${subscription.planName} sudah tidak aktif sejak ${tanggal(subscription.endsAt)}.`}
          </CardDescription>
        </CardHeader>
      </Card>

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
