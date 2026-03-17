import { Skeleton } from "@/components/ui/skeleton";

function CommentSkeleton() {
  return (
    <div className="flex items-start gap-2 py-1.5">
      <Skeleton className="w-7 h-7 rounded-full shrink-0" />
      <div className="flex-1 flex flex-col gap-1.5">
        <Skeleton className="h-3 w-20 rounded" />
        <Skeleton className="h-3 w-full rounded" />
      </div>
    </div>
  );
}

export default function PostViewerPageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 py-3 border-b border-border shrink-0">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="h-4 w-10 rounded" />
      </div>

      {/* Mobile layout */}
      <div className="flex flex-col flex-1 overflow-hidden md:hidden">
        <div className="flex-1 overflow-y-auto">
          {/* Author row */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-2.5 w-32 rounded" />
            </div>
          </div>

          {/* Image placeholder */}
          <Skeleton className="w-full aspect-square rounded-none" />

          {/* Action bar */}
          <div className="flex items-center gap-4 px-4 pt-3 pb-2">
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="w-5 h-5 rounded" />
            <div className="flex-1" />
            <Skeleton className="w-6 h-6 rounded" />
          </div>

          {/* Likes */}
          <div className="px-4 pb-1">
            <Skeleton className="h-3.5 w-16 rounded" />
          </div>

          {/* Caption */}
          <div className="px-4 pb-2 flex flex-col gap-1.5">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>

          {/* Comments */}
          <div className="px-4 pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <CommentSkeleton key={i} />
            ))}
          </div>
        </div>

        {/* Comment input */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-border shrink-0">
          <Skeleton className="w-7 h-7 rounded-full shrink-0" />
          <Skeleton className="h-4 flex-1 rounded" />
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:flex flex-1 overflow-hidden max-w-10xl mx-auto w-full">
        {/* Left: image */}
        <div className="flex-1 bg-black flex items-center justify-center border-r border-border min-w-0">
          <Skeleton className="w-3/4 aspect-square rounded-none bg-muted/30" />
        </div>

        {/* Right: details */}
        <div className="w-[340px] flex-shrink-0 flex flex-col overflow-hidden">
          {/* Author */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border">
            <Skeleton className="w-9 h-9 rounded-full shrink-0" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-3.5 w-24 rounded" />
              <Skeleton className="h-2.5 w-32 rounded" />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4 px-4 pt-3 pb-2">
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="w-6 h-6 rounded" />
            <Skeleton className="w-5 h-5 rounded" />
            <div className="flex-1" />
            <Skeleton className="w-6 h-6 rounded" />
          </div>

          <div className="px-4 pb-2 flex flex-col gap-1.5">
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-2/3 rounded" />
          </div>

          <div className="flex-1 overflow-y-auto px-4 pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <CommentSkeleton key={i} />
            ))}
          </div>

          {/* Comment input */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
            <Skeleton className="w-7 h-7 rounded-full shrink-0" />
            <Skeleton className="h-4 flex-1 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
