import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/features/account/change-password-form";
import { DeleteAccountDialog } from "@/components/features/account/delete-account-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getSession, requireUser } from "@/lib/auth-guard";

export const metadata: Metadata = {
  title: "Keamanan",
  robots: { index: false, follow: false },
};

export default async function KeamananPage() {
  const user = await requireUser();
  const session = await getSession();

  return (
    <div className="space-y-6">
      {session?.session.impersonatedBy ? (
        <Card className="border-primary/40 bg-primary-subtle">
          <CardHeader>
            <CardTitle className="text-primary-text text-base">
              Sesi penyamaran aktif
            </CardTitle>
            <CardDescription>
              Anda sedang melihat akun ini sebagai administrator. Perubahan yang
              bersifat merusak dinonaktifkan.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Status akun</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-2">
            {/* min-w-0 wajib: tanpa itu `truncate` tidak pernah aktif di dalam
                flex/grid, dan email panjang membuat halaman bergulir menyamping. */}
            <div className="min-w-0 space-y-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Email
              </dt>
              <dd className="flex min-w-0 items-center gap-2 text-sm">
                <span className="truncate">{user.email}</span>
                {user.emailVerified ? (
                  <Badge variant="success">Terkonfirmasi</Badge>
                ) : (
                  <Badge variant="warning">Belum dikonfirmasi</Badge>
                )}
              </dd>
            </div>

            <div className="space-y-1">
              <dt className="text-muted-foreground text-xs tracking-wide uppercase">
                Peran
              </dt>
              <dd className="text-sm">
                {user.role === "SUPER_ADMIN" ? (
                  <Badge>Super Admin</Badge>
                ) : user.role === "ADMIN" ? (
                  <Badge variant="subtle">Admin</Badge>
                ) : (
                  <Badge variant="neutral">Pengguna</Badge>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ubah kata sandi</CardTitle>
          <CardDescription>
            Demi keamanan, mengubah kata sandi akan mengeluarkan Anda dari semua
            perangkat lain.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      {/* Hapus akun sendiri — docs/12 §12.6 (UU PDP). Akun admin tidak boleh
          hilang lewat jalur mandiri, jadi kartunya tidak ditampilkan. */}
      {user.role === "USER" ? (
        <Card className="border-destructive/40">
          <CardHeader>
            <CardTitle className="text-destructive text-base">Hapus akun</CardTitle>
            <CardDescription>
              Menghapus akun juga menghapus semua project dan menurunkan website yang
              sudah terbit. Sisa kredit hangus. Tindakan ini tidak bisa dibatalkan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <DeleteAccountDialog email={user.email} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
