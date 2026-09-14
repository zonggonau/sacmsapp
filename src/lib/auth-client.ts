"use client";

import { createAuthClient } from "better-auth/react";
import { adminClient } from "better-auth/client/plugins";

/**
 * Klien Better Auth untuk browser.
 *
 * Cakupan pemakaiannya SEMPIT dan disengaja: hanya untuk alur yang memerlukan
 * pengalihan (redirect) browser, yaitu OAuth sosial dan keluar (sign out).
 *
 * Masuk, daftar, lupa sandi, dan atur sandi TIDAK memakai klien ini — semuanya
 * lewat Server Action, supaya rate limit dan audit log terpasang di satu tempat.
 * Lihat docs/08-SERVER-ACTIONS.md.
 */
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  plugins: [adminClient()],
});

export const { signIn, signOut, useSession } = authClient;
