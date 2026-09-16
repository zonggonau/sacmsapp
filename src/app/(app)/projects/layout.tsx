/**
 * Layout daftar project.
 *
 * Hanya meneruskan `children`. "Project Baru" adalah halaman penuh biasa
 * (`/projects/baru`) — dialog lewat parallel + intercepting route sudah dihapus,
 * lihat [ADR-013](../../../../docs/adr/ADR-013-formulir-project-baru-tanpa-dialog.md)
 * dan docs/05 §5.4.
 */
export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
