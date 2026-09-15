/** Skeleton meniru bentuk akhir (docs/05 §5.5). Bukan loading.tsx: batas Suspense
 * tingkat rute membuat respons mulai dialirkan sebelum pemeriksaan kepemilikan,
 * sehingga project milik orang lain membalas 200, bukan 404. */
import { Skeleton } from "@/components/ui/skeleton";

export function DomainSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat custom domain">
      <div className="space-y-2">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <Skeleton className="h-24 rounded-lg" />
      <Skeleton className="h-40 rounded-lg" />
    </div>
  );
}
