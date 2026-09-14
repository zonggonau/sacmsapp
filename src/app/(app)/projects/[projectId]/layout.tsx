import { notFound } from "next/navigation";

import { ProjectHeader } from "@/components/features/project/project-header";
import { requireUser } from "@/lib/auth-guard";
import { loadProject } from "@/lib/project-loader";

/**
 * Nested layout project — docs/05 §5.3.
 *
 * Kepemilikan diperiksa SEKALI di sini, di dalam klausa where query. Halaman di
 * bawahnya tinggal memuat project yang sama lewat loadProject() yang ber-cache.
 *
 * Berpindah antar tab tidak merender ulang sidebar, topbar, maupun header ini.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  // Next.js 16: params adalah Promise.
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await loadProject(projectId, user.id);

  // notFound(), BUKAN forbidden(): membalas 403 akan mengonfirmasi bahwa
  // project tersebut ada milik orang lain (docs/12 ancaman A1).
  if (!project) notFound();

  return (
    <div className="space-y-6">
      <ProjectHeader project={project} />
      {children}
    </div>
  );
}
