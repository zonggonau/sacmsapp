import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="bg-muted grid size-12 place-items-center rounded-full">
          <FileQuestion className="text-muted-foreground size-6" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            Halaman tidak ditemukan
          </h1>
          <p className="text-muted-foreground text-sm">
            Alamat yang Anda buka tidak ada, atau sudah dipindahkan.
          </p>
        </div>

        <Button asChild>
          <Link href="/">Kembali ke Beranda</Link>
        </Button>
      </div>
    </div>
  );
}
