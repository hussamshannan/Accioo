import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import gsap from "gsap";
import { slideFromTop, scaleIn, staggerFadeUp } from "@/utils/animations";
import { useAuth } from "../contexts/AuthContext";
import {
  getPost, toggleLike, addComment, deleteComment, updatePost, toggleSavePost,
} from "../services/profileService";
import { sharePostToConversation, getConversations } from "../services/chatService";
import UserAvatar from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, Heart, MessageCircle, Send, Bookmark,
  MoreHorizontal, Trash2, X, ChevronRight,
} from "lucide-react";
import PostViewerPageSkeleton from "@/components/skeletons/PostViewerPageSkeleton";

/* ── Share sheet ─────────────────────────────────────────────────── */
function ShareSheet({ post, currentUserId, onClose }) {
  const [conversations, setConversations] = useState([]);
  const [message, setMessage] = useState("");
  const [sharedIds, setSharedIds] = useState(new Set());
  const [sharing, setSharing] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getConversations()
      .then((r) => setConversations(r.data.conversations || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const getConvName = (conv) => {
    if (conv.groupName) return conv.groupName;
    if (conv.isAnonymous) return "Anonymous Chat";
    const other = conv.participants?.find((p) => p._id !== currentUserId);
    return other?.displayName || other?.username || "Chat";
  };

  const handleShare = async (conv) => {
    if (sharing || sharedIds.has(conv._id)) return;
    setSharing(conv._id);
    try {
      await sharePostToConversation(conv._id, post.imageUrl, message.trim(), post._id);
      setSharedIds((prev) => new Set([...prev, conv._id]));
    } catch { /* silent */ } finally { setSharing(null); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-background rounded-t-2xl max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-border shrink-0">
          <button onClick={onClose} className="text-muted-foreground">
            <X className="w-5 h-5" />
          </button>
          <span className="text-base font-semibold text-foreground flex-1">Share post</span>
        </div>
        <div className="px-4 py-2 border-b border-border shrink-0">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Add a message…"
            maxLength={200}
            className="w-full text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && <p className="text-center text-sm text-muted-foreground py-8">Loading…</p>}
          {!loading && conversations.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">No conversations yet</p>
          )}
          {conversations.map((conv) => {
            const name = getConvName(conv);
            const other = conv.participants?.find((p) => p._id !== currentUserId);
            const sent = sharedIds.has(conv._id);
            return (
              <div key={conv._id} className="flex items-center gap-3 px-4 py-3 border-b border-border">
                <UserAvatar user={other || { displayName: name }} size="md" />
                <p className="text-sm font-medium text-foreground flex-1 truncate">{name}</p>
                <button
                  onClick={() => handleShare(conv)}
                  disabled={sent || sharing === conv._id}
                  className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${
                    sent ? "bg-muted text-muted-foreground" : "bg-primary text-primary-foreground disabled:opacity-60"
                  }`}
                >
                  {sent ? "Sent" : sharing === conv._id ? "…" : "Send"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── PostViewerPage ───────────────────────────────────────────────── */
export default function PostViewerPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const { dbUser } = useAuth();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savingPost, setSavingPost] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState("");
  const [savingCaption, setSavingCaption] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const commentInputRef = useRef(null);
  const headerRef = useRef(null);
  const postCardRef = useRef(null);

  useLayoutEffect(() => {
    if (loading || !post) return;
    const ctx = gsap.context(() => {
      slideFromTop(headerRef.current);
      scaleIn(postCardRef.current, { delay: 0.08 });
      const comments = document.querySelectorAll(".comment-row");
      if (comments.length) staggerFadeUp(comments, { delay: 0.2, stagger: 0.04 });
    });
    return () => ctx.revert();
  }, [loading, post]);

  useEffect(() => {
    if (!postId) return;
    setLoading(true);
    getPost(postId)
      .then((r) => {
        setPost(r.data.post);
        setCaptionDraft(r.data.post.caption || "");
        setSaved(r.data.isSaved ?? false);
      })
      .catch(() => setError("Post not found."))
      .finally(() => setLoading(false));
  }, [postId]);

  if (loading) {
    return <PostViewerPageSkeleton />;
  }

  if (error || !post) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-base font-semibold text-foreground">Post</span>
        </div>
        <div className="flex items-center justify-center flex-1">
          <p className="text-sm text-muted-foreground">{error || "Post not found."}</p>
        </div>
      </div>
    );
  }

  const currentUserId = dbUser?._id;
  const isLiked = post.likes?.some((id) => id === currentUserId || id?._id === currentUserId);
  const isOwner = (post.author?._id?.toString() ?? post.author?.toString()) === currentUserId;
  const authorName = post.author?.displayName || post.author?.username || "User";
  const authorUsername = post.author?.username || authorName;
  const likesCount = post.likes?.length || 0;
  const taggedUsers = post.taggedUsers || [];

  const handleLike = async () => {
    try {
      const res = await toggleLike(post._id);
      setPost((p) => ({ ...p, likes: res.data.likes }));
    } catch { /* silent */ }
  };

  const handleComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await addComment(post._id, commentText.trim());
      setPost((p) => ({ ...p, comments: [...p.comments, res.data.comment] }));
      setCommentText("");
    } catch { /* silent */ } finally { setSubmitting(false); }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      await deleteComment(post._id, commentId);
      setPost((p) => ({ ...p, comments: p.comments.filter((c) => c._id !== commentId) }));
    } catch { /* silent */ }
  };

  const handleSaveCaption = async () => {
    setSavingCaption(true);
    try {
      const res = await updatePost(post._id, { caption: captionDraft });
      setPost(res.data.post);
      setEditingCaption(false);
    } catch { /* silent */ } finally { setSavingCaption(false); }
  };

  const handleDeletePost = async () => {
    try {
      const { deletePost: del } = await import("../services/profileService");
      await del(post._id);
      navigate(-1);
    } catch { /* silent */ }
  };

  /* ─── shared sub-sections ─── */
  const AuthorRow = () => (
    <div className="flex items-center gap-2.5 px-4 py-3 relative border-b border-border shrink-0">
      <button onClick={() => navigate(`/profile/${post.author?._id}`)}>
        <UserAvatar user={post.author || { displayName: authorName }} size="sm" showOnline={false} />
      </button>
      <button className="flex-1 text-left" onClick={() => navigate(`/profile/${post.author?._id}`)}>
        <p className="text-sm font-semibold text-foreground leading-tight">{authorUsername}</p>
        <p className="text-xs text-muted-foreground">
          {post.createdAt
            ? new Date(post.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
            : ""}
        </p>
      </button>
      {isOwner && (
        <>
          <button className="text-foreground p-1" onClick={() => setShowMenu((v) => !v)}>
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {showMenu && (
            <div
              className="absolute right-4 top-14 z-50 bg-background border border-border rounded-xl overflow-hidden"
              onMouseLeave={() => setShowMenu(false)}
            >
              <button
                className="flex items-center gap-2 px-4 py-3 text-sm text-foreground w-full"
                onClick={() => { setEditingCaption(true); setShowMenu(false); }}
              >
                <ChevronRight className="w-4 h-4" /> Edit caption
              </button>
              <button
                className="flex items-center gap-2 px-4 py-3 text-sm text-destructive w-full"
                onClick={handleDeletePost}
              >
                <Trash2 className="w-4 h-4" /> Delete post
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );

  const ActionBar = () => (
    <div className="flex items-center gap-4 px-4 pt-3 pb-2 shrink-0">
      <button onClick={handleLike} className="transition-transform active:scale-90">
        <Heart className={`w-6 h-6 ${isLiked ? "fill-red-500 text-red-500" : "text-foreground"}`} />
      </button>
      <button onClick={() => commentInputRef.current?.focus()} className="text-foreground">
        <MessageCircle className="w-6 h-6" />
      </button>
      <button className="text-foreground" onClick={() => setShowShare(true)}>
        <Send className="w-5 h-5" />
      </button>
      <div className="flex-1" />
      <button
        onClick={async () => {
          if (savingPost) return;
          setSavingPost(true);
          try {
            const res = await toggleSavePost(post._id);
            setSaved(res.data.saved);
          } catch { /* silent */ } finally { setSavingPost(false); }
        }}
        className="transition-transform active:scale-90"
      >
        <Bookmark className={`w-6 h-6 ${saved ? "fill-foreground text-foreground" : "text-foreground"}`} />
      </button>
    </div>
  );

  const MetaAndComments = () => (
    <>
      {likesCount > 0 && (
        <p className="px-4 text-sm font-semibold text-foreground pb-1">
          {likesCount.toLocaleString()} {likesCount === 1 ? "like" : "likes"}
        </p>
      )}

      {editingCaption ? (
        <div className="px-4 pb-3 flex flex-col gap-2">
          <textarea
            rows={3}
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            maxLength={500}
            className="w-full text-sm bg-muted rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none outline-none"
            placeholder="Write a caption…"
            autoFocus
          />
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1 rounded-full" onClick={() => setEditingCaption(false)}>
              Cancel
            </Button>
            <Button size="sm" className="flex-1 rounded-full" onClick={handleSaveCaption} disabled={savingCaption}>
              {savingCaption ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <>
          {post.caption && (
            <p className="px-4 text-sm text-foreground pb-1">
              <span className="font-semibold mr-1">{authorUsername}</span>
              {post.caption}
            </p>
          )}
          {taggedUsers.length > 0 && (
            <p className="px-4 text-sm text-muted-foreground pb-1">
              with{" "}
              {taggedUsers.map((u, i) => (
                <span key={u._id}>
                  <button className="font-semibold text-foreground" onClick={() => navigate(`/profile/${u._id}`)}>
                    @{u.username || u.displayName}
                  </button>
                  {i < taggedUsers.length - 1 ? ", " : ""}
                </span>
              ))}
            </p>
          )}
        </>
      )}

      {/* Comments */}
      <div className="px-4 pb-2">
        {post.comments?.length === 0 && (
          <p className="py-3 text-sm text-muted-foreground">No comments yet.</p>
        )}
        {post.comments?.map((c) => {
          const cName = c.user?.displayName || c.user?.username || "?";
          const cUserId = c.user?._id;
          const canDelete = cUserId === currentUserId || post.author?._id === currentUserId;
          return (
            <div key={c._id} className="comment-row flex items-start gap-2 py-1.5 group">
              <button onClick={() => navigate(`/profile/${cUserId}`)}>
                <UserAvatar user={c.user || { displayName: cName }} size="xs" showOnline={false} />
              </button>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">
                  <button className="font-semibold mr-1" onClick={() => navigate(`/profile/${cUserId}`)}>
                    {cName}
                  </button>
                  {c.text}
                </p>
              </div>
              {canDelete && (
                <button
                  onClick={() => handleDeleteComment(c._id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground mt-0.5 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </>
  );

  const CommentInput = () => (
    <div className="flex items-center gap-3 px-4 py-3 border-t border-border bg-background shrink-0">
      <UserAvatar user={dbUser || {}} size="xs" showOnline={false} />
      <input
        ref={commentInputRef}
        type="text"
        placeholder="Add a comment…"
        value={commentText}
        onChange={(e) => setCommentText(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleComment()}
        maxLength={300}
        className="flex-1 text-sm bg-transparent outline-none text-foreground placeholder:text-muted-foreground"
      />
      {commentText.trim() && (
        <button onClick={handleComment} disabled={submitting} className="text-sm font-semibold text-primary disabled:opacity-50">
          Post
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* Header */}
      <div ref={headerRef} className="flex items-center gap-2 px-2 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="text-base font-semibold text-foreground flex-1">Post</span>
      </div>

      {/* ── MOBILE layout (single column) ── */}
      <div ref={postCardRef} className="flex flex-col flex-1 overflow-hidden md:hidden">
        <div className="flex-1 overflow-y-auto">
          <AuthorRow />
          {/* Image */}
          <div className="w-full bg-black flex items-center justify-center">
            <img src={post.imageUrl} alt="post" className="w-full max-h-[60vh] object-contain" />
          </div>
          <ActionBar />
          <MetaAndComments />
          <div className="h-4" />
        </div>
        <CommentInput />
      </div>

      {/* ── DESKTOP layout (two columns, Instagram-style) ── */}
      <div className="hidden md:flex flex-1 overflow-hidden max-w-10xl mx-auto w-full">

        {/* Left: image */}
        <div className="flex-1 bg-black flex items-center justify-center overflow-hidden border-r border-border min-w-0">
          <img
            src={post.imageUrl}
            alt="post"
            className="max-w-full max-h-full object-contain"
            style={{ maxHeight: "calc(100vh - 56px)" }}
          />
        </div>

        {/* Right: author + actions + comments */}
        <div className="w-[340px] flex-shrink-0 flex flex-col overflow-hidden">
          <AuthorRow />
          <div className="flex-1 overflow-y-auto">
            <MetaAndComments />
            <div className="h-4" />
          </div>
          <ActionBar />
          <CommentInput />
        </div>
      </div>

      {showShare && (
        <ShareSheet post={post} currentUserId={currentUserId} onClose={() => setShowShare(false)} />
      )}
    </div>
  );
}
