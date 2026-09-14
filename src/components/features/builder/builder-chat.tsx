"use client";

import { useEffect, useOptimistic, useRef, useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { ArrowUp, Bot, Loader2, User } from "lucide-react";
import { toast } from "sonner";

import { sendBuilderMessage } from "@/actions/builder.actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { tanggalWaktu } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: Date;
}

/**
 * Chat builder — docs/09 §9.9, docs/05 §5.6.
 *
 * Pesan pengguna muncul SEKETIKA lewat useOptimistic, sebelum server menjawab.
 * Tanpa itu, jeda 2–4 menit membuat layar terasa seperti tidak menerima input.
 *
 * Isi pesan dirender sebagai teks biasa dengan `whitespace-pre-wrap`, BUKAN
 * HTML. Balasan AI adalah konten tidak dipercaya (docs/02 §2.6).
 */
export function BuilderChat({
  projectId,
  messages,
  disabled,
  disabledReason,
}: {
  projectId: string;
  messages: ChatMessage[];
  disabled: boolean;
  disabledReason?: string;
}) {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const [optimistic, addOptimistic] = useOptimistic(
    messages,
    (current, pending: string) => [
      ...current,
      {
        id: `optimistic-${Date.now()}`,
        role: "USER" as const,
        content: pending,
        createdAt: new Date(),
      },
    ],
  );

  const { execute, isPending } = useAction(sendBuilderMessage, {
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal mengirim pesan."),
  });

  // Auto-scroll ke pesan terbaru. Dijalankan setelah daftar berubah, bukan
  // sinkron di badan efek, jadi tidak memicu render berantai.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [optimistic.length]);

  function submit() {
    const text = draft.trim();
    if (text.length < 5 || disabled || isPending) return;

    addOptimistic(text);
    execute({ projectId, message: text });
    setDraft("");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {optimistic.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Belum ada percakapan. Setelah website dibangun, Anda bisa menyempurnakannya
            dari sini.
          </p>
        ) : (
          optimistic.map((m) => <Bubble key={m.id} message={m} />)
        )}
        <div ref={endRef} />
      </div>

      <div className="border-border border-t p-3">
        {disabled ? (
          <p className="text-muted-foreground px-1 py-2 text-xs">
            {disabledReason ?? "Kirim pesan tersedia setelah website dibangun."}
          </p>
        ) : (
          <div className="relative">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter mengirim, Shift+Enter baris baru — kebiasaan yang sudah
                // dikenal dari aplikasi pesan.
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={3}
              maxLength={4000}
              placeholder="Contoh: Tambahkan halaman transparansi anggaran dengan tabel APBD dan tombol unduh PDF."
              className="pr-12"
              aria-label="Permintaan perubahan"
            />
            <Button
              type="button"
              size="icon"
              onClick={submit}
              disabled={draft.trim().length < 5 || isPending}
              className="absolute right-2 bottom-2"
              aria-label="Kirim permintaan"
            >
              {isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "USER";

  return (
    <div className={cn("flex gap-3", isUser && "flex-row-reverse")}>
      <span
        className={cn(
          "mt-0.5 grid size-7 shrink-0 place-items-center rounded-md",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="size-3.5" /> : <Bot className="size-3.5" />}
      </span>

      <div className={cn("max-w-[85%] min-w-0 space-y-1", isUser && "text-right")}>
        <div
          className={cn(
            "inline-block rounded-lg px-3 py-2 text-left text-sm whitespace-pre-wrap",
            isUser ? "bg-primary-subtle text-foreground" : "bg-muted text-foreground",
          )}
        >
          {message.content}
        </div>
        <p className="text-muted-foreground font-mono text-[11px]">
          {tanggalWaktu(message.createdAt)}
        </p>
      </div>
    </div>
  );
}
