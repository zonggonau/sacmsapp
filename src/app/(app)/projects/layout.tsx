/**
 * Layout daftar project.
 *
 * Menerima dua slot: `children` (halaman biasa) dan `modal` (parallel route
 * @modal). Kombinasi parallel + intercepting route membuat "Project Baru"
 * terbuka sebagai dialog dari /projects, tetapi menjadi halaman penuh bila
 * URL-nya dibuka langsung atau halaman di-refresh. docs/05 §5.4
 */
export default function ProjectsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
