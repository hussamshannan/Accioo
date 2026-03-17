import { useEffect, useState, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { getActivity } from "../services/profileService";
import { slideFromTop, staggerFadeUp } from "@/utils/animations";
import { ScrollArea } from "@/components/ui/scroll-area";
import UserAvatar from "@/components/ui/UserAvatar";
import { Heart, MessageCircle, Tag, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActivityFeedSkeleton } from "@/components/skeletons/ActivityPageSkeleton";

function timeAgo(date) {
  const seconds = Math.floor((Date.now() - new Date(date)) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString([], { month: "short", day: "numeric" });
}

function LikeItem({ item, onClick }) {
  const likers = item.likers || [];
  const shown = likers.slice(0, 3);
  const rest = likers.length - shown.length;

  const names = likers
    .slice(0, 2)
    .map((u) => u.displayName || u.username)
    .join(", ");
  const suffix = rest > 0 ? ` and ${rest} other${rest > 1 ? "s" : ""}` : "";

  return (
    <button
      className="w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left"
      onClick={() => onClick(item.postId)}
    >
      {/* Actor avatar */}
      <div className="relative shrink-0">
        <UserAvatar user={likers[0] || item.actor} size="md" />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center border-2 border-background">
          <Heart className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
      
      {/* Text + post info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          <span className="font-semibold">
            {names}
            {suffix}
          </span>{" "}
          liked your post
        </p>
        {item.postCaption && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            "{item.postCaption}"
          </p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">
          {timeAgo(item.createdAt)}
        </p>
      </div>

      {/* Post thumbnail + icon */}
      <div className="relative shrink-0">
        {item.postImage && (
          <img
            src={item.postImage}
            alt=""
            className="w-12 h-12 rounded object-cover"
          />
        )}
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-500 flex items-center justify-center border-2 border-background">
          <Heart className="w-2.5 h-2.5 text-white" />
        </div>
      </div>
    </button>
  );
}

function CommentItem({ item, onClick }) {
  return (
    <button
      className="w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left"
      onClick={() => onClick(item.postId)}
    >
      {/* Actor avatar */}
      <div className="relative shrink-0">
        <UserAvatar user={item.actor} size="md" />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center border-2 border-background">
          <MessageCircle className="w-2.5 h-2.5 text-white" />
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          <span className="font-semibold">{item.actor?.displayName || item.actor?.username}</span>
          {" "}commented on your post
        </p>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">"{item.text}"</p>
        {item.postCaption && (
          <p className="text-xs text-muted-foreground/60 truncate mt-0.5">Post: "{item.postCaption}"</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(item.createdAt)}</p>
      </div>

      {/* Post thumbnail */}
      {item.postImage && (
        <img src={item.postImage} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
      )}
    </button>
  );
}

function TagItem({ item, onClick }) {
  return (
    <button
      className="w-full flex items-start gap-3 px-4 py-3 border-b border-border text-left"
      onClick={() => onClick(item.postId)}
    >
      {/* Actor avatar */}
      <div className="relative shrink-0">
        <UserAvatar user={item.actor} size="md" />
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center border-2 border-background">
          <Tag className="w-2.5 h-2.5 text-white" />
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground leading-snug">
          <span className="font-semibold">{item.actor?.displayName || item.actor?.username}</span>
          {" "}tagged you in a post
        </p>
        {item.postCaption && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">"{item.postCaption}"</p>
        )}
        <p className="text-[11px] text-muted-foreground mt-1">{timeAgo(item.createdAt)}</p>
      </div>

      {/* Post thumbnail */}
      {item.postImage && (
        <img src={item.postImage} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
      )}
    </button>
  );
}

export default function ActivityPage() {
  const navigate = useNavigate();
  const [activity, setActivity] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const headerRef = useRef(null);
  const feedRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      slideFromTop(headerRef.current);
    });
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (isLoading || !feedRef.current) return;
    const ctx = gsap.context(() => {
      const items = feedRef.current.querySelectorAll("button");
      if (items.length) staggerFadeUp(items, { stagger: 0.05 });
    });
    return () => ctx.revert();
  }, [isLoading]);

  useEffect(() => {
    getActivity()
      .then((res) => setActivity(res.data.activity || []))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const goToPost = (postId) => navigate(`/post/${postId}`);

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div ref={headerRef} className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground -ml-1"
          onClick={() => navigate(-1)}
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">Activity</h1>
      </div>

      <ScrollArea className="flex-1">
        <div ref={feedRef}>
        {isLoading ? (
          <ActivityFeedSkeleton />
        ) : activity.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2 text-center px-8">
            <Heart className="w-10 h-10 text-muted-foreground opacity-30" />
            <p className="text-sm text-muted-foreground">No activity yet</p>
          </div>
        ) : (
          activity.map((item, i) => {
            if (item.type === "like")    return <LikeItem    key={i} item={item} onClick={goToPost} />;
            if (item.type === "comment") return <CommentItem key={i} item={item} onClick={goToPost} />;
            if (item.type === "tag")     return <TagItem     key={i} item={item} onClick={goToPost} />;
            return null;
          })
        )}
        </div>
      </ScrollArea>
    </div>
  );
}
