"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { DnsRecord } from "@/lib/dns-records";

/**
 * Tabel rekaman DNS dengan tombol salin per nilai — docs/09 §9.10.
 *
 * Nama dan nilai sama-sama bisa disalin: salah ketik satu karakter pada nilai
 * TXT verifikasi sudah cukup membuat domain tidak pernah aktif.
 */
export function DnsRecordsTable({ records }: { records: DnsRecord[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(
        () => setCopied((current) => (current === key ? null : current)),
        2000,
      );
    } catch {
      toast.error("Tidak bisa menyalin otomatis. Salin teksnya secara manual.");
    }
  }

  return (
    <div className="border-border overflow-x-auto rounded-md border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="bg-muted text-muted-foreground text-xs">
          <tr>
            <th scope="col" className="px-3 py-2 font-medium">
              Tipe
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Nama / Host
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Nilai
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {records.map((record, index) => (
            <tr key={`${record.type}-${record.name}-${index}`} className="align-top">
              <td className="px-3 py-2.5 font-mono text-xs font-semibold">
                {record.type}
              </td>
              <td className="px-3 py-2.5">
                <CopyCell
                  text={record.name}
                  copied={copied === `n${index}`}
                  onCopy={() => copy(record.name, `n${index}`)}
                  label={`Salin nama rekaman ${record.type}`}
                />
              </td>
              <td className="px-3 py-2.5">
                <CopyCell
                  text={record.value}
                  copied={copied === `v${index}`}
                  onCopy={() => copy(record.value, `v${index}`)}
                  label={`Salin nilai rekaman ${record.type}`}
                />
                <p className="text-muted-foreground mt-1 text-xs">{record.purpose}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyCell({
  text,
  copied,
  onCopy,
  label,
}: {
  text: string;
  copied: boolean;
  onCopy: () => void;
  label: string;
}) {
  return (
    <div className="flex items-start gap-1">
      <code className="font-mono text-xs break-all">{text}</code>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-6 shrink-0"
        onClick={onCopy}
        aria-label={label}
      >
        {copied ? (
          <Check className="text-success size-3.5" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </Button>
    </div>
  );
}
