import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent } from "./dialog";
import { Button } from "./button";
import { ScrollArea } from "./scroll-area";
import UserAvatar from "./UserAvatar";
import {
  ArrowLeft, Heart, MessageCircle, Send, Bookmark,
  MoreHorizontal, X, Trash2, Check, ChevronRight,
} from "lucide-react";
import { updatePost } from "@/services/profileService";
import { sharePostToConversation, getConversations } from "@/services/chatService";
import { getFriends } from "@/services/userService";

/* ── Friend tag picker ────────────────────────────────────────────── */
function FriendTagPicker({ selected, onChange }) {
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getFriends().then((r) => setFriends(r.data.friends || [])).catch(() => {});
  }, []);

  const filtered = friends.filter((f) =>
    (f.displayName || f.username || "").toLowerCase().includes(search.toLowerCase())
  );

  const toggle = (friend) => {
    if (selected.find((s) => s._id === friend._id)) {
      onChange(selected.filter((s) => s._id !== friend._id));
    } else {
      onChange([...selected, friend]);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s._id}
              className="flex items-center gap-1 text-xs bg-muted text-foreground rounded-full px-2.5 py-1"
            >
              @{s.username || s.displayName}
              <button onClick={() => toggle(s)} className="text-muted-foreground">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search friends to tag…"
        className="text-sm bg-muted rounded-full px-3 py-1.5 outline-none text-foreground placeholder:text-muted-foreground"
      />

      {search && (
        <div className="flex flex-col max-h-28 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-xs text-muted-foreground px-1">No matches</p>
          )}
          {filtered.map((f) => {
            const isSelected = !!selected.find((s) => s._id === f._id);
            return (
              <button
                key={f._id}
                onClick={() => toggle(f)}
                className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left ${isSelected ? "bg-primary/10" : "hover:bg-muted"}`}
              >
                <UserAvatar user={f} size="xs" showOnline={false} />
                <span className="text-sm text-foreground flex-1 truncate">
                  {f.displayName || f.username}
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Share sheet ──────────────────────────────────────────────────── */
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
    } catch { /* silent */ } finally {
      setSharing(null);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 gap-0 max-w-[400px] h-[70vh] flex flex-col overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="flex items-center gap-2 px-2 pt-3 pb-2 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" onClick={onClose} className="text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="text-base font-semibold text-foreground flex-1">Share post</span>
        </div>

        {/* Optional message */}
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

        {/* Conversation list */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
          )}
          {!loading && conversations.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-sm text-muted-foreground">No conversations yet</p>
            </div>
          )}
          {conversations.map((conv) => {
            const name = getConvName(conv);
            const other = conv.participants?.find((p) => p._id !== currentUserId);
            const sent = sharedIds.has(conv._id);
            return (
              <div
                key={conv._id}
                className="flex items-center gap-3 px-4 py-3 border-b border-border"
              >
                <UserAvatar user={other || { displayName: name }} size="md" />
                <p className="text-sm font-medium text-foreground flex-1 truncate">{name}</p>
                <button
                  onClick={() => handleShare(conv)}
                  disabled={sent || sharing === conv._id}
                  className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${
                    sent
                      ? "bg-muted text-muted-foreground cursor-default"
                      : "bg-primary text-primary-foreground disabled:opacity-60"
                  }`}
                >
                  {sent ? "Sent" : sharing === conv._id ? "…" : "Send"}
                </button>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── PostDialog ───────────────────────────────────────────────────── */
export default function PostDialog({
  post: initialPost,
  currentUserId,
  onClose,
  onLike,
  onComment,
  onDeleteComment,
  onDelete,          // optional — owner only
  onUpdatePost,      // optional — called with (postId, updatedPost) after edit
}) {
  const [post, setPost] = useState(initialPost);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(initialPost.caption || "");
  const [tagsDraft, setTagsDraft] = useState(initialPost.taggedUsers || []);
  const [savingCaption, setSavingCaption] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const commentInputRef = useRef(null);

  // Sync when parent updates the post (likes, comments)
  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  const isLiked = post.likes?.some((id) => id === currentUserId || id?._id === currentUserId);
  const isOwner = (post.author?._id?.toString() ?? post.author?.toString()) === currentUserId;
  const authorName = post.author?.displayName || post.author?.username || "User";
  const authorUsername = post.author?.username || authorName;
  const likesCount = post.likes?.length || 0;

  const handleComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    await onComment(post._id, commentText.trim());
    setCommentText("");
    setSubmitting(false);
  };

  const handleSaveCaption = async () => {
    setSavingCaption(true);
    try {
      const res = await updatePost(post._id, {
        caption: captionDraft,
        taggedUsers: tagsDraft.map((t) => t._id),
      });
      const updated = res.data.post;
      setPost(updated);
      onUpdatePost?.(post._id, updated);
      setEditingCaption(false);
    } catch { /* silent */ } finally {
      setSavingCaption(false);
    }
  };

  const taggedUsers = post.taggedUsers || [];

  return (
    <>
      <Dialog open onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="p-0 gap-0 max-w-[400px] h-[100vh] flex flex-col overflow-hidden rounded-2xl">

          {/* ── Top bar ── */}
          <div className="flex items-center gap-2 px-2 pt-3 pb-2 shrink-0">
            <Button variant="ghost" size="icon" onClick={onClose} className="text-foreground">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="text-base font-semibold text-foreground flex-1">Post</span>
          </div>

          {/* ── Username row ── */}
          <div className="flex items-center gap-2.5 px-4 py-2 shrink-0 relative">
            <UserAvatar user={post.author || { displayName: authorName }} size="sm" showOnline={false} />
            <span className="text-sm font-semibold text-foreground flex-1">{authorUsername}</span>
            {isOwner && (
              <>
                <button className="text-foreground p-1" onClick={() => setShowMenu((v) => !v)}>
                  <MoreHorizontal className="w-5 h-5" />
                </button>
                {showMenu && (
                  <div
                    className="absolute right-4 top-12 z-50 bg-background border border-border rounded-xl overflow-hidden shadow-sm"
                    onMouseLeave={() => setShowMenu(false)}
                  >
                    <button
                      className="flex items-center gap-2 px-4 py-3 text-sm text-foreground w-full hover:bg-muted"
                      onClick={() => {
                        setCaptionDraft(post.caption || "");
                        setTagsDraft(post.taggedUsers || []);
                        setEditingCaption(true);
                        setShowMenu(false);
                      }}
                    >
                      <ChevronRight className="w-4 h-4" /> Edit caption
                    </button>
                    <button
                      className="flex items-center gap-2 px-4 py-3 text-sm text-destructive w-full hover:bg-muted"
                      onClick={() => { onDelete?.(post._id); onClose(); }}
                    >
                      <Trash2 className="w-4 h-4" /> Delete post
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Image ── */}
          <div className="w-full aspect-square bg-muted shrink-0 overflow-hidden">
            <img src={post.imageUrl} alt="post" className="w-full h-full object-cover" />
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">

            {/* Action bar */}
            <div className="flex items-center gap-4 px-4 pt-3 pb-2">
              <button onClick={() => onLike(post._id)} className="transition-transform active:scale-90">
                <Heart className={`w-6 h-6 transition-colors ${isLiked ? "fill-red-500 text-red-500" : "text-foreground"}`} />
              </button>
              <button onClick={() => commentInputRef.current?.focus()} className="text-foreground">
                <MessageCircle className="w-6 h-6" />
              </button>
              <button className="text-foreground" onClick={() => setShowShare(true)}>
                <Send className="w-5 h-5" />
              </button>
              <div className="flex-1" />
              <button onClick={() => setSaved((v) => !v)} className="transition-transform active:scale-90">
                <Bookmark className={`w-6 h-6 transition-colors ${saved ? "fill-foreground text-foreground" : "text-foreground"}`} />
              </button>
            </div>

            {/* Likes count */}
            {likesCount > 0 && (
              <p className="px-4 text-sm font-semibold text-foreground pb-1">
                {likesCount.toLocaleString()} {likesCount === 1 ? "like" : "likes"}
              </p>
            )}

            {/* Caption — edit mode or display */}
            {editingCaption ? (
              <div className="px-4 pb-2 flex flex-col gap-2">
                <textarea
                  rows={3}
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  maxLength={500}
                  className="w-full text-sm bg-muted rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground resize-none outline-none"
                  placeholder="Write a caption…"
                  autoFocus
                />
                <p className="text-[11px] text-muted-foreground font-medium">Tag friends</p>
                <FriendTagPicker selected={tagsDraft} onChange={setTagsDraft} />
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 rounded-full"
                    onClick={() => setEditingCaption(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 rounded-full"
                    onClick={handleSaveCaption}
                    disabled={savingCaption}
                  >
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
                {/* Tagged users */}
                {taggedUsers.length > 0 && (
                  <p className="px-4 text-sm text-muted-foreground pb-1">
                    with{" "}
                    {taggedUsers.map((u, i) => (
                      <span key={u._id}>
                        <span className="font-semibold text-foreground">
                          @{u.username || u.displayName}
                        </span>
                        {i < taggedUsers.length - 1 ? ", " : ""}
                      </span>
                    ))}
                  </p>
                )}
              </>
            )}

            {/* Comments */}
            {post.comments?.length > 0 && (
              <div className="px-4 pb-1">
                {post.comments.map((c) => {
                  const cName = c.user?.displayName || c.user?.username || "?";
                  const canDelete = c.user?._id === currentUserId || post.author?._id === currentUserId;
                  return (
                    <div key={c._id} className="flex items-start gap-2 py-0.5 group">
                      <p className="text-sm text-foreground flex-1">
                        <span className="font-semibold mr-1">{cName}</span>
                        {c.text}
                      </p>
                      {canDelete && (
                        <button
                          onClick={() => onDeleteComment(post._id, c._id)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground mt-1 shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Timestamp */}
            <p className="px-4 text-[10px] uppercase tracking-wide text-muted-foreground pb-3 pt-1">
              {post.createdAt
                ? new Date(post.createdAt).toLocaleDateString(undefined, { month: "long", day: "numeric" })
                : "Recently"}
            </p>
          </div>

          {/* ── Comment input — pinned at bottom ── */}
          <div className="flex items-center gap-3 px-4 py-3 border-t border-border shrink-0">
            <UserAvatar user={post.author || { displayName: authorName }} size="xs" showOnline={false} />
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
              <button
                onClick={handleComment}
                disabled={submitting}
                className="text-sm font-semibold text-primary disabled:opacity-50"
              >
                Post
              </button>
            )}
          </div>

        </DialogContent>
      </Dialog>

      {/* Share sheet */}
      {showShare && (
        <ShareSheet
          post={post}
          currentUserId={currentUserId}
          onClose={() => setShowShare(false)}
        />
      )}
    </>
  );
}
