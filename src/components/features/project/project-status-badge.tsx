import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/db";

/**
 * Pemetaan status project ke badge — docs/04-DESIGN-SYSTEM.md §4.7.
 *
 * Setiap badge SELALU berteks. Warna tidak pernah menjadi satu-satunya penanda
 * status, karena sekitar 8% pria mengalami buta warna (docs/04 §4.10).
 */
const STATUS_MAP: Record<
  ProjectStatus,
  {
    label: string;
    variant: "neutral" | "subtle" | "success" | "danger";
    pulse?: boolean;
    dot?: boolean;
  }
> = {
  DRAFT: { label: "Draf", variant: "neutral" },
  BUILDING: { label: "Membangun", variant: "subtle", pulse: true },
  READY: { label: "Siap", variant: "subtle" },
  LIVE: { label: "Live", variant: "success", dot: true },
  FAILED: { label: "Gagal", variant: "danger" },
  ARCHIVED: { label: "Diarsipkan", variant: "neutral" },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const config = STATUS_MAP[status];

  return (
    <Badge variant={config.variant}>
      {config.dot || config.pulse ? (
        <span
          className={cn(
            "size-1.5 rounded-full",
            config.variant === "success" ? "bg-success" : "bg-primary",
            config.pulse && "motion-safe:animate-pulse",
          )}
          aria-hidden="true"
        />
      ) : null}
      {config.label}
    </Badge>
  );
}

export function projectStatusLabel(status: ProjectStatus) {
  return STATUS_MAP[status].label;
}
