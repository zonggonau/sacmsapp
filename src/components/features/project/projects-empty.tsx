import Link from "next/link";
import { FolderPlus, SearchX, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Dua keadaan kosong yang BERBEDA, dan membedakannya penting:
 * - belum punya project sama sekali  -> ajak membuat yang pertama
 * - punya project tapi filter tidak cocok -> ajak membersihkan filter
 *
 * Menampilkan "belum ada project" pada pengguna yang punya 20 project tapi
 * salah filter adalah pesan yang menyesatkan.
 */
export function ProjectsEmpty({ filtered }: { filtered: boolean }) {
  if (filtered) {
    return (
      <div className="border-border flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
        <div className="bg-muted grid size-11 place-items-center rounded-full">
          <SearchX className="text-muted-foreground size-5" />
        </div>
        <div className="space-y-1">
          <p className="font-medium">Tidak ada project yang cocok</p>
          <p className="text-muted-foreground text-sm">
            Coba ubah kata pencarian atau pilih status lain.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/projects">Bersihkan Filter</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border flex flex-col items-center gap-4 rounded-lg border border-dashed py-16 text-center">
      <div className="bg-primary-subtle grid size-11 place-items-center rounded-full">
        <FolderPlus className="text-primary-text size-5" />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="font-medium">Belum ada website</p>
        <p className="text-muted-foreground text-sm">
          Mulai dengan menceritakan website yang Anda inginkan dalam satu kalimat.
        </p>
      </div>
      <Button asChild>
        <Link href="/projects/baru">
          <Sparkles className="size-4" />
          Buat Website Pertama
        </Link>
      </Button>
    </div>
  );
}
