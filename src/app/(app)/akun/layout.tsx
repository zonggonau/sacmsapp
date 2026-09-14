import { NavItem } from "@/components/layout/nav-item";
import { ACCOUNT_NAV } from "@/config/navigation";

/**
 * Nested layout pengaturan akun.
 *
 * Berkat nesting, berpindah antara Profil dan Keamanan TIDAK merender ulang
 * sidebar, topbar, maupun sub-nav ini — hanya isi terdalam yang berubah.
 * docs/05 §5.3
 */
export default function AkunLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan Akun</h1>
        <p className="text-muted-foreground text-sm">
          Kelola identitas dan keamanan akun SaCMS Anda.
        </p>
      </div>

      <div className="flex flex-col gap-8 md:flex-row">
        <nav
          className="flex gap-1 md:w-48 md:shrink-0 md:flex-col"
          aria-label="Navigasi pengaturan akun"
        >
          {ACCOUNT_NAV.map((item) => (
            <NavItem
              key={item.href}
              label={item.label}
              href={item.href}
              exact={item.exact}
              icon={<item.icon className="size-4 shrink-0" />}
            />
          ))}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
