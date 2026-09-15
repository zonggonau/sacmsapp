import type { Metadata } from "next";
import Link from "next/link";
import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          1 kredit = 1 kali pembuatan atau perubahan website. Menerbitkan website dan
          mengembalikan versi lama tidak memakai kredit. Kredit terisi kembali setiap 30
          hari dan tidak menumpuk.
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="text-muted-foreground mt-12 text-center">
          Daftar paket sedang dimuat ulang. Silakan muat ulang halaman ini sebentar
          lagi.
        </p>
      ) : (
        <div className="mt-12 grid gap-6 md:grid-cols-3">
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
                <p className="mt-6">
                  <span className="text-3xl font-bold tracking-tight">
                    {plan.priceMonthly === 0 ? "Gratis" : rupiah(plan.priceMonthly)}
                  </span>
                  {plan.priceMonthly > 0 ? (
                    <span className="text-muted-foreground text-sm"> / bulan</span>
                  ) : null}
                </p>

                <ul className="mt-6 flex-1 space-y-2.5 text-sm">
                  {[
                    `${angka(plan.maxProjects)} website`,
                    `${angka(plan.monthlyCredits)} kredit per 30 hari`,
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
                    {plan.priceMonthly === 0 ? "Mulai gratis" : `Pilih ${plan.name}`}
                  </Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-muted-foreground mx-auto mt-10 max-w-2xl text-center text-sm">
        Semua pendaftar mulai dari paket gratis. Peningkatan paket saat ini dilakukan
        oleh tim SaCMS setelah pembayaran; batas baru berlaku seketika. Harga belum
        termasuk pajak bila berlaku.
      </p>
    </div>
  );
}
