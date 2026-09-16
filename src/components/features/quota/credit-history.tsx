import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { angka, tanggalWaktu } from "@/lib/format";
import type { UsageHistoryItem } from "@/services/usage.service";

/**
 * Riwayat pemakaian kredit di `/akun/paket` — docs/11 §11.6.
 *
 * Menjawab pertanyaan yang paling sering muncul saat kuota menipis: "kredit
 * saya habis untuk apa?". Baris yang dikembalikan (REFUNDED) tetap ditampilkan
 * supaya pengguna melihat bahwa build gagal TIDAK memakan kredit.
 */

const KIND_LABEL: Record<UsageHistoryItem["kind"], string> = {
  AI_GENERATE: "Pembuatan website",
  AI_EDIT: "Perubahan lewat chat",
  DEPLOY: "Penerbitan",
  PROJECT_CREATE: "Project dibuat",
};

const STATE_BADGE: Record<
  UsageHistoryItem["state"],
  { label: string; variant: "subtle" | "neutral" } | null
> = {
  RESERVED: { label: "sedang berjalan", variant: "subtle" },
  REFUNDED: { label: "dikembalikan", variant: "neutral" },
  COMMITTED: null,
};

export function CreditHistory({ items }: { items: UsageHistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Belum ada pemakaian kredit. Setiap pembuatan dan perubahan website akan tercatat
        di sini.
      </p>
    );
  }

  return (
    <ul className="divide-border divide-y">
      {items.map((item) => {
        const badge = STATE_BADGE[item.state];

        return (
          <li
            key={item.id}
            className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-3"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">{KIND_LABEL[item.kind]}</span>
                {badge ? <Badge variant={badge.variant}>{badge.label}</Badge> : null}
              </div>

              <p className="text-muted-foreground truncate text-xs">
                {item.projectId && item.projectName ? (
                  <Link
                    href={`/projects/${item.projectId}`}
                    className="hover:underline"
                  >
                    {item.projectName}
                  </Link>
                ) : item.projectId ? (
                  "Project sudah dihapus"
                ) : (
                  "—"
                )}
              </p>
            </div>

            <div className="shrink-0 space-y-1 text-right">
              <p className="font-mono text-sm tabular-nums">
                {item.credits === 0 ? (
                  <span className="text-muted-foreground">0 kredit</span>
                ) : item.state === "REFUNDED" ? (
                  <span className="text-muted-foreground">
                    +{angka(item.credits)} kredit
                  </span>
                ) : (
                  `−${angka(item.credits)} kredit`
                )}
              </p>
              <p className="text-muted-foreground font-mono text-[11px]">
                {tanggalWaktu(item.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
