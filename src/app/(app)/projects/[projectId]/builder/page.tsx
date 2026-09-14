import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BuilderWorkspace } from "@/components/features/builder/builder-workspace";
import { requireUser } from "@/lib/auth-guard";
import { loadProject } from "@/lib/project-loader";
import { getLatestJob } from "@/services/build.service";
import { listMessages, listVersions } from "@/services/project.service";

export const metadata: Metadata = {
  title: "AI Website Builder",
  robots: { index: false, follow: false },
};

export default async function BuilderPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  // Kepemilikan ditegakkan di dalam query (docs/06 §6.7)
  const project = await loadProject(projectId, user.id);
  if (!project) notFound();

  // Ambil data awal secara paralel untuk efisiensi render SSR
  const [latestJob, messages, versions] = await Promise.all([
    getLatestJob(project.id, user.id),
    listMessages(project.id, user.id),
    listVersions(project.id, user.id),
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
