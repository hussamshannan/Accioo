import { Skeleton } from "@/components/ui/skeleton";

export function ContactRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
      <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        <Skeleton className="h-3.5 w-28 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Skeleton className="w-8 h-8 rounded-full" />
        <Skeleton className="w-8 h-8 rounded-full" />
      </div>
    </div>
  );
}

export function ContactListSkeleton({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ContactRowSkeleton key={i} />
      ))}
    </>
  );
}
