import Link from "next/link";
import { FolderX } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Ditampilkan juga saat project ADA tapi milik pengguna lain.
 *
 * Pesannya sengaja sama untuk kedua kasus — membedakan "tidak ada" dari
 * "bukan milik Anda" membocorkan keberadaan data orang lain (docs/12 A1).
 *
 * Dirender karena notFound() dipanggil dari HALAMAN, bukan dari
 * `[projectId]/layout.tsx`. Layout tidak bisa membungkus halaman not-found-nya
 * sendiri; memanggilnya dari sana membuat Next.js membalas 500 alih-alih 404.
 * Lihat komentar di layout tersebut.
 */
export default function ProjectNotFound() {
  return (
    <div className="flex flex-col items-center gap-5 py-16 text-center">
      <div className="bg-muted grid size-12 place-items-center rounded-full">
        <FolderX className="text-muted-foreground size-6" />
      </div>

      <div className="max-w-sm space-y-2">
        <h1 className="text-xl font-semibold tracking-tight">
          Project tidak ditemukan
        </h1>
        <p className="text-muted-foreground text-sm">
          Project ini tidak ada, sudah dihapus, atau bukan milik akun Anda.
        </p>
      </div>

      <Button asChild>
        <Link href="/projects">Kembali ke Daftar Project</Link>
      </Button>
    </div>
  );
}
