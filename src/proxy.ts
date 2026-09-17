import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Lapis 1 dari empat lapis pertahanan — docs/07-AUTH-DAN-RBAC.md §7.4.
 *
 * Next.js 16 mengganti konvensi `middleware.ts` menjadi `proxy.ts` dengan
 * fungsi bernama `proxy`. Perannya tidak berubah.
 *
 * PERINGATAN: berkas ini HANYA memeriksa keberadaan cookie, bukan keabsahannya.
 * Tujuannya semata-mata mengalihkan pengguna lebih awal supaya tidak memuat
 * halaman yang pasti ditolak. Otorisasi sungguhan ada di layout grup
 * (lib/auth-guard.ts), middleware Server Action, dan klausa where query.
 *
 * Jangan pernah menambahkan keputusan keamanan yang HANYA ada di sini.
 *
 * Berkas ini juga memasang Content Security Policy dengan nonce per permintaan
 * — docs/12-KEAMANAN.md §12.3.
 */

// robots.txt & sitemap.xml tidak tertangkap pengecualian ekstensi di matcher —
// tanpa daftar ini keduanya dialihkan ke /masuk dan tidak terbaca mesin pencari.
const PUBLIC_PATHS = [
  "/",
  "/harga",
  "/enterprise",
  "/fitur",
  "/robots.txt",
  "/sitemap.xml",
];
const PUBLIC_PREFIXES = [
  "/legal",
  // Wajib publik: setelah mendaftar, pengguna BELUM punya sesi (email belum
  // dikonfirmasi). Tanpa ini mereka dipantulkan ke /masuk dan alur pendaftaran
  // putus di tengah jalan.
  "/verifikasi-email",
  "/akun-ditangguhkan",
  // Tujuan pengalihan maintenance mode; harus terbuka tanpa pemeriksaan sesi.
  "/pemeliharaan",
];
const AUTH_PAGES = ["/masuk", "/daftar", "/lupa-sandi", "/atur-sandi"];

/** Origin ingest Sentry sisi browser, diturunkan dari DSN publik. */
function sentryOrigin(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
}

/**
 * Kebijakan CSP — setiap sumber di sini punya alasan tertulis di docs/12 §12.3.
 * Menambah sumber = memperbarui dokumen itu di PR yang sama.
 */
function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  const sentry = sentryOrigin();
  // Pratinjau tiruan (V0_MOCK) berupa URL data:, bukan domain v0.
  const allowDataFrame = process.env.V0_MOCK !== "false";
  const isHttps = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

  return [
    "default-src 'self'",
    // 'strict-dynamic': skrip yang dimuat skrip ber-nonce ikut dipercaya,
    // sehingga chunk Next.js tidak perlu didaftarkan satu per satu.
    // 'unsafe-eval' HANYA di development (React memakainya untuk jejak error).
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // 'unsafe-inline' untuk gaya: atribut style hasil SSR (lebar pratinjau,
    // Radix, Sonner) tidak bisa diberi nonce. Risiko injeksi gaya jauh lebih
    // kecil daripada skrip, dan skrip tetap dikunci ketat.
    "style-src 'self' 'unsafe-inline'",
    // Avatar Google dan gambar dari situs pengguna.
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self'${sentry ? ` ${sentry}` : ""}`,
    // Pratinjau v0 (*.vusercontent.net) dan situs terbit (*.vercel.app).
    `frame-src https://*.vusercontent.net https://*.vercel.app${allowDataFrame ? " data:" : ""}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hasSessionCookie = Boolean(getSessionCookie(req, { cookiePrefix: "sacms" }));

  // Sudah masuk tapi membuka halaman autentikasi -> ke dashboard
  if (AUTH_PAGES.some((p) => pathname.startsWith(p)) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const isPublic =
    AUTH_PAGES.some((p) => pathname.startsWith(p)) ||
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  // Halaman terlindungi tanpa cookie -> ke halaman masuk, ingat tujuannya
  if (!isPublic && !hasSessionCookie) {
    const url = new URL("/masuk", req.url);
    // Sertakan query string: tanpa ini pengguna yang membuka tautan berfilter
    // (mis. /projects?q=intan&status=LIVE) kehilangan filternya setelah masuk.
    url.searchParams.set("lanjut", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  // Nonce baru untuk setiap permintaan. Next.js membacanya dari header CSP
  // permintaan dan menempelkannya ke skrip framework secara otomatis; layout
  // akar membaca `x-nonce` untuk skrip tema.
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
