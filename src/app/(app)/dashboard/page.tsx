import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Sparkles } from "lucide-react";

import { ProjectCard } from "@/components/features/project/project-card";
import { ProjectsEmpty } from "@/components/features/project/projects-empty";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { requireUser } from "@/lib/auth-guard";
import { angka } from "@/lib/format";
import * as projectService from "@/services/project.service";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

/**
 * Setiap blok mengambil datanya SENDIRI di dalam Suspense-nya sendiri.
 *
 * Mengambil semua data di komponen induk lalu mengoper ke bawah akan
 * menciptakan satu titik tunggu tunggal dan membuang manfaat streaming
 * (docs/05 §5.5).
 */

async function StatsBlock({ userId }: { userId: string }) {
  const stats = await projectService.getStats(userId);

  const tiles = [
    { label: "Total website", value: stats.total },
    { label: "Sedang live", value: stats.live },
    { label: "Sedang dibangun", value: stats.building },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {tiles.map((tile) => (
        <Card key={tile.label}>
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {tile.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-2xl font-semibold tabular-nums">
              {angka(tile.value)}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-28 rounded-lg" />
      ))}
    </div>
  );
}

async function RecentBlock({ userId }: { userId: string }) {
  const projects = await projectService.listRecent(userId, 3);

  if (projects.length === 0) return <ProjectsEmpty filtered={false} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">Project terbaru</h2>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/projects">Lihat semua</Link>
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

function RecentSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export default async function DashboardPage() {
  // getSession dibungkus cache(), jadi ini TIDAK memicu query kedua meskipun
  // layout grup sudah memanggilnya.
  const user = await requireUser();
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="space-y-8">
      {/* Tampil instan — tidak menunggu data apa pun */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight text-balance">
            Selamat datang, {firstName}
          </h1>
          <p className="text-muted-foreground text-sm">Ringkasan website Anda.</p>
        </div>

        <Button asChild>
          <Link href="/projects/baru">
            <Sparkles className="size-4" />
            Project Baru
          </Link>
        </Button>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsBlock userId={user.id} />
      </Suspense>

      <Suspense fallback={<RecentSkeleton />}>
        <RecentBlock userId={user.id} />
      </Suspense>
    </div>
  );
}
