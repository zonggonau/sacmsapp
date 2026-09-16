"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

import { adminGrantCredits } from "@/actions/admin.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TOPUP_PACKS } from "@/config/billing";
import { angka, rupiah } from "@/lib/format";
import { formAction } from "@/lib/form-action";

/**
 * Top-up kredit manual — ADR-012, pembayaran manual sampai Midtrans (v1.1).
 *
 * Super Admin menambah kredit setelah transfer diterima. Nomor bukti transfer
 * disimpan di lot supaya rekonsiliasi bisa ditelusuri.
 */
export function GrantCreditsForm({ userId }: { userId: string }) {
  const [amount, setAmount] = useState("");

  const { execute, result, isPending } = useAction(adminGrantCredits, {
    onSuccess: () => {
      toast.success("Kredit ditambahkan ke dompet pengguna.");
      setAmount("");
    },
    onError: ({ error }) => toast.error(error.serverError ?? "Gagal menambah kredit."),
  });

  const errors = result.validationErrors;

  return (
    <form action={formAction(execute)} className="space-y-4">
      <input type="hidden" name="userId" value={userId} />

      <div className="space-y-2">
        <Label htmlFor="amount">Jumlah kredit</Label>
        <Input
          id="amount"
          name="amount"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Contoh: 50"
          required
          aria-invalid={Boolean(errors?.amount)}
          aria-describedby="amount-error amount-hint"
        />
        {errors?.amount?._errors?.[0] ? (
          <p id="amount-error" className="text-destructive text-sm">
            {errors.amount._errors[0]}
          </p>
        ) : null}
        <div id="amount-hint" className="flex flex-wrap gap-1.5">
          {TOPUP_PACKS.map((pack) => (
            <Button
              key={pack.credits}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setAmount(String(pack.credits))}
            >
              {angka(pack.credits)} kredit · {rupiah(pack.priceIdr)}
            </Button>
          ))}
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
          aria-invalid={Boolean(errors?.paymentRef)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">
          Catatan <span className="text-muted-foreground font-normal">(opsional)</span>
        </Label>
        <Input id="note" name="note" placeholder="Contoh: top-up paket 50 kredit" />
      </div>

      <Button type="submit" disabled={isPending || amount.trim() === ""}>
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Wallet className="size-4" />
        )}
        {isPending ? "Menambahkan…" : "Tambah Kredit"}
      </Button>
      <p className="text-muted-foreground text-xs">
        Kredit berlaku 12 bulan sejak ditambahkan dan bisa dipakai di semua website
        milik pengguna ini.
      </p>
    </form>
  );
}
