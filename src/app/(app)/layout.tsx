import { AppShell } from "@/components/layout/app-shell";
import { requireUser } from "@/lib/auth-guard";

/**
 * Gerbang tunggal area terautentikasi — lapis 2 pertahanan (docs/07 §7.4).
 *
 * Karena guard tinggal di layout grup, setiap halaman di dalam (app) otomatis
 * terlindungi. Tidak ada halaman yang bisa lupa memasang pemeriksaan.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        role: user.role,
      }}
    >
      {children}
    </AppShell>
  );
}
