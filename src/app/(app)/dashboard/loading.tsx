import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton MENIRU BENTUK AKHIR halaman, bukan spinner — docs/05 §5.5.
 * Tujuannya supaya tidak ada lompatan tata letak saat konten datang.
 */
export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>

      <Skeleton className="h-48 w-full rounded-lg" />

      <div className="grid gap-4 sm:grid-cols-3">
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
        <Skeleton className="h-28 rounded-lg" />
      </div>
    </div>
  );
}
