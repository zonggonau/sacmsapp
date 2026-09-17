import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TOPUP_PACKS, WELCOME_CREDITS } from "@/config/billing";
import { SACMS_DEVELOPER } from "@/config/enterprise";
import { angka, rupiah } from "@/lib/format";
import { logger } from "@/lib/logger";
import * as planService from "@/services/plan.service";

export const metadata: Metadata = {
  title: "Harga",
  description: "Paket SaCMS untuk pribadi, usaha, dan instansi. Mulai gratis.",
};

/**
 * Halaman harga — docs/14 §14.9: "Halaman harga sesuai dengan tabel Plan".
 * Membaca tabel Plan, bukan angka yang ditulis ulang di sini.
 *
 * Dirender dinamis (bukan ISR) karena CSP nonce mewajibkan render per
 * permintaan — ADR-009. Perubahan paket oleh Super Admin langsung tampil.
 */
async function loadPlans() {
  try {
    return (await planService.list()).filter((p) => p.isPublic);
  } catch (error) {
    // Database bermasalah tidak boleh membuat halaman harga error total.
    logger.warn("pricing.plans_unavailable", {
      reason: error instanceof Error ? error.message : "tidak diketahui",
    });
    return [];
  }
}

export default async function PricingPage() {
  const plans = await loadPlans();
  const featured = plans.length >= 2 ? plans[1]?.slug : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Harga sederhana, tanpa kejutan
        </h1>
        <p className="text-muted-foreground mt-4">
          Paket dibayar per website per tahun dan mencakup hosting, domain, penerbitan,
          serta dukungan. Kredit AI dibeli terpisah: 1 kredit = 1 kali pembuatan atau
          perubahan website, berlaku 12 bulan, dan bisa dipakai di semua website Anda.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="text-muted-foreground mt-12 text-center">
          Daftar paket sedang dimuat ulang. Silakan muat ulang halaman ini sebentar
          lagi.
        </p>
      ) : (
        <div className="mx-auto mt-12 grid max-w-3xl gap-6 sm:grid-cols-2">
          {plans.map((plan) => {
            const isFeatured = plan.slug === featured;
            return (
              <div
                key={plan.id}
                className={
                  isFeatured
                    ? "border-primary/50 bg-card flex flex-col rounded-xl border-2 p-6"
                    : "border-border bg-card flex flex-col rounded-xl border p-6"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">{plan.name}</h2>
                  {isFeatured ? <Badge>Paling dipilih</Badge> : null}
                </div>
                {plan.description ? (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {plan.description}
                  </p>
                ) : null}
                {/* ADR-012: Paket Project per tahun; paket lama tetap per bulan. */}
                <p className="mt-6">
                  <span className="text-3xl font-bold tracking-tight">
                    {plan.priceYearly > 0
                      ? rupiah(plan.priceYearly)
                      : plan.priceMonthly > 0
                        ? rupiah(plan.priceMonthly)
                        : "Gratis"}
                  </span>
                  {plan.priceYearly > 0 ? (
                    <span className="text-muted-foreground text-sm">
                      {" "}
                      / website / tahun
                    </span>
                  ) : plan.priceMonthly > 0 ? (
                    <span className="text-muted-foreground text-sm"> / bulan</span>
                  ) : null}
                </p>

                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {[
                    plan.priceYearly > 0
                      ? "1 website, layanan lengkap"
                      : `${angka(plan.maxProjects)} website`,
                    "Kredit AI dibeli terpisah (top-up)",
                    `${angka(plan.maxDeploysPerDay)} penerbitan per hari`,
                    plan.maxCustomDomains === 0
                      ? "Alamat vercel.app (tanpa custom domain)"
                      : `${angka(plan.maxCustomDomains)} custom domain dengan HTTPS`,
                  ].map((line) => (
                    <li key={line} className="flex gap-2">
                      <Check
                        className="text-success mt-0.5 size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {line}
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-8 w-full"
                  variant={isFeatured ? "default" : "outline"}
                  asChild
                >
                  <Link href="/daftar">
                    {plan.priceYearly === 0 && plan.priceMonthly === 0
                      ? "Mulai gratis"
                      : `Pilih ${plan.name}`}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Enterprise tidak dijual di sini — RENCANA-FRONTEND.md §7. Tombol outline supaya
          oranye tetap milik aksi utama halaman (docs/04 §4.1). */}
      <div className="border-border bg-card mx-auto mt-6 flex max-w-3xl flex-col gap-4 rounded-xl border p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">Enterprise</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Untuk developer, agensi, dan instansi yang membangun sistemnya sendiri di
            server khusus. Berlangganan di {SACMS_DEVELOPER.name}.
          </p>
        </div>
        <Button variant="outline" asChild className="shrink-0">
          <Link href="/enterprise">Pelajari Enterprise</Link>
        </Button>
      </div>

      <div className="mx-auto mt-16 max-w-3xl">
        <h2 className="text-center text-xl font-semibold tracking-tight">
          Kredit AI, dibeli saat dibutuhkan
        </h2>
        <p className="text-muted-foreground mt-3 text-center text-sm">
          Kredit dipakai untuk membuat dan mengubah website, berlaku 12 bulan sejak
          dibeli, dan bisa dipakai di semua website Anda. Menerbitkan website dan
          mengembalikan versi lama tidak memakai kredit.
        </p>
        <ul className="mt-6 grid gap-4 sm:grid-cols-3">
          {TOPUP_PACKS.map((pack) => (
            <li
              key={pack.credits}
              className="border-border bg-card flex flex-col rounded-lg border p-5"
            >
              <span className="text-2xl font-bold tabular-nums">
                {angka(pack.credits)}
              </span>
              <span className="text-muted-foreground text-xs">kredit</span>
              <span className="mt-2 font-medium">{rupiah(pack.priceIdr)}</span>
              <span className="text-muted-foreground text-xs">
                {rupiah(Math.round(pack.priceIdr / pack.credits))} per kredit
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-sm">
        Akun baru mendapat {WELCOME_CREDITS} kredit sambutan untuk mencoba Builder.
        Pengaktifan paket dan pembelian kredit saat ini dilayani tim SaCMS setelah
        pembayaran; keduanya berlaku seketika. Harga belum termasuk pajak bila berlaku.
      </p>
    </div>
  );
}
