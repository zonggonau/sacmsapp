import { getSession } from "@/lib/auth-guard";
import { auditFiltersSchema, pickParams } from "@/schemas/admin.schema";
import * as auditService from "@/services/audit.service";

/**
 * Ekspor audit log sebagai CSV — docs/10 §10.8.
 *
 * Route Handler karena hasilnya berkas unduhan, bukan mutasi. PENTING: layout
 * grup (admin) TIDAK melindungi Route Handler, jadi peran diperiksa di sini.
 */
export async function GET(req: Request) {
  const session = await getSession();

  if (
    !session ||
    session.user.role !== "SUPER_ADMIN" ||
    session.user.status === "SUSPENDED" ||
    session.session.impersonatedBy
  ) {
    return new Response("Akses ditolak", { status: 403 });
  }

  const url = new URL(req.url);
  const filters = auditFiltersSchema.parse(
    pickParams(Object.fromEntries(url.searchParams), [
      "action",
      "actor",
      "targetType",
      "targetId",
      "from",
      "to",
    ]),
  );

  const csv = await auditService.exportCsv(filters);

  // Ekspor data audit juga tercatat — docs/10 §10.8.
  await auditService.record({
    action: "admin.audit.export",
    actorId: session.user.id,
    actorRole: "SUPER_ADMIN",
    targetType: "AuditLog",
    after: { filters },
    ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: req.headers.get("user-agent"),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-sacms-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
