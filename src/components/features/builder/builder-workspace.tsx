"use client";

import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Eye, History, Loader2, MessageSquare, Sparkles } from "lucide-react";

import { BuildProgress } from "@/components/features/builder/build-progress";
import {
  BuilderChat,
  type ChatMessage,
} from "@/components/features/builder/builder-chat";
import { PreviewFrame } from "@/components/features/builder/preview-frame";
import { StartBuildButton } from "@/components/features/builder/start-build-button";
import { VersionHistory } from "@/components/features/builder/version-history";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLAN_PAGE } from "@/config/quota";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BuildStatus } from "@/services/build.service";
import type { ProjectStatus } from "@/types/db";

interface BuilderProject {
  id: string;
  name: string;
  initialPrompt: string;
  previewUrl: string | null;
  status: ProjectStatus;
  v0ChatId: string | null;
}

interface BuilderWorkspaceProps {
  project: BuilderProject;
  initialJob: BuildStatus | null;
  messages: ChatMessage[];
  versions: Array<{
    id: string;
    number: number;
    summary: string | null;
    createdAt: Date;
    isCurrent: boolean;
  }>;
  /** docs/11 §11.6: alasan generate/edit tidak bisa dijalankan (kredit habis). */
  creditBlocker?: string | null;
}

const TABS = ["chat", "versi"] as const;

/**
 * Ruang kerja Builder — docs/09-AI-BUILDER-PIPELINE.md §9.9 & docs/05 §5.3.
 *
 * Sumber kebenaran keadaan layar adalah JOB TERAKHIR, bukan status project.
 * Status project bisa tertinggal (mis. BUILDING dari job yang macet), sedangkan
 * job selalu punya status akhir yang jujur.
 *
 * Aturan tampilan panel kiri — setiap kombinasi punya satu tampilan:
 *
 *   belum pernah dibangun          -> kartu "Mulai Pembuatan"
 *   ada job, belum ada pratinjau   -> progres penuh (termasuk gagal/batal + Coba Lagi)
 *   ada pratinjau                  -> progres di atas (bila aktif/gagal/batal) + chat
 *
 * Hanya SATU BuildProgress yang dirender, dan diberi `key` id job supaya job
 * baru selalu memulai polling-nya sendiri dari awal.
 */
export function BuilderWorkspace({
  project,
  initialJob,
  messages,
  versions,
  creditBlocker = null,
}: BuilderWorkspaceProps) {
  const router = useRouter();

  // Tab disimpan di URL (docs/05 §5.7), bukan useState — tetap sama saat
  // halaman di-refresh setelah build selesai.
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringLiteral(TABS).withDefault("chat").withOptions({ history: "replace" }),
  );

  const job = initialJob;
  const isActive = job?.status === "QUEUED" || job?.status === "RUNNING";
  const endedBadly = job?.status === "FAILED" || job?.status === "CANCELLED";
  const hasPreview = Boolean(project.previewUrl);
  const neverBuilt = !job && !hasPreview;

  // Distabilkan dengan useCallback: BuildProgress memasukkannya ke dependensi
  // efek polling, dan fungsi baru di setiap render akan memulai ulang interval.
  const handleFinished = useCallback(() => {
    router.refresh();
  }, [router]);

  const progress = job ? (
    <BuildProgress key={job.jobId} initial={job} onFinished={handleFinished} />
  ) : null;

  return (
    <div className="grid min-h-[calc(100vh-14rem)] gap-4 lg:grid-cols-[minmax(0,400px)_1fr] xl:grid-cols-[minmax(0,440px)_1fr]">
      {/* Panel kiri: chat, progres, riwayat */}
      <div className="border-border bg-card flex min-h-[500px] flex-col overflow-hidden rounded-lg border">
        <Tabs
          value={tab}
          onValueChange={(v) => void setTab(v as (typeof TABS)[number])}
          className="flex h-full min-h-0 flex-1 flex-col"
        >
          <div className="border-border flex items-center justify-between border-b px-3 py-2">
            <TabsList variant="line" className="h-8">
              <TabsTrigger
                value="chat"
                className="data-[state=active]:border-primary data-[state=active]:text-primary-text flex items-center gap-1.5 text-xs font-medium"
              >
                <MessageSquare className="size-3.5" />
                Chat AI
              </TabsTrigger>
              <TabsTrigger
                value="versi"
                className="data-[state=active]:border-primary data-[state=active]:text-primary-text flex items-center gap-1.5 text-xs font-medium"
              >
                <History className="size-3.5" />
                Riwayat Versi
                {versions.length > 0 ? (
                  <Badge variant="outline" className="px-1 py-0 font-mono text-[10px]">
                    {versions.length}
                  </Badge>
                ) : null}
              </TabsTrigger>
            </TabsList>

            {isActive ? (
              <span className="text-primary-text inline-flex items-center gap-1.5 font-mono text-xs">
                <Loader2 className="size-3 animate-spin" />
                Membangun…
              </span>
            ) : null}
          </div>

          <TabsContent value="chat" className="m-0 flex min-h-0 flex-1 flex-col p-0">
            {neverBuilt ? (
              <div className="flex flex-1 flex-col justify-center p-6 text-center">
                <Card className="border-border bg-muted/20">
                  <CardHeader className="text-center">
                    <div className="bg-primary-subtle text-primary-text mx-auto grid size-10 place-items-center rounded-full">
                      <Sparkles className="size-5" />
                    </div>
                    <CardTitle className="text-base">Mulai Pembuatan Website</CardTitle>
                    <CardDescription className="text-xs">
                      Permintaan Anda siap diproses.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="border-border bg-background text-muted-foreground rounded border p-3 text-left text-xs leading-relaxed wrap-anywhere whitespace-pre-wrap">
                      {project.initialPrompt}
                    </p>
                    <StartBuildButton
                      projectId={project.id}
                      label="Bangun Sekarang"
                      blocker={creditBlocker}
                    />
                    {creditBlocker ? (
                      <div className="space-y-2">
                        <p className="text-muted-foreground text-xs">{creditBlocker}</p>
                        {/* docs/11 §11.6: batas tercapai → penjelasan + tombol Lihat Paket */}
                        <Button variant="outline" size="sm" asChild>
                          <Link href={PLAN_PAGE}>Lihat Paket</Link>
                        </Button>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {!neverBuilt && !hasPreview ? (
              <div className="flex-1 overflow-y-auto p-4">{progress}</div>
            ) : null}

            {hasPreview ? (
              <div className="flex min-h-0 flex-1 flex-col">
                {/* Progres edit yang sedang berjalan, atau edit terakhir yang
                    gagal/dibatalkan — supaya pesan error dan Coba Lagi terlihat. */}
                {isActive || endedBadly ? (
                  <div className="border-border max-h-[45%] overflow-y-auto border-b p-3">
                    {progress}
                  </div>
                ) : null}

                <BuilderChat
                  projectId={project.id}
                  messages={messages}
                  disabled={isActive || creditBlocker !== null}
                  disabledReason={
                    isActive
                      ? "Proses pembaruan sedang berlangsung…"
                      : (creditBlocker ?? undefined)
                  }
                />
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="versi" className="m-0 min-h-0 flex-1 overflow-y-auto p-0">
            <VersionHistory projectId={project.id} versions={versions} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Panel kanan: pratinjau dalam iframe sandbox */}
      <div className="border-border bg-card flex min-h-[500px] flex-col overflow-hidden rounded-lg border">
        {project.previewUrl ? (
          <PreviewFrame url={project.previewUrl} projectName={project.name} />
        ) : isActive ? (
          <div className="flex flex-1 flex-col items-center justify-center space-y-4 p-8 text-center">
            <div className="bg-primary-subtle grid size-16 place-items-center rounded-full">
              <Sparkles className="text-primary-text size-8 motion-safe:animate-pulse" />
            </div>
            <div className="max-w-sm space-y-2">
              <h3 className="text-base font-semibold">Sedang merancang tampilan…</h3>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Pratinjau akan muncul di sini begitu pemeriksaan hasil selesai.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center space-y-3 p-8 text-center">
            <div className="bg-muted grid size-12 place-items-center rounded-full">
              <Eye className="text-muted-foreground size-6" />
            </div>
            <div className="max-w-xs space-y-1">
              <h3 className="text-sm font-medium">Pratinjau belum tersedia</h3>
              <p className="text-muted-foreground text-xs">
                {endedBadly
                  ? "Pembuatan terakhir tidak selesai. Coba lagi dari panel kiri."
                  : "Mulai proses pembuatan website untuk melihat pratinjaunya di sini."}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
