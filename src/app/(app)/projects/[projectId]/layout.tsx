import { ProjectHeader } from "@/components/features/project/project-header";
import { requireUser } from "@/lib/auth-guard";
import { loadProject } from "@/lib/project-loader";

/**
 * Nested layout project — docs/05 §5.3.
 *
 * Berpindah antar tab tidak merender ulang sidebar, topbar, maupun header ini.
 *
 * KENAPA notFound() TIDAK DIPANGGIL DI SINI:
 * sebuah layout tidak bisa membungkus halaman not-found-nya sendiri — layout
 * itulah yang gagal. Memanggil notFound() dari layout membuat Next.js membalas
 * status 500 (dengan digest NEXT_HTTP_ERROR_FALLBACK;404), padahal 404 yang
 * benar. Halaman di dalamnya yang memanggilnya.
 *
 * Itu TIDAK membuka celah kepemilikan: setiap halaman harus memanggil
 * loadProject(projectId, user.id) untuk mendapat datanya, dan query itu
 * memfilter berdasarkan userId. Halaman yang lupa memanggilnya tidak punya
 * apa pun untuk dirender.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  // Next.js 16: params adalah Promise.
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requireUser();

  const project = await loadProject(projectId, user.id);

  // Tidak ada / bukan milik pengguna ini: serahkan ke halaman, yang memanggil
  // notFound() sehingga status 404 keluar dengan benar.
  if (!project) return <>{children}</>;

  return (
    // Ruang kerja project (ringkasan, builder, deployment, domain, pengaturan)
    // memakai lebar penuh — lihat pembungkus konten di app-shell.tsx.
    <div data-lebar="penuh" className="space-y-6">
      <ProjectHeader project={project} />
      {children}
    </div>
  );
}
