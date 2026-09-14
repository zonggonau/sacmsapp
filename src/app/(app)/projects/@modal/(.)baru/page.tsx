import { CreateProjectDialog } from "@/components/features/project/create-project-dialog";
import { requireUser } from "@/lib/auth-guard";

/**
 * Rute yang di-intercept: `(.)baru` mencegat navigasi ke /projects/baru yang
 * berasal dari level yang sama (/projects), lalu menampilkannya sebagai dialog
 * di atas daftar — tanpa meninggalkan halaman.
 *
 * Navigasi langsung ke /projects/baru (URL ditempel, halaman di-refresh) tidak
 * dicegat dan tetap merender halaman penuh. docs/05 §5.4
 */
export default async function InterceptedProjectBaru() {
  await requireUser();
  return <CreateProjectDialog />;
}
