import { Skeleton } from "@/components/ui/skeleton";

export function AuthFlowSkeleton() {
  return (
    <div className="min-h-screen bg-linear-to-b from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-10 w-40 mx-auto" />
        <Skeleton className="h-48 w-full rounded-xl" />
        <Skeleton className="h-5 w-56 mx-auto" />
      </div>
    </div>
  );
}
