"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import { ProjectStatusBadge } from "@/components/features/project/project-status-badge";
import { Button } from "@/components/ui/button";
import { getWebsiteType } from "@/config/website-types";
import { urlRingkas } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ProjectStatus, WebsiteType } from "@/types/db";

interface HeaderProject {
  id: string;
  name: string;
  websiteType: WebsiteType;
  status: ProjectStatus;
  productionUrl: string | null;
  previewUrl: string | null;
}

/**
 * Header + tab navigasi project.
 *
 * Hanya memuat tab yang fasenya sudah selesai. docs/13-ROADMAP-DAN-FASE.md
 */
export function ProjectHeader({ project }: { project: HeaderProject }) {
  const pathname = usePathname();
  const base = `/projects/${project.id}`;

  const tabs = [
    { label: "Ringkasan", href: base, exact: true },
    { label: "Builder", href: `${base}/builder`, exact: false },
    { label: "Deployment", href: `${base}/deployment`, exact: false },
    { label: "Domain", href: `${base}/domain`, exact: false },
    { label: "Pengaturan", href: `${base}/pengaturan`, exact: false },
  ];

  const type = getWebsiteType(project.websiteType);
  const Icon = type.icon;
  const liveUrl = project.productionUrl ?? project.previewUrl;

  return (
    <div className="border-border space-y-4 border-b pb-0">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
            aria-label="Kembali ke daftar project"
          >
            <Link href="/projects">
              <ArrowLeft className="size-4" />
            </Link>
          </Button>

          <span className="bg-muted mt-0.5 grid size-9 shrink-0 place-items-center rounded-md">
            <Icon className="text-muted-foreground size-4" />
          </span>

          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {project.name}
              </h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="text-muted-foreground text-xs">{type.label}</p>
          </div>
        </div>

        {liveUrl ? (
          <Button variant="outline" size="sm" asChild>
            <a href={liveUrl} target="_blank" rel="noreferrer noopener">
              {urlRingkas(liveUrl)}
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        ) : null}
      </div>

      <nav className="-mb-px flex gap-1 overflow-x-auto" aria-label="Navigasi project">
        {tabs.map((tab) => {
          const active = tab.exact
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "border-primary text-primary-text"
                  : "text-muted-foreground hover:text-foreground border-transparent",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
