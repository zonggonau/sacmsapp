"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavActive, type NavItem as NavItemType } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * Item navigasi dengan keadaan aktif khas SaCMS:
 * bar oranye di kiri + latar oranye tipis + teks primary-text.
 *
 * Memakai `primary-text` (bukan `primary`) karena token itu otomatis menjadi
 * #FFA274 di dark dan #C24A00 di light — keduanya lulus kontras WCAG AA.
 * docs/04-DESIGN-SYSTEM.md §4.7
 */
export function NavItem({ item }: { item: NavItemType }) {
  const pathname = usePathname();
  const active = isNavActive(pathname, item);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
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
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  );
}
