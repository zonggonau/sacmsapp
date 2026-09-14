import { cache } from "react";

import * as projectService from "@/services/project.service";

/**
 * Pemuat project ber-cache per-permintaan.
 *
 * Layout `[projectId]` butuh data untuk header, dan halaman di dalamnya butuh
 * data yang sama untuk isinya. Tanpa cache() satu pemuatan halaman menghasilkan
 * dua query identik.
 *
 * cache() milik React men-dedupe berdasarkan argumen selama satu permintaan
 * HTTP — pola yang sama dipakai getSession() di lib/auth-guard.ts.
 *
 * Berkas ini terpisah dari service agar lapisan service tetap murni dan bisa
 * diuji tanpa runtime React (docs/02 §2.2).
 */
export const loadProject = cache(async (projectId: string, userId: string) => {
  return projectService.getForUser(projectId, userId);
});
