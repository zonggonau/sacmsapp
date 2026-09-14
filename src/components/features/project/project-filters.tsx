"use client";

import { useTransition } from "react";
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Loader2, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUSES = [
  "all",
  "DRAFT",
  "BUILDING",
  "READY",
  "LIVE",
  "FAILED",
  "ARCHIVED",
] as const;

const STATUS_LABELS: Record<(typeof STATUSES)[number], string> = {
  all: "Semua status",
  DRAFT: "Draf",
  BUILDING: "Membangun",
  READY: "Siap",
  LIVE: "Live",
  FAILED: "Gagal",
  ARCHIVED: "Diarsipkan",
};

/**
 * Filter tersimpan di URL lewat nuqs, BUKAN useState — docs/05 §5.7.
 *
 * Akibatnya: hasil filter bisa dibagikan dan di-bookmark, tombol Back berfungsi,
 * dan halaman daftarnya tetap Server Component.
 */
export function ProjectFilters() {
  const [isPending, startTransition] = useTransition();

  const [{ q, status }, setFilters] = useQueryStates(
    {
      q: parseAsString.withDefault(""),
      status: parseAsStringLiteral(STATUSES).withDefault("all"),
    },
    {
      // shallow:false => server mengambil ulang data sesuai filter baru
      shallow: false,
      startTransition,
      // Filter tidak menumpuk riwayat peramban; hanya pencarian yang berarti
      history: "replace",
      throttleMs: 400,
    },
  );

  const hasFilter = q !== "" || status !== "all";

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={q}
          onChange={(e) => void setFilters({ q: e.target.value || null })}
          placeholder="Cari nama project…"
          className="pl-9"
          aria-label="Cari project"
        />
        {isPending ? (
          <Loader2 className="text-muted-foreground absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
        ) : null}
      </div>

      <Select
        value={status}
        onValueChange={(value) =>
          void setFilters({ status: value === "all" ? null : (value as typeof status) })
        }
      >
        <SelectTrigger className="sm:w-48" aria-label="Filter status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilter ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void setFilters({ q: null, status: null })}
        >
          <X className="size-4" />
          Bersihkan
        </Button>
      ) : null}
    </div>
  );
}
