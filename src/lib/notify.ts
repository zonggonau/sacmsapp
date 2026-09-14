import { toast } from "sonner";

import { PLAN_PAGE, UPGRADE_HINT } from "@/config/quota";

/**
 * Menampilkan error action. Pesan batas kuota mendapat tombol "Lihat Paket" —
 * docs/11 §11.6. Dipakai di komponen klien yang aksinya bisa terkena kuota.
 */
export function toastActionError(message: string | undefined, fallback: string) {
  const text = message ?? fallback;

  if (text.includes(UPGRADE_HINT)) {
    toast.error(text.replace(UPGRADE_HINT, "").trim(), {
      duration: 10_000,
      action: {
        label: "Lihat Paket",
        onClick: () => window.location.assign(PLAN_PAGE),
      },
    });
    return;
  }

  toast.error(text);
}
