import { redirect } from "next/navigation";

/**
 * `/akun` sendiri bukan halaman — pengaturan akun selalu dibuka pada salah satu
 * tab (docs/05 §5.3). Tanpa berkas ini alamat itu membalas 404, padahal wajar
 * ditulis langsung di bilah alamat.
 */
export default function AkunIndexPage() {
  redirect("/akun/profil");
}
