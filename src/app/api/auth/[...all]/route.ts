import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/auth";

/**
 * Handler Better Auth.
 *
 * Salah satu dari empat Route Handler yang diizinkan di proyek ini
 * (docs/08-SERVER-ACTIONS.md §8.1). Menangani callback OAuth, verifikasi email,
 * dan endpoint internal Better Auth.
 */
export const { GET, POST } = toNextJsHandler(auth.handler);
