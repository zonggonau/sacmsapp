import { ExternalLink, Globe } from "lucide-react";

import { DnsRecordsTable } from "@/components/features/domain/dns-records-table";
import { DomainActions } from "@/components/features/domain/domain-actions";
import { Badge } from "@/components/ui/badge";
import { sejak } from "@/lib/format";
import type { DomainItem } from "@/services/domain.service";
import type { DomainStatus } from "@/types/db";

const STATUS: Record<
  DomainStatus,
  { label: string; variant: "warning" | "subtle" | "success" | "danger" }
> = {
  PENDING_DNS: { label: "Menunggu DNS", variant: "warning" },
  VERIFYING: { label: "Menyiapkan HTTPS", variant: "subtle" },
  ACTIVE: { label: "Aktif", variant: "success" },
  FAILED: { label: "Bermasalah", variant: "danger" },
};

export function DomainList({ domains }: { domains: DomainItem[] }) {
  if (domains.length === 0) {
    return (
      <div className="border-border flex flex-col items-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center">
        <Globe className="text-muted-foreground size-6" />
        <p className="text-sm font-medium">Belum ada custom domain</p>
        <p className="text-muted-foreground max-w-sm text-xs">
          Tanpa custom domain, website Anda tetap bisa dibuka di alamat vercel.app.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {domains.map((domain) => {
        const status = STATUS[domain.status];
        return (
          <li
            key={domain.id}
            className="border-border bg-card space-y-4 rounded-lg border p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {domain.status === "ACTIVE" ? (
                    <a
                      href={`https://${domain.name}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex min-w-0 items-center gap-1 font-mono text-sm font-medium underline-offset-4 hover:underline"
                    >
                      <span className="truncate">{domain.name}</span>
                      <ExternalLink className="size-3 shrink-0" />
                    </a>
                  ) : (
                    <span className="truncate font-mono text-sm font-medium">
                      {domain.name}
                    </span>
                  )}
                  <Badge variant={status.variant}>{status.label}</Badge>
                </div>
                {domain.errorMessage ? (
                  <p className="text-muted-foreground text-xs">{domain.errorMessage}</p>
                ) : null}
                <p className="text-muted-foreground text-xs">
                  {domain.lastCheckedAt
                    ? `Terakhir diperiksa ${sejak(domain.lastCheckedAt)}`
                    : "Belum diperiksa"}
                </p>
              </div>

              <DomainActions
                domainId={domain.id}
                name={domain.name}
                active={domain.status === "ACTIVE"}
              />
            </div>

            {domain.status !== "ACTIVE" && domain.records.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm">
                  Pasang rekaman berikut di panel DNS penyedia domain Anda, lalu tekan{" "}
                  <span className="font-medium">Periksa DNS</span>.
                </p>
                <DnsRecordsTable records={domain.records} />
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
