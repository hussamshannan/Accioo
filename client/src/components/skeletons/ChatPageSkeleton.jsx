import { Skeleton } from "@/components/ui/skeleton";

function MessageBubbleSkeleton({ isMe, width = "w-48" }) {
  return (
    <div className={`flex ${isMe ? "justify-end" : "justify-start"} px-4 py-1`}>
      <Skeleton
        className={`${width} h-10 ${isMe ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-tl-sm"}`}
      />
    </div>
  );
}

function DateSeparatorSkeleton() {
  return (
    <div className="flex justify-center py-3">
      <Skeleton className="h-5 w-20 rounded-full" />
    </div>
  );
}

export default function ChatPageSkeleton() {
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Nav header */}
      <div className="flex items-center justify-between px-3 py-2.5 shrink-0">
        {/* Back button */}
        <Skeleton className="w-9 h-9 rounded-full" />

        {/* Center pill */}
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-3.5 w-28 rounded" />
          <Skeleton className="h-2.5 w-16 rounded" />
        </div>

        {/* Avatar */}
        <Skeleton className="w-9 h-9 rounded-full" />
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-hidden px-0 py-4 flex flex-col gap-1">
        <DateSeparatorSkeleton />
        <MessageBubbleSkeleton isMe={false} width="w-52" />
        <MessageBubbleSkeleton isMe={false} width="w-36" />
        <MessageBubbleSkeleton isMe width="w-44" />
        <MessageBubbleSkeleton isMe width="w-56" />
        <MessageBubbleSkeleton isMe={false} width="w-40" />
        <MessageBubbleSkeleton isMe width="w-32" />
        <div className="flex-1" />
        <DateSeparatorSkeleton />
        <MessageBubbleSkeleton isMe={false} width="w-48" />
        <MessageBubbleSkeleton isMe width="w-60" />
        <MessageBubbleSkeleton isMe={false} width="w-36" />
        <MessageBubbleSkeleton isMe width="w-44" />
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-border shrink-0">
        <Skeleton className="w-8 h-8 rounded-full shrink-0" />
        <Skeleton className="h-10 flex-1 rounded-full" />
        <Skeleton className="w-10 h-10 rounded-full shrink-0" />
      </div>
    </div>
  );
}
