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
      {/* Lebar konten dibatasi max-w-6xl (1152px, sama dengan halaman harga) dan diletakkan di tengah,
          supaya grid kartu, builder, dan tab project tidak melebar penuh di layar lebar. */}
      <div className="mx-auto w-full max-w-6xl">{children}</div>
      {modal}
    </>
  );
}
