import { SUPPORT, whatsappWithText } from "@/config/support";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreditHistory } from "@/components/features/quota/credit-history";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth-guard";
import { TOPUP_PACKS } from "@/config/billing";
import { angka, rupiah, tanggal } from "@/lib/format";
import { cn } from "@/lib/utils";
import * as planService from "@/services/plan.service";
import * as creditService from "@/services/credit.service";
import * as quotaService from "@/services/quota.service";
import * as usageService from "@/services/usage.service";

export const metadata: Metadata = {
  title: "Paket & Kuota",
  robots: { index: false, follow: false },
};

function Meter({
  label,
  used,
  limit,
  hint,
}: {
  label: string;
  used: number;
  limit: number;
  hint: string;
}) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const full = used >= limit;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            "font-mono tabular-nums",
            full ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {limit === 0 ? "Tidak termasuk paket" : `${angka(used)} / ${angka(limit)}`}
        </span>
      </div>
      <Progress value={percent} aria-label={`${label}: ${used} dari ${limit}`} />
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

/** Kuota terlihat sebelum dibutuhkan — docs/11 §11.6. */
export default async function PlanPage() {
  const user = await requireUser();
  const [quota, plans, history, wallet, lots] = await Promise.all([
    quotaService.getQuota(user.id),
    planService.list(),
    usageService.listHistory(user.id),
    creditService.getBalance(user.id),
    creditService.listLots(user.id),
  ]);
  if (!quota) notFound();

  const visiblePlans = plans.filter((p) => p.isPublic || p.slug === quota.planSlug);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Paket {quota.planName}
            <Badge variant="subtle">aktif</Badge>
          </CardTitle>
          <CardDescription>
            Periode berjalan {tanggal(quota.periodStartedAt)} –{" "}
            {tanggal(quota.periodEndsAt)}.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* ADR-012: kredit dari dompet akun, bukan kuota bulanan paket. */}
          <div className="space-y-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-medium">Sisa kredit AI</span>
              <span className="font-mono text-2xl tabular-nums">
                {angka(wallet.total)}
              </span>
            </div>
            <p className="text-muted-foreground text-xs">
              1 kredit = 1 pembuatan atau perubahan website, dipakai di semua website
              Anda. Kredit tidak hangus setiap bulan.
              {wallet.expiringSoon > 0 && wallet.nextExpiry
                ? ` ${angka(wallet.expiringSoon)} kredit kedaluwarsa pada ${tanggal(wallet.nextExpiry)}.`
                : ""}
            </p>
          </div>
          <Meter
            label="Website"
            used={quota.projectCount}
            limit={quota.projectLimit}
            hint="Termasuk yang diarsipkan. Menghapus project membebaskan kuota."
          />
          <Meter
            label="Custom domain"
            used={quota.domainCount}
            limit={quota.domainLimit}
            hint="Alamat vercel.app selalu tersedia tanpa memakai kuota ini."
          />
          <Meter
            label="Penerbitan hari ini"
            used={quota.deploysToday}
            limit={quota.deployLimit}
            hint="Dihitung ulang setiap pukul 00.00 WIB. Penerbitan yang gagal tidak dihitung."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bandingkan paket</CardTitle>
          <CardDescription>
            Peningkatan paket saat ini dilakukan oleh admin SaCMS setelah pembayaran.
            Batas baru berlaku seketika.
          </CardDescription>
          {/* Jalur upgrade manual — docs/11 §11.7 & kanal dukungan docs/14 §14.9. */}
          {SUPPORT.available ? (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-muted-foreground text-sm">
                Ingin naik paket atau menambah kredit?
              </span>
              {SUPPORT.whatsapp ? (
                <Button size="sm" asChild>
                  <a
                    href={
                      whatsappWithText(
                        `Halo admin SaCMS, saya ingin upgrade paket. Email akun: ${user.email}. Paket saat ini: ${quota.planName}.`,
                      ) ?? "#"
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Hubungi via WhatsApp
                  </a>
                </Button>
              ) : null}
              {SUPPORT.emailHref ? (
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`${SUPPORT.emailHref}?subject=${encodeURIComponent("Upgrade paket SaCMS")}&body=${encodeURIComponent(`Email akun: ${user.email}
Paket saat ini: ${quota.planName}
Paket yang diinginkan: `)}`}
                  >
                    Kirim email ke admin
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="border-border overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[32rem] text-left text-sm">
              <thead className="bg-muted text-muted-foreground text-xs">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">
                    Paket
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Harga/bln
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Kredit
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Website
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Domain
                  </th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">
                    Deploy/hari
                  </th>
                </tr>
              </thead>
              <tbody>
                {visiblePlans.map((p) => (
                  <tr key={p.id} className="border-border border-t">
                    <td className="px-3 py-2.5 font-medium">
                      {p.name}
                      {p.slug === quota.planSlug ? (
                        <Badge variant="subtle" className="ml-2">
                          paket Anda
                        </Badge>
                      ) : null}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {rupiah(p.priceMonthly)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {angka(p.monthlyCredits)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {angka(p.maxProjects)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {angka(p.maxCustomDomains)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums">
                      {angka(p.maxDeploysPerDay)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Top-up kredit — ADR-012. Pembayaran manual sampai Midtrans (v1.1). */}
      <Card>
        <CardHeader>
          <CardTitle>Isi kredit AI</CardTitle>
          <CardDescription>
            Kredit dipakai untuk membuat dan mengubah website, dan berlaku 12 bulan
            sejak dibeli. Pilih paket, lalu hubungi admin untuk pembayaran; kredit masuk
            setelah transfer diterima.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-3 sm:grid-cols-3">
            {TOPUP_PACKS.map((pack) => (
              <li
                key={pack.credits}
                className="border-border flex flex-col gap-1 rounded-lg border p-4"
              >
                <span className="font-mono text-xl tabular-nums">
                  {angka(pack.credits)}
                </span>
                <span className="text-muted-foreground text-xs">kredit</span>
                <span className="mt-1 text-sm font-medium">
                  {rupiah(pack.priceIdr)}
                </span>
                <span className="text-muted-foreground text-xs">
                  {rupiah(Math.round(pack.priceIdr / pack.credits))} per kredit
                </span>
              </li>
            ))}
          </ul>

          {SUPPORT.available ? (
            <div className="flex flex-wrap items-center gap-2">
              {SUPPORT.whatsapp ? (
                <Button size="sm" asChild>
                  <a
                    href={
                      whatsappWithText(
                        `Halo admin SaCMS, saya ingin isi kredit AI. Email akun: ${user.email}.`,
                      ) ?? "#"
                    }
                    target="_blank"
                    rel="noreferrer noopener"
                  >
                    Pesan kredit via WhatsApp
                  </a>
                </Button>
              ) : null}
              {SUPPORT.emailHref ? (
                <Button size="sm" variant="outline" asChild>
                  <a
                    href={`${SUPPORT.emailHref}?subject=${encodeURIComponent("Isi kredit AI SaCMS")}`}
                  >
                    Kirim email ke admin
                  </a>
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      {lots.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Kredit yang Anda miliki</CardTitle>
            <CardDescription>
              Setiap pembelian punya masa berlaku sendiri. Kredit yang paling dulu
              kedaluwarsa dipakai lebih dulu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-border divide-y">
              {lots.map((lot) => (
                <li key={lot.id} className="flex flex-wrap items-baseline gap-x-3 py-3">
                  <span className="flex-1 text-sm">
                    {lot.source === "WELCOME"
                      ? "Kredit sambutan"
                      : lot.source === "ADMIN"
                        ? "Ditambahkan admin"
                        : "Pembelian"}
                    {lot.paymentRef ? (
                      <span className="text-muted-foreground font-mono text-xs">
                        {" "}
                        · {lot.paymentRef}
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono text-sm tabular-nums">
                    {angka(lot.remaining)} / {angka(lot.amount)}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      lot.expired ? "text-destructive-text" : "text-muted-foreground",
                    )}
                  >
                    {lot.expired
                      ? "kedaluwarsa"
                      : `berlaku sampai ${tanggal(lot.expiresAt)}`}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {/* Menjawab "kredit saya habis untuk apa?" — docs/11 §11.6. */}
      <Card>
        <CardHeader>
          <CardTitle>Riwayat pemakaian kredit</CardTitle>
          <CardDescription>
            30 catatan terakhir. Build yang gagal mengembalikan kreditnya, dan barisnya
            tetap ditampilkan agar terlihat.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreditHistory items={history} />
        </CardContent>
      </Card>
    </div>
  );
}
