/** Skeleton meniru bentuk akhir (docs/05 §5.5). Bukan loading.tsx: batas Suspense
 * tingkat rute membuat respons mulai dialirkan sebelum pemeriksaan kepemilikan,
 * sehingga project milik orang lain membalas 200, bukan 404. */
import { Skeleton } from "@/components/ui/skeleton";

export function BuilderSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_1fr]">
      <div className="space-y-4">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
      <Skeleton className="h-[520px] rounded-lg" />
    </div>
  );
}
