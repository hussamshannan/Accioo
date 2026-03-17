import { Skeleton } from "@/components/ui/skeleton";

export function PostGridSkeleton({ count = 9 }) {
  return (
    <div className="grid grid-cols-3 md:grid-cols-4 gap-px">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-none" />
      ))}
    </div>
  );
}

export default function ProfilePageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="h-4 w-24 rounded" />
        <div className="flex-1" />
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>

      {/* Hero */}
      <div className="flex flex-col items-center px-5 pt-6 pb-4 gap-3">
        <Skeleton className="w-24 h-24 rounded-full" />
        <Skeleton className="h-5 w-32 rounded" />
        <Skeleton className="h-3 w-48 rounded" />
        <Skeleton className="h-3 w-36 rounded" />

        {/* Stats row */}
        <div className="flex w-full max-w-xs mt-1">
          <div className="flex-1 flex flex-col items-center gap-1.5 py-1">
            <Skeleton className="h-4 w-6 rounded" />
            <Skeleton className="h-2.5 w-8 rounded" />
          </div>
          <div className="w-px h-10 self-center bg-border" />
          <div className="flex-1 flex flex-col items-center gap-1.5 py-1">
            <Skeleton className="h-4 w-6 rounded" />
            <Skeleton className="h-2.5 w-10 rounded" />
          </div>
          <div className="w-px h-10 self-center bg-border" />
          <div className="flex-1 flex flex-col items-center gap-1.5 py-1">
            <Skeleton className="h-4 w-6 rounded" />
            <Skeleton className="h-2.5 w-10 rounded" />
          </div>
        </div>

        <Skeleton className="h-9 w-full max-w-xs rounded-full" />
      </div>

      {/* Tabs */}
      <div className="border-y border-border">
        <div className="flex">
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3 border-b-2 border-foreground">
            <Skeleton className="w-3.5 h-3.5 rounded" />
            <Skeleton className="h-2.5 w-8 rounded" />
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3">
            <Skeleton className="w-3.5 h-3.5 rounded" />
            <Skeleton className="h-2.5 w-8 rounded" />
          </div>
          <div className="flex-1 flex items-center justify-center gap-1.5 py-3">
            <Skeleton className="w-3.5 h-3.5 rounded" />
            <Skeleton className="h-2.5 w-10 rounded" />
          </div>
        </div>
      </div>

      {/* Post grid */}
      <PostGridSkeleton />
    </div>
  );
}
