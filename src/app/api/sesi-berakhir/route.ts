import { NextResponse, type NextRequest } from "next/server";

/**
 * Membersihkan cookie sesi yang sudah tidak sah, lalu ke /masuk.
 *
 * Tanpa ini terjadi putaran pengalihan tanpa akhir: sesi yang dicabut (akun
 * ditangguhkan, sesi kedaluwarsa, dihapus admin) masih meninggalkan cookie.
 * Layout mengalihkan ke /masuk karena sesi tidak sah, sementara proxy — yang
 * hanya melihat KEBERADAAN cookie — memantulkan /masuk kembali ke /dashboard.
 *
 * Aman dipanggil siapa saja: hanya menghapus cookie milik peminta sendiri.
 */
export function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/masuk", req.url));

  for (const { name } of req.cookies.getAll()) {
    const isAuthCookie =
      name.startsWith("sacms.") || name.startsWith("__Secure-sacms.");
    if (!isAuthCookie) continue;

    res.cookies.set(name, "", {
      path: "/",
      maxAge: 0,
      httpOnly: true,
      sameSite: "lax",
      // Cookie berawalan __Secure- hanya bisa ditimpa oleh Set-Cookie yang Secure.
      secure: name.startsWith("__Secure-") || req.nextUrl.protocol === "https:",
    });
  }

  return res;
}
