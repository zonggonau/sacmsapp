"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

/**
 * Item navigasi dengan keadaan aktif khas SaCMS:
 * bar oranye di kiri + latar oranye tipis + teks primary-text.
 *
 * Memakai `primary-text` (bukan `primary`) karena token itu otomatis menjadi
 * #FFA274 di dark dan #C24A00 di light — keduanya lulus kontras WCAG AA.
 * docs/04-DESIGN-SYSTEM.md §4.7
 *
 * PENTING — `icon` bertipe ReactNode, BUKAN komponen.
 * Komponen ikon Lucide adalah fungsi, dan fungsi tidak bisa diserialisasi
 * melewati batas Server -> Client Component. Mengirimnya membuat Next.js
 * melempar "Functions cannot be passed directly to Client Components" dan
 * seluruh halaman membalas status 500 meskipun isinya tetap terender.
 * Pemanggil me-render ikonnya lebih dulu, lalu mengirim elemen hasilnya.
 */
export function NavItem({
  label,
  href,
  icon,
  exact = false,
}: {
  label: string;
  href: string;
  icon: ReactNode;
  exact?: boolean;
}) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      data-active={active}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex items-center gap-3 rounded-md px-3 py-2",
        "text-sm font-medium transition-colors",
        "text-muted-foreground hover:bg-accent hover:text-foreground",
        "data-[active=true]:bg-primary-subtle data-[active=true]:text-primary-text",
        "data-[active=true]:before:absolute data-[active=true]:before:left-0",
        "data-[active=true]:before:h-5 data-[active=true]:before:w-0.5",
        "data-[active=true]:before:bg-primary data-[active=true]:before:rounded-r-full",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
