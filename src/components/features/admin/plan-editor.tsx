"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { adminUpsertPlan } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { isV0Model, V0_MODELS, type V0Model } from "@/config/ai-models";

export interface EditablePlan {
  id?: string;
  slug: string;
  name: string;
  description: string | null;
  priceMonthly: number;
  isPublic: boolean;
  sortOrder: number;
  maxProjects: number;
  monthlyCredits: number;
  maxCustomDomains: number;
  maxDeploysPerDay: number;
  allowedModels: string[];
}

const NUMBER_FIELDS = [
  { key: "priceMonthly", label: "Harga per bulan (Rp)" },
  { key: "monthlyCredits", label: "Kredit per bulan" },
  { key: "maxProjects", label: "Maksimum project" },
  { key: "maxCustomDomains", label: "Maksimum custom domain" },
  { key: "maxDeploysPerDay", label: "Deploy per hari" },
  { key: "sortOrder", label: "Urutan tampil" },
] as const;

/**
 * Editor paket — docs/10 §10.6. Perubahan berlaku tanpa deploy.
 * State formulir lokal dipakai karena daftar model berupa pilihan ganda.
 */
export function PlanEditor({
  plan,
  userCount,
}: {
  plan?: EditablePlan;
  userCount?: number;
}) {
  const blank: EditablePlan = {
    slug: "",
    name: "",
    description: null,
    priceMonthly: 0,
    isPublic: true,
    sortOrder: 0,
    maxProjects: 1,
    monthlyCredits: 30,
    maxCustomDomains: 0,
    maxDeploysPerDay: 3,
    allowedModels: ["v0-mini"],
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EditablePlan>(plan ?? blank);

  const { execute, isPending, result } = useAction(adminUpsertPlan, {
    onSuccess: () => {
      setOpen(false);
      toast.success(
        plan ? "Paket diperbarui. Berlaku seketika." : "Paket baru dibuat.",
      );
    },
    onError: ({ error }) => {
      if (error.serverError) toast.error(error.serverError);
    },
  });

  const errors = result.validationErrors;
  const toggleModel = (model: V0Model) =>
    setForm((f) => ({
      ...f,
      allowedModels: f.allowedModels.includes(model)
        ? f.allowedModels.filter((m) => m !== model)
        : [...f.allowedModels, model],
    }));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setForm(plan ?? blank);
      }}
    >
      <DialogTrigger asChild>
        <Button variant={plan ? "outline" : "default"} size="sm">
          {plan ? "Ubah" : "Paket Baru"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{plan ? `Ubah paket ${plan.name}` : "Paket baru"}</DialogTitle>
          <DialogDescription>
            {plan && userCount
              ? `Dipakai ${userCount} pengguna. Menurunkan batas tidak memutus pekerjaan yang sudah ada — pengguna hanya tidak bisa membuat yang baru.`
              : "Batas disimpan sebagai data dan berlaku tanpa deploy."}
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const payload = {
              slug: form.slug,
              name: form.name,
              description: form.description ?? "",
              priceMonthly: form.priceMonthly,
              isPublic: form.isPublic,
              sortOrder: form.sortOrder,
              maxProjects: form.maxProjects,
              monthlyCredits: form.monthlyCredits,
              maxCustomDomains: form.maxCustomDomains,
              maxDeploysPerDay: form.maxDeploysPerDay,
              allowedModels: form.allowedModels.filter(isV0Model),
            };
            execute(plan?.id ? { ...payload, id: plan.id } : payload);
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="plan-name">Nama</Label>
              <Input
                id="plan-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              {errors?.name?._errors?.[0] ? (
                <p className="text-destructive text-xs">{errors.name._errors[0]}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="plan-slug">Slug</Label>
              <Input
                id="plan-slug"
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: e.target.value })}
                disabled={Boolean(plan)}
                className="font-mono"
                required
              />
              {errors?.slug?._errors?.[0] ? (
                <p className="text-destructive text-xs">{errors.slug._errors[0]}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan-desc">Deskripsi</Label>
            <Input
              id="plan-desc"
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {NUMBER_FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`plan-${field.key}`}>{field.label}</Label>
                <Input
                  id={`plan-${field.key}`}
                  type="number"
                  min={0}
                  value={form[field.key]}
                  onChange={(e) =>
                    setForm({ ...form, [field.key]: Number(e.target.value) })
                  }
                  className="font-mono"
                />
              </div>
            ))}
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Model AI yang diizinkan</legend>
            <div className="flex flex-wrap gap-3">
              {V0_MODELS.map((model) => (
                <label
                  key={model}
                  className="flex items-center gap-2 font-mono text-xs"
                >
                  <input
                    type="checkbox"
                    checked={form.allowedModels.includes(model)}
                    onChange={() => toggleModel(model)}
                    className="accent-primary size-4"
                  />
                  {model}
                </label>
              ))}
            </div>
            {errors?.allowedModels || form.allowedModels.length === 0 ? (
              <p className="text-destructive text-xs">Pilih minimal satu model.</p>
            ) : null}
          </fieldset>

          <div className="flex items-center justify-between">
            <Label htmlFor="plan-public">Tampil di halaman harga</Label>
            <Switch
              id="plan-public"
              checked={form.isPublic}
              onCheckedChange={(v) => setForm({ ...form, isPublic: v })}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Simpan Paket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
