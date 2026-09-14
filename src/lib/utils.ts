import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Menggabungkan class Tailwind dengan benar (yang belakangan menang). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
