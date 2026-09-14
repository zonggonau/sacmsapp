import { Skeleton } from "@/components/ui/skeleton";

export default function DomainLoading() {
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
