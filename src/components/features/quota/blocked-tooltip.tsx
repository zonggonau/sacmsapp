"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Membungkus tombol yang dinonaktifkan karena kuota — docs/11 §11.6.
 *
 * Tombol nonaktif tidak menerima hover maupun fokus, jadi tooltip dipasang pada
 * pembungkus yang bisa difokus. Tanpa alasan (`reason` null), anak dirender apa
 * adanya.
 */
export function BlockedTooltip({
  reason,
  children,
}: {
  reason: string | null | undefined;
  children: React.ReactNode;
}) {
  if (!reason) return <>{children}</>;

  return (
    // Provider lokal: ui/tooltip.tsx tidak memasangnya di Root, dan aplikasi
    // belum punya provider global.
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            tabIndex={0}
            className="inline-flex w-fit rounded-md"
            aria-label={reason}
          >
            {children}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-center">{reason}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
