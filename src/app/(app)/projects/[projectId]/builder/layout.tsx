/**
 * Layout builder — docs/05-STRUKTUR-APLIKASI.md §5.3.
 *
 * Menyediakan kerangka tinggi penuh untuk panel terbelah (chat | pratinjau).
 * Dipisahkan dari halaman supaya berpindah ke tab lain tidak merender ulang
 * header project maupun sidebar.
 */
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-0 flex-1 flex-col">{children}</div>;
}
