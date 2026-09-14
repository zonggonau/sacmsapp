"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Tidak bisa menyalin otomatis. Salin teksnya secara manual.");
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="size-7"
      onClick={copy}
      aria-label={label}
    >
      {copied ? (
        <Check className="text-success size-3.5" />
      ) : (
        <Copy className="size-3.5" />
      )}
    </Button>
  );
}
