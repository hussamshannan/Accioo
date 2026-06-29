import { useState, useEffect, useRef, useCallback, useLayoutEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import gsap from "gsap";
import { storyEntrance, slideFromTop, slideFromBottom } from "@/utils/animations";
import { useAuth } from "../contexts/AuthContext";
import { getStoryFeed, markStoryViewed, deleteStory } from "../services/storyService";
import { createConversation, sendMessageToConversation } from "../services/chatService";
import { X, Trash2, Send, Eye } from "lucide-react";
import { formatTime } from "../utils/formatTime";
import { toast } from "@/hooks/use-toast";

const STORY_DURATION = 5000;
const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "🔥"];

/* helper: stop all touch/mouse events from bubbling to the pause overlay */
const block = (e) => e.stopPropagation();
const blockProps = {
  onMouseDown: block, onMouseUp: block,
  onTouchStart: block, onTouchEnd: block,
};

export default function StoryViewerPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { dbUser } = useAuth();

  const [feed, setFeed] = useState([]);
  const [groupIndex, setGroupIndex] = useState(0);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [showReply, setShowReply] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [captionOverflows, setCaptionOverflows] = useState(false);

  const captionRef = useRef(null);

  const progressRef = useRef(null);
  const startTimeRef = useRef(null);
  const pausedAtRef = useRef(0);
  const replyInputRef = useRef(null);
  const viewerRef = useRef(null);
  const headerBarRef = useRef(null);
  const bottomBarRef = useRef(null);
  const viewersSheetRef = useRef(null);

  useLayoutEffect(() => {
    if (isLoading) return;
    const ctx = gsap.context(() => {
      storyEntrance(viewerRef.current);
      slideFromTop(headerBarRef.current, { delay: 0.12 });
      slideFromBottom(bottomBarRef.current, { delay: 0.12 });
    });
    return () => ctx.revert();
  }, [isLoading]);

  useLayoutEffect(() => {
    if (!showViewers || !viewersSheetRef.current) return;
    const ctx = gsap.context(() => {
      slideFromBottom(viewersSheetRef.current, { y: 80, duration: 0.3 });
    });
    return () => ctx.revert();
  }, [showViewers]);

  /* ── Load feed ── */
  useEffect(() => {
    const load = async () => {
      try {
        const res = await getStoryFeed();
        const feedData = res.data.feed || [];
        setFeed(feedData);
        if (userId) {
          const idx = feedData.findIndex((g) => g.author._id === userId);
          if (idx !== -1) setGroupIndex(idx);
        }
      } catch { /* silent */ } finally { setIsLoading(false); }
    };
    load();
  }, [userId]);

  const currentGroup = feed[groupIndex];
  const currentStory = currentGroup?.stories[storyIndex];

  /* ── Navigation ── */
  const goNext = useCallback(() => {
    if (!currentGroup) return;
    setTransitioning(true);
    setTimeout(() => {
      if (storyIndex < currentGroup.stories.length - 1) {
        setStoryIndex((i) => i + 1); setProgress(0);
      } else if (groupIndex < feed.length - 1) {
        setGroupIndex((i) => i + 1); setStoryIndex(0); setProgress(0);
      } else {
        navigate(-1);
      }
      setTransitioning(false);
    }, 120);
  }, [currentGroup, storyIndex, groupIndex, feed.length, navigate]);

  const goPrev = useCallback(() => {
    setTransitioning(true);
    setTimeout(() => {
      if (storyIndex > 0) { setStoryIndex((i) => i - 1); setProgress(0); }
      else if (groupIndex > 0) {
        const prevGroup = feed[groupIndex - 1];
        setGroupIndex((i) => i - 1);
        setStoryIndex(prevGroup.stories.length - 1);
        setProgress(0);
      }
      setTransitioning(false);
    }, 120);
  }, [storyIndex, groupIndex, feed]);

  /* ── Mark viewed ── */
  useEffect(() => {
    if (!currentStory) return;
    markStoryViewed(currentStory._id).catch(() => {});
  }, [currentStory?._id]);

  /* ── Progress timer ── */
  const paused = isPaused || showReply || showViewers || captionExpanded;
  useEffect(() => {
    if (!currentStory || paused) return;
    setProgress(0);
    startTimeRef.current = Date.now() - pausedAtRef.current;
    pausedAtRef.current = 0;
    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / STORY_DURATION) * 100, 100);
      setProgress(pct);
      if (pct < 100) { progressRef.current = requestAnimationFrame(tick); }
      else { goNext(); }
    };
    progressRef.current = requestAnimationFrame(tick);
    return () => { if (progressRef.current) cancelAnimationFrame(progressRef.current); };
  }, [currentStory?._id, paused, goNext]);

  const handlePauseToggle = (pausing) => {
    if (showReply || showViewers || captionExpanded) return;
    if (pausing) {
      pausedAtRef.current = Date.now() - startTimeRef.current;
      if (progressRef.current) cancelAnimationFrame(progressRef.current);
    }
    setIsPaused(pausing);
  };

  /* ── Caption expand/collapse (taps pause the story while open) ── */
  const toggleCaption = (e) => {
    e?.stopPropagation();
    setCaptionExpanded((open) => {
      if (!open) {
        // expanding → freeze progress where it is
        pausedAtRef.current = Date.now() - startTimeRef.current;
        if (progressRef.current) cancelAnimationFrame(progressRef.current);
      }
      return !open;
    });
  };

  // Reset + measure whether the caption exceeds two lines whenever the story changes.
  useLayoutEffect(() => {
    setCaptionExpanded(false);
    setCaptionOverflows(false);
    const id = requestAnimationFrame(() => {
      const el = captionRef.current;
      if (el) setCaptionOverflows(el.scrollHeight > el.clientHeight + 1);
    });
    return () => cancelAnimationFrame(id);
  }, [currentStory?._id, currentStory?.text]);

  /* ── Delete ── */
  const handleDelete = async () => {
    if (!currentStory) return;
    try {
      await deleteStory(currentStory._id);
      const updatedStories = currentGroup.stories.filter((s) => s._id !== currentStory._id);
      if (updatedStories.length === 0) {
        const newFeed = feed.filter((_, i) => i !== groupIndex);
        if (newFeed.length === 0) { navigate(-1); return; }
        setFeed(newFeed);
        setGroupIndex(Math.min(groupIndex, newFeed.length - 1));
        setStoryIndex(0);
      } else {
        setFeed(feed.map((g, i) => i === groupIndex ? { ...g, stories: updatedStories } : g));
        setStoryIndex(Math.min(storyIndex, updatedStories.length - 1));
      }
      setProgress(0);
    } catch { /* silent */ }
  };

  /* ── Reply ── */
  const openReply = () => {
    setShowReply(true);
    pausedAtRef.current = Date.now() - startTimeRef.current;
    if (progressRef.current) cancelAnimationFrame(progressRef.current);
    setTimeout(() => replyInputRef.current?.focus(), 100);
  };

  const closeReply = () => {
    setShowReply(false);
    setReplyText("");
  };

  // Snapshot of the story being replied to — denormalized so the chat quote
  // survives the 24h story expiry.
  const buildStoryReply = (story) => ({
    storyId: story._id,
    storyAuthor: story.author?._id,
    mediaUrl: story.mediaUrl || "",
    mediaType: story.type || "",
    storyText: story.text || "",
    backgroundColor: story.backgroundColor || "",
  });

  const sendReply = async (body) => {
    const story = currentStory;
    if (!body.trim() || !story?.author?._id) return;
    setIsSending(true);
    try {
      const convRes = await createConversation({
        type: "direct",
        participantIds: [story.author._id],
      });
      await sendMessageToConversation(
        convRes.data.conversation._id,
        body.trim(),
        buildStoryReply(story),
      );
      toast({ description: `Reply sent to ${story.author?.displayName || story.author?.username || "user"}` });
      return true;
    } catch {
      toast({ variant: "destructive", description: "Couldn't send reply. Try again." });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const handleSendReply = async () => {
    if (isSending) return;
    const ok = await sendReply(replyText);
    if (ok) closeReply();
  };

  const handleQuickReaction = (emoji) => {
    if (isSending) return;
    sendReply(emoji);
  };

  /* ── Loading / empty states ── */
  if (isLoading) {
    return (
      <div className="w-full h-full bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          <p className="text-white/50 text-sm">Loading stories…</p>
        </div>
      </div>
    );
  }

  if (!currentStory) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center gap-4">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center">
          <Eye className="w-7 h-7 text-white/40" />
        </div>
        <p className="text-white/60 text-sm">No stories to show.</p>
        <button onClick={() => navigate(-1)} className="text-white/80 text-sm border border-white/20 rounded-full px-5 py-2">
          Go back
        </button>
      </div>
    );
  }

  const isOwn = currentStory.author?._id === dbUser?._id;
  const authorName = currentStory.author?.displayName || currentStory.author?.username || "User";
  const totalInGroup = currentGroup?.stories?.length || 1;
  const viewers = currentStory.viewers || [];

  return (
    <div
      ref={viewerRef}
      className="relative w-full h-full bg-black select-none overflow-hidden"
      onMouseDown={() => handlePauseToggle(true)}
      onMouseUp={() => handlePauseToggle(false)}
      onTouchStart={() => handlePauseToggle(true)}
      onTouchEnd={() => handlePauseToggle(false)}
    >

      {/* ── Story content ── */}
      <div
        className="absolute inset-0 transition-opacity duration-150"
        style={{ opacity: transitioning ? 0 : 1, background: currentStory.backgroundColor || "#111" }}
      >
        {currentStory.type === "image" && (
          <img src={currentStory.mediaUrl} alt="" className="w-full h-full object-cover" draggable={false} />
        )}
        {currentStory.type === "video" && (
          <video key={currentStory._id} src={currentStory.mediaUrl}
            className="w-full h-full object-cover" autoPlay muted loop playsInline />
        )}
        {/* Text stories: big centered text. Media captions render in the bottom bar. */}
        {currentStory.type === "text" && currentStory.text && (
          <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
            <p className="text-white text-2xl font-bold text-center leading-snug"
              style={{ textShadow: "0 2px 12px rgba(0,0,0,0.5)" }}>
              {currentStory.text}
            </p>
          </div>
        )}
      </div>

      {/* ── Gradients ── */}
      <div className="absolute inset-x-0 top-0 h-36 pointer-events-none z-10"
        style={{ background: "linear-gradient(to bottom,rgba(0,0,0,0.65) 0%,transparent 100%)" }} />
      <div className="absolute inset-x-0 bottom-0 h-44 pointer-events-none z-10"
        style={{ background: "linear-gradient(to top,rgba(0,0,0,0.75) 0%,transparent 100%)" }} />

      {/* ── Tap zones: prev / next  (z-20 — BELOW header/bars at z-30) ── */}
      <button
        className="absolute left-0 top-0 bottom-28 w-1/3 z-20"
        {...blockProps}
        onClick={(e) => { e.stopPropagation(); goPrev(); }}
      />
      <button
        className="absolute right-0 top-0 bottom-28 w-1/3 z-20"
        {...blockProps}
        onClick={(e) => { e.stopPropagation(); goNext(); }}
      />

      {/* ── Progress bars (z-30) ── */}
      <div className="absolute top-0 inset-x-0 flex gap-1 px-3 pt-3 z-30 pointer-events-none">
        {currentGroup.stories.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
            <div
              className="h-full bg-white rounded-full"
              style={{ width: i < storyIndex ? "100%" : i === storyIndex ? `${progress}%` : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* ── Header (z-30) ── */}
      <div ref={headerBarRef} className="absolute top-7 inset-x-0 flex items-center justify-between px-3 z-30">
        {/* Left: avatar + name + counter */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-white/70 flex-shrink-0 flex items-center justify-center bg-black/30">
            {currentStory.author?.avatarUrl ? (
              <img src={currentStory.author.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-white text-sm font-semibold">{authorName[0]?.toUpperCase()}</span>
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-white text-sm font-semibold leading-tight drop-shadow">{authorName}</span>
            {currentStory.createdAt && (
              <span className="text-white/60 text-xs leading-tight">{formatTime(currentStory.createdAt)}</span>
            )}
          </div>
          {totalInGroup > 1 && (
            <span className="text-white/50 text-xs ml-1">{storyIndex + 1}/{totalInGroup}</span>
          )}
        </div>

        {/* Right: viewers + delete + close */}
        <div className="flex items-center gap-0.5">
          {/* Viewers button — own stories only */}
          {isOwn && viewers.length > 0 && (
            <button
              {...blockProps}
              onClick={(e) => { e.stopPropagation(); setShowViewers(true); }}
              className="flex items-center gap-1 px-2 py-1.5 rounded-full text-white/70 active:bg-white/10"
            >
              <Eye className="w-4 h-4" />
              <span className="text-xs font-medium">{viewers.length}</span>
            </button>
          )}

          {isOwn && (
            <button
              {...blockProps}
              onClick={(e) => { e.stopPropagation(); handleDelete(); }}
              className="w-9 h-9 flex items-center justify-center text-white/80 rounded-full active:bg-white/10"
            >
              <Trash2 className="w-[18px] h-[18px]" />
            </button>
          )}

          <button
            {...blockProps}
            onClick={(e) => { e.stopPropagation(); navigate(-1); }}
            className="w-9 h-9 flex items-center justify-center text-white/80 rounded-full active:bg-white/10"
          >
            <X className="w-[18px] h-[18px]" />
          </button>
        </div>
      </div>

      {/* ── Bottom bar (z-30) ── */}
      <div ref={bottomBarRef} className="absolute inset-x-0 bottom-0 z-30 flex flex-col">
        {/* Media caption — clamped to 2 lines; tap to expand (pauses) / collapse */}
        {currentStory.type !== "text" && currentStory.text && (
          <div className="px-4 pb-2" {...blockProps}>
            <p
              ref={captionRef}
              onClick={captionOverflows ? toggleCaption : undefined}
              className={`text-white text-sm leading-snug whitespace-pre-wrap ${
                captionOverflows ? "cursor-pointer" : ""
              } ${captionExpanded ? "max-h-[42vh] overflow-y-auto" : "line-clamp-2"}`}
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.65)" }}
            >
              {currentStory.text}
            </p>
            {captionOverflows && (
              <button
                onClick={toggleCaption}
                className="mt-0.5 text-white/55 text-xs font-medium active:text-white/80"
              >
                {captionExpanded ? "less" : "more"}
              </button>
            )}
          </div>
        )}

        {/* Group dots */}
        {feed.length > 1 && !showReply && (
          <div className="flex justify-center gap-1.5 mb-3">
            {feed.map((_, i) => (
              <div key={i} className={`rounded-full transition-all duration-300 ${
                i === groupIndex ? "w-5 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/30"
              }`} />
            ))}
          </div>
        )}

        {/* Reply (others' stories) */}
        {!isOwn && (
          <div className="flex flex-col gap-3 px-3 pb-8 pt-1" {...blockProps}>
            {/* Quick emoji reactions — one tap sends instantly */}
            <div className="flex items-center justify-center gap-3">
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={(e) => { e.stopPropagation(); handleQuickReaction(emoji); }}
                  disabled={isSending}
                  aria-label={`React ${emoji}`}
                  className="text-[26px] leading-none transition-transform active:scale-125 hover:scale-110 disabled:opacity-40"
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Text reply */}
            {showReply ? (
              <div className="flex items-center gap-2">
                <input
                  ref={replyInputRef}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") closeReply();
                    if (e.key === "Enter") handleSendReply();
                  }}
                  placeholder={`Reply to ${authorName}…`}
                  disabled={isSending}
                  className="flex-1 bg-white/10 border border-white/25 text-white placeholder:text-white/50 text-sm rounded-full px-4 py-2.5 outline-none backdrop-blur-sm disabled:opacity-60"
                />
                <button
                  onClick={closeReply}
                  aria-label="Close reply"
                  className="w-9 h-9 flex items-center justify-center text-white/60 rounded-full shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
                <button
                  disabled={!replyText.trim() || isSending}
                  onClick={handleSendReply}
                  aria-label="Send reply"
                  className="w-9 h-9 flex items-center justify-center rounded-full bg-white text-black shrink-0 disabled:opacity-40"
                >
                  {isSending ? (
                    <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </div>
            ) : (
              <button
                onClick={(e) => { e.stopPropagation(); openReply(); }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-full border border-white/25 text-white/75 text-sm active:bg-white/10"
              >
                <Send className="w-4 h-4" />
                Reply to {authorName}
              </button>
            )}
          </div>
        )}

        {isOwn && <div className="pb-8" />}
      </div>

      {/* ── Viewers sheet ── */}
      {showViewers && (
        <>
          {/* Backdrop */}
          <div
            className="absolute inset-0 z-40"
            {...blockProps}
            onClick={(e) => { e.stopPropagation(); setShowViewers(false); }}
          />

          {/* Sheet */}
          <div
            ref={viewersSheetRef}
            className="absolute inset-x-0 bottom-0 z-50 rounded-t-2xl overflow-hidden max-w-3xl mx-auto"
            style={{ background: "rgba(20,20,20,0.97)", backdropFilter: "blur(16px)" }}
            {...blockProps}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-9 h-1 rounded-full bg-white/20" />
            </div>

            {/* Title */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
              <div className="flex items-center gap-2 text-white">
                <Eye className="w-4 h-4 text-white/60" />
                <span className="text-sm font-semibold">
                  {viewers.length} {viewers.length === 1 ? "viewer" : "viewers"}
                </span>
              </div>
              <button
                onClick={() => setShowViewers(false)}
                className="w-7 h-7 flex items-center justify-center text-white/50 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Viewer list */}
            <div className="overflow-y-auto max-h-64 divide-y divide-white/5">
              {viewers.map((v, i) => {
                const u = v.user || {};
                const name = u.displayName || u.username || "User";
                return (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full overflow-hidden bg-white/10 flex-shrink-0 flex items-center justify-center">
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-white text-sm font-semibold">{name[0]?.toUpperCase()}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{name}</p>
                      {u.username && u.displayName && (
                        <p className="text-white/40 text-xs truncate">@{u.username}</p>
                      )}
                    </div>
                    {v.viewedAt && (
                      <span className="text-white/30 text-xs flex-shrink-0">{formatTime(v.viewedAt)}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Safe area */}
            <div className="pb-6" />
          </div>
        </>
      )}

    </div>
  );
}
