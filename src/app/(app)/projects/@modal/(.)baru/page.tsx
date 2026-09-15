import { CreateProjectDialog } from "@/components/features/project/create-project-dialog";
import { requireUser } from "@/lib/auth-guard";
import * as quotaService from "@/services/quota.service";

/**
 * Rute yang di-intercept: `(.)baru` mencegat navigasi ke /projects/baru yang
 * berasal dari level yang sama (/projects), lalu menampilkannya sebagai dialog
 * di atas daftar — tanpa meninggalkan halaman.
 *
 * Navigasi langsung ke /projects/baru (URL ditempel, halaman di-refresh) tidak
 * dicegat dan tetap merender halaman penuh. docs/05 §5.4
 */
export default async function InterceptedProjectBaru() {
  const user = await requireUser();
  const blockers = await quotaService.getActionBlockers(user.id);
  return (
    <CreateProjectDialog
      quota={
        blockers
          ? {
              creditsLeft: blockers.creditsLeft,
              creditLimit: blockers.creditLimit,
              blocker: blockers.project ?? blockers.credit,
            }
          : null
      }
    />
  );
}
