import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

/**
 * ESLint flat config.
 *
 * eslint-config-next 16 sudah mengekspor flat config array secara native,
 * jadi FlatCompat (@eslint/eslintrc) TIDAK dipakai — membungkusnya justru
 * menyebabkan error "Converting circular structure to JSON".
 */
const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "src/generated/**", "next-env.d.ts"],
  },

  ...nextCoreWebVitals,
  ...nextTypeScript,
  prettier,

  /* ---------------------------------------------------------------
   * Aturan yang menegakkan guardrail di CLAUDE.md dan docs/03 §3.8.
   * Ini bukan preferensi gaya — ini pagar arsitektur.
   * ------------------------------------------------------------- */
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "v0-sdk",
              message:
                "SDK v0 hanya boleh diimpor di src/lib/v0/. Lihat docs/02 §2.2 (anti-corruption layer).",
            },
          ],
          patterns: [
            {
              group: ["@/generated/*", "**/generated/prisma/*"],
              message:
                "Akses Prisma lewat '@/lib/db', bukan langsung ke client hasil generate.",
            },
          ],
        },
      ],
    },
  },

  /* lib/v0 adalah satu-satunya tempat yang boleh menyentuh SDK v0 */
  {
    files: ["src/lib/v0/**/*.ts"],
    rules: { "no-restricted-imports": "off" },
  },

  /* logger boleh menulis ke console; db.ts boleh impor client hasil generate */
  {
    files: ["src/lib/logger.ts"],
    rules: { "no-console": "off" },
  },
  /**
   * db.ts mengimpor client hasil generate; types/db.ts me-re-export tipe dan
   * enum-nya. Keduanya adalah satu-satunya pintu ke folder generated.
   */
  {
    files: ["src/lib/db.ts", "src/types/db.ts"],
    rules: { "no-restricted-imports": "off" },
  },
];

export default eslintConfig;
