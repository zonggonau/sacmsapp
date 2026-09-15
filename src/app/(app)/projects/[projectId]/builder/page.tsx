import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BuilderWorkspace } from "@/components/features/builder/builder-workspace";
import { requireUser } from "@/lib/auth-guard";
import { loadProject } from "@/lib/project-loader";
import { getLatestJob } from "@/services/build.service";
import { listMessages, listVersions } from "@/services/project.service";

import { BuilderSkeleton } from "./skeleton";

export const metadata: Metadata = {
  title: "AI Website Builder",
  robots: { index: false, follow: false },
};

type Project = NonNullable<Awaited<ReturnType<typeof loadProject>>>;

async function BuilderData({ project, userId }: { project: Project; userId: string }) {
  // Ambil data awal secara paralel untuk efisiensi render SSR
  const [latestJob, messages, versions] = await Promise.all([
    getLatestJob(project.id, userId),
    listMessages(project.id, userId),
    listVersions(project.id, userId),
  ]);

  return (
    <BuilderWorkspace
      project={{
        id: project.id,
        name: project.name,
        initialPrompt: project.initialPrompt,
        previewUrl: project.previewUrl,
        status: project.status,
        v0ChatId: project.v0ChatId,
      }}
      initialJob={latestJob}
      messages={messages}
      versions={versions}
    />
  );
}

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  // Kepemilikan ditegakkan di dalam query (docs/06 §6.7) — SEBELUM batas
  // Suspense, supaya project milik orang lain membalas status 404 sungguhan.
  const project = await loadProject(projectId, user.id);
  if (!project) notFound();

  return (
    <Suspense fallback={<BuilderSkeleton />}>
      <BuilderData project={project} userId={user.id} />
    </Suspense>
  );
}
