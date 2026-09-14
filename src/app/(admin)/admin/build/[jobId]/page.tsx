import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  BUILD_KIND_LABEL,
  BuildStatusBadge,
  Field,
  PageHeader,
  StepStatusBadge,
} from "@/components/features/admin/admin-ui";
import { BuildAdminActions } from "@/components/features/admin/build-admin-actions";
import { CopyButton } from "@/components/features/admin/copy-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { durasi, tanggalWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";
import * as adminBuild from "@/services/admin-build.service";

export const metadata: Metadata = { title: "Detail Build" };

function TextBlock({
  title,
  description,
  value,
  empty,
  open,
}: {
  title: string;
  description?: string;
  value: string | null;
  empty: string;
  open?: boolean;
}) {
  return (
    <details className="border-border group rounded-lg border" open={open}>
      <summary className="flex cursor-pointer items-center justify-between gap-3 px-4 py-3 text-sm font-medium select-none">
        <span>
          {title}
          {description ? (
            <span className="text-muted-foreground ml-2 text-xs font-normal">
              {description}
            </span>
          ) : null}
        </span>
        {value ? (
          <CopyButton value={value} label={`Salin ${title.toLowerCase()}`} />
        ) : null}
      </summary>
      <div className="border-border border-t p-4">
        {value ? (
          <pre className="bg-muted max-h-[28rem] overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
            {value}
          </pre>
        ) : (
          <p className="text-muted-foreground text-sm">{empty}</p>
        )}
      </div>
    </details>
  );
}

export default async function AdminBuildDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  const job = await adminBuild.getDetail(jobId);
  if (!job) notFound();

  const longest = Math.max(1, ...job.steps.map((s) => s.durationMs ?? 0));
  const notRecorded =
    "Tidak tercatat — build ini dibuat sebelum pencatatan prompt aktif (Fase 5).";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Build ${BUILD_KIND_LABEL[job.kind] ?? job.kind}`}
        description={`${job.project.name} · ${job.project.user.email}`}
        actions={
          <>
            <BuildAdminActions jobId={job.id} status={job.status} />
            <Link
              href="/admin/build"
              className="text-muted-foreground self-center text-sm hover:underline"
            >
              Kembali ke daftar
            </Link>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Informasi</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Field label="Status">
                <BuildStatusBadge status={job.status} />
              </Field>
              <Field label="correlationId">
                <span className="inline-flex items-center gap-1 font-mono text-xs">
                  <span className="break-all">{job.correlationId}</span>
                  <CopyButton value={job.correlationId} label="Salin correlationId" />
                </span>
              </Field>
              <Field label="ID job">
                <span className="font-mono text-xs break-all">{job.id}</span>
              </Field>
              <Field label="Model">{job.model ?? "—"}</Field>
              <Field label="Percobaan">
                {job.attempt}/{job.maxAttempts}
              </Field>
              <Field label="Durasi">{durasi(job.durationMs)}</Field>
              <Field label="Dibuat">{tanggalWaktu(job.createdAt)}</Field>
              <Field label="Mulai">
                {job.startedAt ? tanggalWaktu(job.startedAt) : "—"}
              </Field>
              <Field label="Selesai">
                {job.finishedAt ? tanggalWaktu(job.finishedAt) : "—"}
              </Field>
              <Field label="Project">
                <Link
                  href={`/admin/project/${job.project.id}`}
                  className="hover:underline"
                >
                  {job.project.name}
                </Link>
              </Field>
              <Field label="Pengguna">
                <Link
                  href={`/admin/pengguna/${job.project.user.id}`}
                  className="hover:underline"
                >
                  {job.project.user.name}
                </Link>
              </Field>
            </dl>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Timeline langkah</CardTitle>
            <CardDescription>
              Batang menunjukkan durasi relatif — langkah yang lambat langsung terlihat.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3">
              {job.steps.map((s) => (
                <li key={s.key} className="space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground w-5 font-mono text-xs tabular-nums">
                        {s.order}
                      </span>
                      {s.label}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-muted-foreground font-mono text-xs tabular-nums">
                        {durasi(s.durationMs)}
                      </span>
                      <StepStatusBadge status={s.status} />
                    </span>
                  </div>
                  <div className="bg-muted ml-7 h-1.5 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        s.status === "FAILED"
                          ? "bg-destructive"
                          : "bg-muted-foreground/50",
                      )}
                      style={{
                        width: `${Math.max(2, ((s.durationMs ?? 0) / longest) * 100)}%`,
                      }}
                    />
                  </div>
                  {s.detail ? (
                    <p className="text-muted-foreground ml-7 text-xs break-words">
                      {s.detail}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>

      {job.errorCode || job.rawError ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-base">Kegagalan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl>
              <Field label="Kode">{job.errorCode ?? "—"}</Field>
              <Field label="Pesan untuk pengguna">{job.errorMessage ?? "—"}</Field>
            </dl>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">rawError</p>
                {job.rawError ? (
                  <CopyButton value={job.rawError} label="Salin rawError" />
                ) : null}
              </div>
              <pre className="bg-muted max-h-80 overflow-auto rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
                {job.rawError ?? "Tidak ada error mentah."}
              </pre>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Prompt</h2>
        <TextBlock
          title="Prompt pengguna"
          description="apa adanya, sebelum disanitasi"
          value={job.prompt}
          empty="—"
          open
        />
        <TextBlock
          title="Pesan terkirim ke v0"
          value={job.sentMessage}
          empty={notRecorded}
        />
        <TextBlock
          title="System prompt"
          description="rahasia — tidak pernah terlihat pengguna"
          value={job.systemPrompt}
          empty={notRecorded}
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Pemakaian kredit</h2>
        <ul className="border-border divide-border divide-y rounded-lg border text-sm">
          {job.usageEvents.length === 0 ? (
            <li className="text-muted-foreground p-4">Tidak ada catatan kredit.</li>
          ) : (
            job.usageEvents.map((u) => (
              <li
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
              >
                <span className="font-mono text-xs">
                  {u.kind} · {u.credits} kredit
                </span>
                <span className="text-muted-foreground text-xs">
                  {u.state} · {tanggalWaktu(u.createdAt)}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  );
}
