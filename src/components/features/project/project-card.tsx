import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { ProjectStatusBadge } from "@/components/features/project/project-status-badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { getWebsiteType } from "@/config/website-types";
import { sejak, urlRingkas } from "@/lib/format";
import type { ProjectListItem } from "@/services/project.service";

export function ProjectCard({ project }: { project: ProjectListItem }) {
  const type = getWebsiteType(project.websiteType);
  const Icon = type.icon;
  const liveUrl = project.productionUrl ?? project.previewUrl;

  return (
    <Card className="group hover:border-border-strong flex flex-col transition-colors">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-muted grid size-8 shrink-0 place-items-center rounded-md">
              <Icon className="text-muted-foreground size-4" />
            </span>
            <div className="min-w-0">
              {/* Seluruh kartu dapat diklik lewat pseudo-element tautan ini,
                  sementara tautan URL live di footer tetap bisa diklik sendiri. */}
              <Link
                href={`/projects/${project.id}`}
                className="group-hover:text-primary-text block truncate text-sm font-semibold transition-colors"
              >
                {project.name}
              </Link>
              <p className="text-muted-foreground truncate text-xs">{type.label}</p>
            </div>
          </div>
          <ProjectStatusBadge status={project.status} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 pb-3">
        {liveUrl ? (
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="text-primary-text inline-flex max-w-full items-center gap-1.5 font-mono text-xs underline-offset-4 hover:underline"
          >
            <span className="truncate">{urlRingkas(liveUrl)}</span>
            <ExternalLink className="size-3 shrink-0" />
          </a>
        ) : (
          <p className="text-muted-foreground text-xs">Belum diterbitkan</p>
        )}
      </CardContent>

      <CardFooter className="text-muted-foreground border-border border-t pt-3 text-xs">
        Dibuat {sejak(project.createdAt)}
      </CardFooter>
    </Card>
  );
}
