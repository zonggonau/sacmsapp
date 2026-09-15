import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { ProjectCard } from "@/components/features/project/project-card";
import { ProjectFilters } from "@/components/features/project/project-filters";
import { ProjectsEmpty } from "@/components/features/project/projects-empty";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-guard";
import { projectFiltersSchema } from "@/schemas/project.schema";
import * as projectService from "@/services/project.service";
import type { ProjectStatus } from "@/types/db";

export const metadata: Metadata = {
  title: "Project",
  robots: { index: false, follow: false },
};

export default async function ProjectsPage({
  searchParams,
}: {
  // Next.js 16: searchParams adalah Promise.
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const raw = await searchParams;

  // Parameter URL tidak dipercaya — divalidasi lewat skema yang sama dengan
  // parser nuqs di klien (docs/12 §12.4).
  const parsed = projectFiltersSchema.safeParse({
    q: typeof raw.q === "string" ? raw.q : undefined,
    status: typeof raw.status === "string" ? raw.status : undefined,
  });
  const filters = parsed.success
    ? parsed.data
    : { q: undefined, status: "all" as const };

  const { items } = await projectService.listForUser({
    userId: user.id,
    q: filters.q,
    status: filters.status === "all" ? undefined : (filters.status as ProjectStatus),
  });

  const isFiltered = Boolean(filters.q) || filters.status !== "all";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Project</h1>
          <p className="text-muted-foreground text-sm">
            Semua website Anda ada di sini.
          </p>
        </div>

        <Button asChild>
          <Link href="/projects/baru">
            <Sparkles className="size-4" />
            Project Baru
          </Link>
        </Button>
      </div>

      <ProjectFilters />

      {items.length === 0 ? (
        <ProjectsEmpty filtered={isFiltered} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}
