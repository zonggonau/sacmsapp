"use client";

import { useMemo, useTransition } from "react";
import { parseAsString, useQueryStates } from "nuqs";
import { Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterField =
  | { key: string; label: string; type: "text" | "date"; placeholder?: string }
  | {
      key: string;
      label: string;
      type: "select";
      options: Array<{ value: string; label: string }>;
    };

/** Radix Select tidak menerima nilai kosong; ini penanda "semua". */
const ALL = "__semua";

/**
 * Filter panel admin — state di URL lewat nuqs (docs/10 §10.4, docs/05 §5.7).
 * Mengubah filter apa pun mengosongkan kursor pagination.
 */
export function AdminFilters({ fields }: { fields: FilterField[] }) {
  const [isPending, startTransition] = useTransition();

  const parsers = useMemo(
    () =>
      Object.fromEntries(
        [...fields.map((f) => f.key), "cursor"].map((k) => [
          k,
          parseAsString.withDefault(""),
        ]),
      ),
    [fields],
  );

  const [values, setValues] = useQueryStates(parsers, {
    shallow: false,
    startTransition,
    history: "replace",
    throttleMs: 400,
  });

  const set = (key: string, value: string) =>
    void setValues({ [key]: value || null, cursor: null });

  const active = fields.some((f) => values[f.key]);

  return (
    <div className="flex flex-col flex-wrap gap-2 sm:flex-row sm:items-center">
      {fields.map((field) =>
        field.type === "select" ? (
          <Select
            key={field.key}
            value={values[field.key] || ALL}
            onValueChange={(v) => set(field.key, v === ALL ? "" : v)}
          >
            <SelectTrigger className="sm:w-44" aria-label={field.label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{field.label}: semua</SelectItem>
              {field.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            key={field.key}
            type={field.type}
            value={values[field.key] ?? ""}
            onChange={(e) => set(field.key, e.target.value)}
            placeholder={field.placeholder ?? field.label}
            aria-label={field.label}
            className={field.type === "date" ? "sm:w-44" : "sm:w-64"}
          />
        ),
      )}

      {isPending ? (
        <Loader2 className="text-muted-foreground size-4 animate-spin" />
      ) : null}

      {active ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            void setValues(
              Object.fromEntries([
                ...fields.map((f) => [f.key, null]),
                ["cursor", null],
              ]),
            )
          }
        >
          <X className="size-4" />
          Bersihkan
        </Button>
      ) : null}
    </div>
  );
}
