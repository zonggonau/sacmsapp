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
 */

const PUBLIC_PATHS = ["/", "/harga", "/fitur"];
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

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const hasSessionCookie = Boolean(getSessionCookie(req, { cookiePrefix: "sacms" }));

  // Sudah masuk tapi membuka halaman autentikasi -> ke dashboard
  if (AUTH_PAGES.some((p) => pathname.startsWith(p))) {
    return hasSessionCookie
      ? NextResponse.redirect(new URL("/dashboard", req.url))
      : NextResponse.next();
  }

  const isPublic =
    PUBLIC_PATHS.includes(pathname) ||
    PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) return NextResponse.next();

  // Halaman terlindungi tanpa cookie -> ke halaman masuk, ingat tujuannya
  if (!hasSessionCookie) {
    const url = new URL("/masuk", req.url);
    // Sertakan query string: tanpa ini pengguna yang membuka tautan berfilter
    // (mis. /projects?q=intan&status=LIVE) kehilangan filternya setelah masuk.
    url.searchParams.set("lanjut", pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
