"use client";

import { useState } from "react";
import { ExternalLink, Monitor, RotateCw, Smartphone, Tablet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const VIEWPORTS = [
  { key: "desktop", label: "Desktop", icon: Monitor, width: "100%" },
  { key: "tablet", label: "Tablet", icon: Tablet, width: "768px" },
  { key: "phone", label: "Ponsel", icon: Smartphone, width: "390px" },
] as const;

type ViewportKey = (typeof VIEWPORTS)[number]["key"];

/**
 * Pratinjau hasil AI — docs/12-KEAMANAN.md §12.5.
 *
 * Hasil generate diperlakukan sebagai SITUS ASING, bukan bagian dari SaCMS:
 * - selalu di dalam iframe ber-`sandbox`,
 * - `referrerPolicy="no-referrer"` supaya URL internal kita tidak ikut terkirim,
 * - tidak pernah dirender inline ke DOM SaCMS.
 *
 * Atribut sandbox sengaja TIDAK memuat `allow-same-origin`: dokumen pratinjau
 * bisa berupa data URI (mode tiruan), dan memberi data URI origin yang sama
 * berarti ia bisa membaca DOM induknya.
 */
export function PreviewFrame({
  url,
  projectName,
}: {
  url: string;
  projectName: string;
}) {
  const [viewport, setViewport] = useState<ViewportKey>("desktop");
  const [reloadKey, setReloadKey] = useState(0);

  const active = VIEWPORTS.find((v) => v.key === viewport) ?? VIEWPORTS[0];
  const isDataUri = url.startsWith("data:");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-border flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <div className="bg-muted flex items-center gap-0.5 rounded-md p-0.5">
          {VIEWPORTS.map((v) => {
            const Icon = v.icon;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setViewport(v.key)}
                aria-label={`Pratinjau ukuran ${v.label}`}
                aria-pressed={viewport === v.key}
                className={cn(
                  "rounded px-2 py-1.5 transition-colors",
                  viewport === v.key
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => setReloadKey((k) => k + 1)}
          aria-label="Muat ulang pratinjau"
        >
          <RotateCw className="size-4" />
        </Button>

        <div className="flex-1" />

        {isDataUri ? (
          <span className="text-muted-foreground font-mono text-[11px]">
            pratinjau tiruan
          </span>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <a href={url} target="_blank" rel="noreferrer noopener">
              Buka di tab baru
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        )}
      </div>

      <div className="bg-muted/40 flex flex-1 justify-center overflow-auto p-3">
        <div
          className="border-border bg-background h-full max-w-full overflow-hidden rounded-md border transition-[width] duration-200"
          style={{ width: active.width }}
        >
          <iframe
            key={reloadKey}
            src={url}
            title={`Pratinjau ${projectName}`}
            sandbox="allow-scripts allow-forms allow-popups"
            referrerPolicy="no-referrer"
            loading="lazy"
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
