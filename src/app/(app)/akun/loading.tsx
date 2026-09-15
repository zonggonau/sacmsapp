import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton isi halaman akun; judul & sub-nav dari layout tetap tampil — docs/05 §5.5. */
export default function AkunLoading() {
  return (
    <div
      className="border-border space-y-4 rounded-lg border p-6"
      aria-busy="true"
      aria-label="Memuat pengaturan akun"
    >
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <div className="space-y-3 pt-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-9 w-full" />
      </div>
      <Skeleton className="h-9 w-36" />
    </div>
  );
}
