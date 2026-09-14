import type { Metadata } from "next";
import Link from "next/link";

import { AdminFilters } from "@/components/features/admin/admin-filters";
import {
  DataTable,
  EmptyRow,
  PageHeader,
  Pager,
  RoleBadge,
  Td,
  Th,
  UserStatusBadge,
} from "@/components/features/admin/admin-ui";
import { angka, sejak } from "@/lib/format";
import { pickParams, userFiltersSchema } from "@/schemas/admin.schema";
import * as adminUser from "@/services/admin-user.service";
import * as planService from "@/services/plan.service";

export const metadata: Metadata = { title: "Pengguna" };

const KEYS = ["q", "plan", "status", "role", "cursor"] as const;

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = pickParams(await searchParams, KEYS);
  const filters = userFiltersSchema.parse(raw);

  const [{ items, nextCursor }, plans] = await Promise.all([
    adminUser.list(filters),
    planService.list(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pengguna"
        description="Semua akun terdaftar, termasuk yang ditangguhkan."
      />

      <AdminFilters
        fields={[
          { key: "q", label: "Cari", type: "text", placeholder: "Nama atau email…" },
          {
            key: "plan",
            label: "Paket",
            type: "select",
            options: plans.map((p) => ({ value: p.slug, label: p.name })),
          },
          {
            key: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "ACTIVE", label: "Aktif" },
              { value: "SUSPENDED", label: "Ditangguhkan" },
            ],
          },
          {
            key: "role",
            label: "Peran",
            type: "select",
            options: [
              { value: "USER", label: "Pengguna" },
              { value: "ADMIN", label: "Admin" },
              { value: "SUPER_ADMIN", label: "Super Admin" },
            ],
          },
        ]}
      />

      <DataTable minWidth="52rem">
        <thead>
          <tr>
            <Th>Nama & email</Th>
            <Th>Paket</Th>
            <Th className="text-right">Project</Th>
            <Th className="text-right">Kredit</Th>
            <Th>Status</Th>
            <Th>Terakhir masuk</Th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <EmptyRow colSpan={6}>
              Tidak ada pengguna yang cocok dengan filter.
            </EmptyRow>
          ) : (
            items.map((u) => (
              <tr key={u.id}>
                <Td>
                  <Link
                    href={`/admin/pengguna/${u.id}`}
                    className="font-medium hover:underline"
                  >
                    {u.name}
                  </Link>
                  <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-xs">
                    <span className="break-all">{u.email}</span>
                    {u.role !== "USER" ? <RoleBadge role={u.role} /> : null}
                  </div>
                </Td>
                <Td>{u.planName}</Td>
                <Td className="text-right font-mono tabular-nums">
                  {angka(u.projectCount)}
                </Td>
                <Td className="text-right font-mono tabular-nums">
                  {angka(u.creditsUsed)} / {angka(u.creditLimit)}
                </Td>
                <Td>
                  <UserStatusBadge status={u.status} />
                </Td>
                <Td className="text-muted-foreground text-xs">
                  {u.lastLoginAt ? sejak(u.lastLoginAt) : "—"}
                </Td>
              </tr>
            ))
          )}
        </tbody>
      </DataTable>

      <Pager basePath="/admin/pengguna" params={raw} nextCursor={nextCursor} />
    </div>
  );
}
