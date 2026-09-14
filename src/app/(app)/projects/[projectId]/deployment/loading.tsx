import { Skeleton } from "@/components/ui/skeleton";

export default function DeploymentLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Memuat deployment">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-28 rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
      </div>
    </div>
  );
}
