/**
 * Log terstruktur (JSON) — docs/02 §2.9, docs/12 §12.6.
 *
 * Dua aturan:
 * 1. Penyamaran data sensitif terjadi DI SINI, bukan bergantung pada setiap
 *    pemanggil mengingatnya.
 * 2. Setiap log build wajib membawa correlationId supaya satu build bisa
 *    ditelusuri utuh lintas layanan.
 */

type Level = "debug" | "info" | "warn" | "error";

export type LogContext = Record<string, unknown>;

/** Kunci yang isinya tidak pernah boleh masuk log. */
const REDACTED_KEYS = [
  "password",
  "token",
  "secret",
  "apikey",
  "api_key",
  "authorization",
  "cookie",
  "email",
  "prompt",
  "accesstoken",
  "refreshtoken",
];

const REDACTED = "[disamarkan]";

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value;

  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));

  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    out[key] = REDACTED_KEYS.includes(key.toLowerCase())
      ? REDACTED
      : redact(val, depth + 1);
  }
  return out;
}

const LEVEL_ORDER: Record<Level, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const MIN_LEVEL: Level = process.env.NODE_ENV === "production" ? "info" : "debug";

function write(level: Level, message: string, context?: LogContext) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[MIN_LEVEL]) return;

  const entry = {
    level,
    message,
    time: new Date().toISOString(),
    ...(context ? (redact(context) as LogContext) : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export interface Logger {
  debug(message: string, context?: LogContext): void;
  info(message: string, context?: LogContext): void;
  warn(message: string, context?: LogContext): void;
  error(message: string, context?: LogContext): void;
  /** Logger turunan yang selalu membawa konteks tetap (mis. correlationId). */
  child(bound: LogContext): Logger;
}

function create(bound: LogContext = {}): Logger {
  return {
    debug: (m, c) => write("debug", m, { ...bound, ...c }),
    info: (m, c) => write("info", m, { ...bound, ...c }),
    warn: (m, c) => write("warn", m, { ...bound, ...c }),
    error: (m, c) => write("error", m, { ...bound, ...c }),
    child: (extra) => create({ ...bound, ...extra }),
  };
}

export const logger = create();
