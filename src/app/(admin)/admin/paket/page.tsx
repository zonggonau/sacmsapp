import type { Metadata } from "next";

import { DataTable, PageHeader, Td, Th } from "@/components/features/admin/admin-ui";
import { PlanEditor } from "@/components/features/admin/plan-editor";
import { Badge } from "@/components/ui/badge";
import { angka, rupiah } from "@/lib/format";
import * as planService from "@/services/plan.service";

export const metadata: Metadata = { title: "Paket" };

export default async function AdminPlansPage() {
  const plans = await planService.list();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paket"
        description="Batas kuota disimpan sebagai data. Mengubahnya berlaku seketika, tanpa deploy."
        actions={<PlanEditor />}
      />

      <DataTable minWidth="60rem">
        <thead>
          <tr>
            <Th>Paket</Th>
            <Th className="text-right">Harga/bln</Th>
            <Th className="text-right">Project</Th>
            <Th className="text-right">Kredit</Th>
            <Th className="text-right">Domain</Th>
            <Th className="text-right">Deploy/hari</Th>
            <Th>Model</Th>
            <Th className="text-right">Pengguna</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {plans.map((p) => (
            <tr key={p.id}>
              <Td>
                <div className="flex items-center gap-2 font-medium">
                  {p.name}
                  {p.isPublic ? null : <Badge variant="neutral">Tersembunyi</Badge>}
                </div>
                <div className="text-muted-foreground font-mono text-xs">{p.slug}</div>
              </Td>
              <Td className="text-right tabular-nums">{rupiah(p.priceMonthly)}</Td>
              <Td className="text-right font-mono tabular-nums">
                {angka(p.maxProjects)}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {angka(p.monthlyCredits)}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {angka(p.maxCustomDomains)}
              </Td>
              <Td className="text-right font-mono tabular-nums">
                {angka(p.maxDeploysPerDay)}
              </Td>
              <Td className="font-mono text-xs">{p.allowedModels.join(", ")}</Td>
              <Td className="text-right font-mono tabular-nums">
                {angka(p.userCount)}
              </Td>
              <Td className="text-right">
                <PlanEditor
                  userCount={p.userCount}
                  plan={{
                    id: p.id,
                    slug: p.slug,
                    name: p.name,
                    description: p.description,
                    priceMonthly: p.priceMonthly,
                    isPublic: p.isPublic,
                    sortOrder: p.sortOrder,
                    maxProjects: p.maxProjects,
                    monthlyCredits: p.monthlyCredits,
                    maxCustomDomains: p.maxCustomDomains,
                    maxDeploysPerDay: p.maxDeploysPerDay,
                    allowedModels: p.allowedModels,
                  }}
                />
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>

      <p className="text-muted-foreground text-xs">
        Paket tidak bisa dihapus karena setiap pengguna menunjuk ke satu paket.
        Sembunyikan paket yang tidak lagi dijual.
      </p>
    </div>
  );
}
