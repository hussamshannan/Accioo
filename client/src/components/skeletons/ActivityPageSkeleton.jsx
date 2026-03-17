import { Skeleton } from "@/components/ui/skeleton";

function ActivityItemSkeleton({ hasExtraLine = false }) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border">
      {/* Avatar with badge */}
      <div className="relative shrink-0">
        <Skeleton className="w-10 h-10 rounded-full" />
        <Skeleton className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-background" />
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-3/4 rounded" />
        {hasExtraLine && <Skeleton className="h-3 w-2/3 rounded" />}
        <Skeleton className="h-2.5 w-16 rounded" />
      </div>

      {/* Thumbnail */}
      <Skeleton className="w-12 h-12 rounded shrink-0" />
    </div>
  );
}

export function ActivityFeedSkeleton() {
  return (
    <>
      <ActivityItemSkeleton />
      <ActivityItemSkeleton hasExtraLine />
      <ActivityItemSkeleton />
      <ActivityItemSkeleton hasExtraLine />
      <ActivityItemSkeleton />
      <ActivityItemSkeleton hasExtraLine />
      <ActivityItemSkeleton />
      <ActivityItemSkeleton hasExtraLine />
    </>
  );
}

export default function ActivityPageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="h-4 w-16 rounded" />
      </div>

      {/* Activity feed */}
      <div className="flex-1 overflow-hidden">
        <ActivityFeedSkeleton />
      </div>
    </div>
  );
}
