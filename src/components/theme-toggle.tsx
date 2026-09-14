"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Tombol ganti tema.
 *
 * Pertukaran ikon dilakukan CSS (`dark:` varian), bukan state React. Akibatnya
 * markup server dan klien identik — tidak ada ketidakcocokan hidrasi, tidak
 * perlu gerbang `mounted`, dan tidak ada lompatan layout.
 * docs/04-DESIGN-SYSTEM.md §4.9
 */
export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Ganti tema gelap atau terang"
    >
      <Sun className="hidden size-4 dark:block" />
      <Moon className="size-4 dark:hidden" />
    </Button>
  );
}
