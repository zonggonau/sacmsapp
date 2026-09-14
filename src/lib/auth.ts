import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins/admin";
import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements } from "better-auth/plugins/admin/access";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendResetPasswordEmail, sendVerificationEmail } from "@/lib/mail";

/**
 * Konfigurasi Better Auth — docs/07-AUTH-DAN-RBAC.md §7.2
 *
 * BARIS TERPENTING di berkas ini adalah `input: false` pada role, status, dan
 * planId. Tanpa itu, penyerang bisa mengirim role: "SUPER_ADMIN" di payload
 * pendaftaran dan menjadi pemilik sistem (kerentanan mass assignment).
 */

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * Kontrol akses peran — menerjemahkan matriks kewenangan docs/07 §7.3 menjadi
 * izin yang dimengerti plugin admin Better Auth.
 *
 * Plugin admin hanya mengenal peran bawaan "admin" dan "user". Karena SaCMS
 * memakai USER / ADMIN / SUPER_ADMIN, ketiganya WAJIB didefinisikan di sini —
 * tanpa itu Better Auth menolak start dengan "Invalid admin roles".
 */
const ac = createAccessControl(defaultStatements);

const roles = {
  // Pengguna biasa tidak punya kewenangan administratif apa pun.
  USER: ac.newRole({ user: [], session: [] }),

  // Staf pendukung: boleh melihat dan menangguhkan, TIDAK boleh mengubah peran,
  // menghapus permanen, atau menyamar. UI-nya baru dibuat di v1.1 (docs/10 §10.11),
  // tapi batasannya ditetapkan sekarang supaya tidak ada yang lupa nanti.
  ADMIN: ac.newRole({
    user: ["list", "get", "ban"],
    session: ["list", "revoke"],
  }),

  // Pemilik sistem: seluruh kewenangan, termasuk menyamar sebagai admin lain.
  SUPER_ADMIN: ac.newRole({
    user: [...defaultStatements.user],
    session: [...defaultStatements.session],
  }),
};

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? appUrl,

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail({ to: user.email, name: user.name, url });
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60, // 1 jam — docs/07 §7.6
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail({ to: user.email, name: user.name, url });
    },
  },

  socialProviders: {
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 hari
    updateAge: 60 * 60 * 24, // perpanjang tiap 24 jam
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  /**
   * Rate limit di tingkat endpoint Better Auth.
   *
   * WAJIB ADA, dan bukan duplikasi dari lib/ratelimit.ts. Rate limit di
   * middleware Server Action hanya melindungi jalur formulir; endpoint REST
   * /api/auth/* dapat dipanggil langsung dan akan MELEWATI pemeriksaan itu.
   * Tanpa blok ini, brute force cukup menembak /api/auth/sign-in/email.
   *
   * Angkanya mengikuti kebijakan docs/07-AUTH-DAN-RBAC.md §7.7.
   */
  rateLimit: {
    enabled: true,
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 900, max: 5 },
      "/sign-up/email": { window: 3600, max: 3 },
      "/request-password-reset": { window: 3600, max: 3 },
      "/reset-password": { window: 3600, max: 5 },
      "/send-verification-email": { window: 60, max: 1 },
    },
  },

  user: {
    additionalFields: {
      // input: false => nilai dari klien DIABAIKAN. Jangan pernah dihapus.
      role: { type: "string", defaultValue: "USER", input: false },
      status: { type: "string", defaultValue: "ACTIVE", input: false },
      planId: { type: "string", required: false, input: false },
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Setiap pengguna baru otomatis masuk paket FREE.
        before: async (user) => {
          // Pendaftaran ditutup dari /admin/sistem. Diperiksa DI SINI, bukan
          // hanya di action daftar: endpoint /api/auth/sign-up/email dan login
          // Google pertama kali sama-sama membuat pengguna lewat hook ini.
          // Kunci ditulis literal karena lib tidak boleh mengimpor service
          // (sama dengan SETTING_KEYS.signupEnabled di system.service.ts).
          const signup = await db.systemSetting.findUnique({
            where: { key: "signup.enabled" },
            select: { value: true },
          });
          if (signup?.value === false) {
            throw new Error("SIGNUP_CLOSED");
          }

          const free = await db.plan.findUnique({ where: { slug: "free" } });

          if (!free) {
            logger.error("auth.signup.no_free_plan", {
              hint: "Jalankan `pnpm db:seed` untuk membuat paket dasar.",
            });
            throw new Error("Paket dasar belum tersedia.");
          }

          return {
            data: { ...user, planId: free.id, role: "USER", status: "ACTIVE" },
          };
        },
      },
    },
  },

  advanced: {
    cookiePrefix: "sacms",
    useSecureCookies: process.env.NODE_ENV === "production",
  },

  plugins: [
    admin({
      ac,
      roles,
      defaultRole: "USER",
      adminRoles: ["ADMIN", "SUPER_ADMIN"],
      // Sesi impersonasi berakhir sendiri dalam 60 menit — docs/07 §7.5.
      impersonationSessionDuration: 60 * 60,
    }),
    // nextCookies() HARUS menjadi plugin terakhir — ia yang membuat cookie
    // tertulis saat auth dipanggil dari dalam Server Action.
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;
