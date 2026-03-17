import { Skeleton } from "@/components/ui/skeleton";

function StoryItemSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1 shrink-0">
      <Skeleton className="w-14 h-14 rounded-full" />
      <Skeleton className="w-10 h-2.5 rounded" />
    </div>
  );
}

export function ConvRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="h-3 w-40 rounded" />
      </div>
      <div className="flex flex-col items-end gap-2 shrink-0">
        <Skeleton className="h-2.5 w-10 rounded" />
        <Skeleton className="w-4 h-4 rounded-full" />
      </div>
    </div>
  );
}

export function ConvListSkeleton() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <ConvRowSkeleton key={i} />
      ))}
    </>
  );
}

export default function HomePageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <Skeleton className="h-6 w-20 rounded" />
        <div className="flex items-center gap-2">
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-8 h-8 rounded-full" />
          <Skeleton className="w-[30px] h-[30px] rounded-full" />
        </div>
      </div>

      {/* Stories Bar */}
      <div className="shrink-0 px-4 pt-3 border-b border-border pb-3">
        <div className="flex gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <StoryItemSkeleton key={i} />
          ))}
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-hidden">
        <ConvListSkeleton />
      </div>
    </div>
  );
}
