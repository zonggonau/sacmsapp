import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/lib/auth-guard";
import { angka, rupiah, tanggal } from "@/lib/format";
import { cn } from "@/lib/utils";
import * as planService from "@/services/plan.service";
import * as quotaService from "@/services/quota.service";

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
  const [quota, plans] = await Promise.all([
    quotaService.getQuota(user.id),
    planService.list(),
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
          <Meter
            label="Kredit bulan ini"
            used={quota.creditsUsed}
            limit={quota.creditLimit}
            hint={`1 kredit = 1 pembuatan atau edit website. Terisi kembali pada ${tanggal(quota.periodEndsAt)}; sisa kredit tidak menumpuk.${quota.creditsOverridden ? " Kuota ini diatur khusus oleh admin." : ""}`}
          />
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
    </div>
  );
}
