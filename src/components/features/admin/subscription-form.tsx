"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { CalendarCheck, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

import {
  adminActivateSubscription,
  adminCancelSubscription,
} from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { rupiah, tanggal } from "@/lib/format";
import { formAction } from "@/lib/form-action";

export interface SubscriptionPlanOption {
  id: string;
  name: string;
  priceYearly: number;
}

/**
 * Aktivasi & perpanjangan Paket Project — ADR-012.
 *
 * Pembayaran masih manual (Midtrans v1.1): Super Admin mengaktifkan setelah
 * transfer diterima. Perpanjangan dihitung dari sisa masa aktif, jadi menekan
 * tombol ini lebih awal tidak merugikan pelanggan.
 */
export function SubscriptionForm({
  projectId,
  plans,
  current,
}: {
  projectId: string;
  plans: SubscriptionPlanOption[];
  current: { status: string; endsAt: Date } | null;
}) {
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [months, setMonths] = useState("12");

  const activate = useAction(adminActivateSubscription, {
    onSuccess: () => toast.success("Paket Project diaktifkan."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal mengaktifkan paket."),
  });

  const cancel = useAction(adminCancelSubscription, {
    onSuccess: () => toast.success("Langganan dibatalkan."),
    onError: ({ error }) =>
      toast.error(error.serverError ?? "Gagal membatalkan langganan."),
  });

  const errors = activate.result.validationErrors;

  return (
    <div className="space-y-4">
      {current ? (
        <p className="text-muted-foreground text-sm">
          Status sekarang: <span className="text-foreground">{current.status}</span>,
          berakhir {tanggal(current.endsAt)}.
        </p>
      ) : (
        <p className="text-muted-foreground text-sm">
          Website ini belum punya Paket Project, jadi belum bisa diterbitkan.
        </p>
      )}

      <form action={formAction(activate.execute)} className="space-y-4">
        <input type="hidden" name="projectId" value={projectId} />

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="planId">Paket</Label>
            <select
              id="planId"
              name="planId"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none"
              required
            >
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.priceYearly > 0 ? ` — ${rupiah(p.priceYearly)}/tahun` : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="months">Masa aktif (bulan)</Label>
            <Input
              id="months"
              name="months"
              inputMode="numeric"
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              required
              aria-invalid={Boolean(errors?.months)}
            />
            {errors?.months?._errors?.[0] ? (
              <p className="text-destructive text-sm">{errors.months._errors[0]}</p>
            ) : null}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="paymentRef">
            Nomor bukti transfer{" "}
            <span className="text-muted-foreground font-normal">(opsional)</span>
          </Label>
          <Input
            id="paymentRef"
            name="paymentRef"
            placeholder="Contoh: TRF-2026-0142"
          />
        </div>

        <Button type="submit" disabled={activate.isPending || planId === ""}>
          {activate.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CalendarCheck className="size-4" />
          )}
          {activate.isPending
            ? "Menyimpan…"
            : current
              ? "Perpanjang Paket"
              : "Aktifkan Paket"}
        </Button>
      </form>

      {current && current.status !== "CANCELLED" ? (
        <form action={formAction(cancel.execute)}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            className="text-destructive-text"
          >
            {cancel.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            Batalkan langganan
          </Button>
          <p className="text-muted-foreground mt-2 text-xs">
            Website tetap tayang sampai masa aktifnya berakhir, lalu diturunkan setelah
            masa tenggang.
          </p>
        </form>
      ) : null}
    </div>
  );
}
