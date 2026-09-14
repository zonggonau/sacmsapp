import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Sparkles } from "lucide-react";

import { ProjectQuickActions } from "@/components/features/project/project-quick-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getWebsiteType } from "@/config/website-types";
import { requireUser } from "@/lib/auth-guard";
import { tanggalWaktu } from "@/lib/format";
import { loadProject } from "@/lib/project-loader";

export const metadata: Metadata = {
  title: "Ringkasan Project",
  robots: { index: false, follow: false },
};

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  // Query yang sama dengan di layout — di-dedupe oleh cache(), jadi hanya satu
  // kali menyentuh database.
  const project = await loadProject(projectId, user.id);
  if (!project) notFound();

  const type = getWebsiteType(project.websiteType);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Permintaan Anda</CardTitle>
            <CardDescription>
              Deskripsi inilah yang akan dipakai AI untuk membangun website.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="bg-muted text-foreground/90 rounded-md p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {project.initialPrompt}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="text-primary-text size-4" />
              Bangun website
            </CardTitle>
            <CardDescription>
              Pembuatan website oleh AI masuk di tahap pengembangan berikutnya.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Button disabled>
              <Sparkles className="size-4" />
              Bangun Sekarang
            </Button>
            <Badge variant="neutral">Tersedia di Fase 3</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detail</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Jenis</dt>
                <dd className="text-right font-medium">{type.label}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Versi</dt>
                <dd className="text-right font-mono tabular-nums">
                  {project.versionCount}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Dibuat</dt>
                <dd className="text-right">{tanggalWaktu(project.createdAt)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Terakhir dibangun</dt>
                <dd className="text-right">
                  {project.lastBuildAt ? tanggalWaktu(project.lastBuildAt) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Terakhir diterbitkan</dt>
                <dd className="text-right">
                  {project.lastDeployAt ? tanggalWaktu(project.lastDeployAt) : "—"}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tindakan cepat</CardTitle>
          </CardHeader>
          <CardContent>
            <ProjectQuickActions projectId={project.id} status={project.status} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
