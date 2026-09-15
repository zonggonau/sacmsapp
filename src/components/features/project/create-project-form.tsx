"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2, Sparkles } from "lucide-react";

import { createProject } from "@/actions/project.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { WEBSITE_TYPES, getWebsiteType, promptTemplate } from "@/config/website-types";
import { BlockedTooltip } from "@/components/features/quota/blocked-tooltip";
import { angka } from "@/lib/format";
import { formAction } from "@/lib/form-action";
import { toastActionError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { WebsiteType } from "@/types/db";

/**
 * SATU komponen form, dipakai oleh halaman penuh `/projects/baru` DAN dialog
 * `@modal/(.)baru`. Menduplikasi form ke dua tempat adalah cara pasti membuat
 * keduanya berbeda perlahan-lahan (docs/05 §5.4).
 */
export interface CreateProjectQuota {
  creditsLeft: number;
  creditLimit: number;
  /** Alasan tombol Buat Project nonaktif (project atau kredit habis); null bila bisa. */
  blocker: string | null;
}

export function CreateProjectForm({
  compact = false,
  quota,
}: {
  compact?: boolean;
  /** docs/11 §11.6: sisa kredit tampil di bawah tombol. */
  quota?: CreateProjectQuota | null;
}) {
  const [selected, setSelected] = useState<WebsiteType>("GOVERNMENT");
  const [prompt, setPrompt] = useState("");
  // Contoh prompt terakhir yang diisikan otomatis. Selama teks di formulir masih
  // sama persis dengannya, memilih jenis lain boleh menggantinya; teks yang
  // sudah diubah pengguna tidak pernah ditimpa diam-diam (docs/08 §8.6).
  const [autoFilled, setAutoFilled] = useState<string | null>(null);

  const { execute, result, isPending } = useAction(createProject, {
    onError: ({ error }) => {
      if (error.serverError)
        toastActionError(error.serverError, "Gagal membuat project.");
    },
  });

  const errors = result.validationErrors;
  const active = getWebsiteType(selected);
  const untouched = prompt.trim() === "" || prompt === autoFilled;
  const offerTemplate = !untouched && prompt !== promptTemplate(selected);

  function fillTemplate(value: WebsiteType) {
    const template = promptTemplate(value);
    setPrompt(template);
    setAutoFilled(template);
  }

  function chooseType(value: WebsiteType) {
    setSelected(value);
    if (untouched) fillTemplate(value);
  }

  return (
    <form action={formAction(execute)} className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Jenis website</legend>

        <div
          className={cn(
            "grid gap-2",
            compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4",
          )}
        >
          {WEBSITE_TYPES.map((type) => {
            const Icon = type.icon;
            return (
              <label
                key={type.value}
                className={cn(
                  "group relative flex cursor-pointer flex-col gap-1.5 rounded-md border p-3",
                  "border-border hover:border-border-strong hover:bg-accent transition-colors",
                  "has-checked:border-primary has-checked:bg-primary-subtle",
                  "focus-within:ring-ring focus-within:ring-2 focus-within:ring-offset-2",
                )}
              >
                <input
                  type="radio"
                  name="websiteType"
                  value={type.value}
                  checked={selected === type.value}
                  // onChange untuk keyboard; onClick supaya kartu yang sudah
                  // terpilih tetap bisa mengisi contoh prompt saat diklik.
                  onChange={() => chooseType(type.value)}
                  onClick={() => chooseType(type.value)}
                  className="sr-only"
                />
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    selected === type.value
                      ? "text-primary-text"
                      : "text-muted-foreground",
                  )}
                />
                <span
                  className={cn(
                    "text-xs font-medium",
                    selected === type.value && "text-primary-text",
                  )}
                >
                  {type.label}
                </span>
              </label>
            );
          })}
        </div>

        <p className="text-muted-foreground text-xs">{active.description}</p>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="name">Nama project</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={100}
          placeholder="Contoh: Website SMA Negeri 1 Jayapura"
          aria-invalid={Boolean(errors?.name)}
          aria-describedby="name-error"
        />
        {errors?.name?._errors?.[0] ? (
          <p id="name-error" className="text-destructive text-sm">
            {errors.name._errors[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="prompt">Ceritakan website yang Anda inginkan</Label>
          {offerTemplate ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => fillTemplate(selected)}
            >
              <Sparkles className="size-3.5" />
              Isi contoh prompt {active.label}
            </Button>
          ) : null}
        </div>
        <Textarea
          id="prompt"
          name="prompt"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={compact ? 7 : 10}
          maxLength={4000}
          placeholder={active.placeholder}
          required
          aria-invalid={Boolean(errors?.prompt)}
          aria-describedby="prompt-error prompt-hint"
        />
        {errors?.prompt?._errors?.[0] ? (
          <p id="prompt-error" className="text-destructive text-sm">
            {errors.prompt._errors[0]}
          </p>
        ) : null}
        <p id="prompt-hint" className="text-muted-foreground text-xs">
          {autoFilled !== null && untouched
            ? "Ganti teks dalam [kurung siku] dengan data Anda, lalu tambah atau hapus bagian sesuai kebutuhan."
            : "Pilih jenis website untuk mengisi contoh prompt, atau tulis sendiri. Semakin jelas halaman dan isi yang Anda sebut, semakin tepat hasilnya."}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="referenceUrl">
          Website referensi{" "}
          <span className="text-muted-foreground font-normal">(opsional)</span>
        </Label>
        <Input
          id="referenceUrl"
          name="referenceUrl"
          type="text"
          inputMode="url"
          autoComplete="url"
          spellCheck={false}
          maxLength={2000}
          placeholder="Contoh: www.websitecontoh.com"
          aria-invalid={Boolean(errors?.referenceUrl)}
          aria-describedby="reference-error reference-hint"
        />
        {errors?.referenceUrl?._errors?.[0] ? (
          <p id="reference-error" className="text-destructive text-sm">
            {errors.referenceUrl._errors[0]}
          </p>
        ) : null}
        <p id="reference-hint" className="text-muted-foreground text-xs">
          AI memakai website ini sebagai acuan tampilan dan susunan halaman. Gunakan
          konten, foto, dan logo milik Anda sendiri.
        </p>
      </div>

      <div className="space-y-2">
        <BlockedTooltip reason={quota?.blocker}>
          <Button
            type="submit"
            className="w-full"
            disabled={isPending || Boolean(quota?.blocker)}
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Membuat…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Buat Project
              </>
            )}
          </Button>
        </BlockedTooltip>
        {quota ? (
          <p className="text-muted-foreground text-center text-xs">
            {quota.blocker ??
              `Sisa kredit ${angka(quota.creditsLeft)} dari ${angka(quota.creditLimit)}. Pembuatan website memakai 1 kredit.`}
          </p>
        ) : null}
      </div>
    </form>
  );
}
