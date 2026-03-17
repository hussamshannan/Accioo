import { useEffect, useState, useRef, useMemo, useLayoutEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import gsap from "gsap";
import { slideFromTop, fadeUp, staggerFadeUp } from "@/utils/animations";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { UserButton } from "@clerk/react";
import {
  getConversations,
  getConversation,
  createConversation,
  deleteConversation,
  updateConversationSettings,
  markConversationRead,
} from "../services/chatService";
import { getFriends } from "../services/userService";
import { useSocket } from "../contexts/SocketContext";
import { formatTime } from "../utils/formatTime";
import { getStoryFeed } from "../services/storyService";
import UserAvatar, { hasCustomAvatar } from "@/components/ui/UserAvatar";
import AnimatedList from "@/components/ui/AnimatedList";
import ShinyText from "@/components/ui/ShinyText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Heart,
  User,
  Plus,
  MessageCircle,
  MoreVertical,
  Trash2,
  BellOff,
  Bell,
  Pin,
  PinOff,
  Archive,
  Edit,
} from "lucide-react";
import { ConvListSkeleton } from "@/components/skeletons/HomePageSkeleton";

/* ─── New Chat Dialog ─────────────────────────────────────────────────── */
function NewChatDialog({ open, onClose, onSelect }) {
  const [friends, setFriends] = useState([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setLoading(true);
    getFriends()
      .then((r) => setFriends(r.data.friends || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return friends;
    const q = query.toLowerCase();
    return friends.filter(
      (f) =>
        (f.displayName || "").toLowerCase().includes(q) ||
        (f.username || "").toLowerCase().includes(q)
    );
  }, [friends, query]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-base font-semibold text-foreground">New Chat</DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="px-3 py-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Search friends…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 rounded-full bg-muted border-none focus-visible:ring-1 focus-visible:ring-primary"
            />
          </div>
        </div>

        {/* Friends list */}
        <ScrollArea className="max-h-[55vh]">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              {query ? `No friends matching "${query}"` : "You have no friends yet"}
            </p>
          ) : (
            filtered.map((friend) => (
              <button
                key={friend._id}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left"
                onClick={() => onSelect(friend)}
              >
                <UserAvatar user={friend} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {friend.displayName || friend.username}
                  </p>
                  {friend.username && (
                    <p className="text-xs text-muted-foreground">@{friend.username}</p>
                  )}
                </div>
                {friend.isOnline && (
                  <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                )}
              </button>
            ))
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ─── GSAP Conversation Menu ─────────────────────────────────────────── */
function ConvMenu({ conv, onDelete, onSetting, isArchived }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const menuRef = useRef(null);

  const openMenu = (e) => {
    e.stopPropagation();
    setOpen(true);
    requestAnimationFrame(() => {
      if (!menuRef.current) return;
      const items = menuRef.current.querySelectorAll(".dropdown-item");
      gsap.fromTo(
        menuRef.current,
        { opacity: 0, scale: 0.86, y: -10, transformOrigin: "top right" },
        { opacity: 1, scale: 1, y: 0, duration: 0.32, ease: "back.out(1.8)" }
      );
      gsap.fromTo(
        items,
        { opacity: 0, x: 14 },
        { opacity: 1, x: 0, stagger: 0.055, duration: 0.22, delay: 0.1, ease: "power2.out" }
      );
    });
  };

  const closeMenu = (cb) => {
    if (!menuRef.current) { setOpen(false); cb?.(); return; }
    gsap.to(menuRef.current, {
      opacity: 0, scale: 0.86, y: -10,
      duration: 0.2, ease: "back.in(1.8)",
      onComplete: () => { setOpen(false); cb?.(); },
    });
  };

  const pick = (action) => closeMenu(() => action());

  /* click-outside */
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!wrapRef.current?.contains(e.target)) closeMenu();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const ICON_SIZE = { width: 17, height: 17 };

  return (
    <div ref={wrapRef} className="relative" onClick={(e) => e.stopPropagation()}>
      {/* Trigger — 3-dot button */}
      <button
        className="w-7 h-7 flex items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted active:scale-90"
        style={{ transition: "transform 0.12s ease" }}
        onClick={openMenu}
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {/* Dropdown */}
      {open && (
        <div ref={menuRef} className="conv-dropdown">

          {/* ── Normal options ── */}
          {!isArchived && (
            <>
              {/* Pin / Unpin */}
              <button
                className="dropdown-item"
                onClick={() => pick(() => onSetting(conv._id, conv.isPinned ? "unpin" : "pin"))}
              >
                <div className="dropdown-icon" style={{ background: "#00A884" }}>
                  {conv.isPinned
                    ? <PinOff style={ICON_SIZE} color="#fff" strokeWidth={2} />
                    : <Pin   style={ICON_SIZE} color="#fff" strokeWidth={2} />}
                </div>
                <span className="dropdown-label">{conv.isPinned ? "Unpin" : "Pin"}</span>
              </button>

              {/* Mute / Unmute */}
              <button
                className="dropdown-item"
                onClick={() => pick(() => onSetting(conv._id, conv.isMuted ? "unmute" : "mute"))}
              >
                <div className="dropdown-icon" style={{ background: "#2196F3" }}>
                  {conv.isMuted
                    ? <Bell    style={ICON_SIZE} color="#fff" strokeWidth={2} />
                    : <BellOff style={ICON_SIZE} color="#fff" strokeWidth={2} />}
                </div>
                <span className="dropdown-label">{conv.isMuted ? "Unmute" : "Mute"}</span>
              </button>

              {/* Archive */}
              <button
                className="dropdown-item"
                onClick={() => pick(() => onSetting(conv._id, "archive"))}
              >
                <div className="dropdown-icon" style={{ background: "#FF9800" }}>
                  <Archive style={ICON_SIZE} color="#fff" strokeWidth={2} />
                </div>
                <span className="dropdown-label">Archive</span>
              </button>
            </>
          )}

          {/* ── Archived: unarchive only ── */}
          {isArchived && (
            <button
              className="dropdown-item"
              onClick={() => pick(() => onSetting(conv._id, "unarchive"))}
            >
              <div className="dropdown-icon" style={{ background: "#FF9800" }}>
                <Archive style={ICON_SIZE} color="#fff" strokeWidth={2} />
              </div>
              <span className="dropdown-label">Unarchive</span>
            </button>
          )}

          <div className="dropdown-divider" />

          {/* Delete */}
          <button
            className="dropdown-item"
            onClick={() => pick(() => onDelete(conv._id))}
          >
            <div className="dropdown-icon" style={{ background: "#ef4444" }}>
              <Trash2 style={ICON_SIZE} color="#fff" strokeWidth={2} />
            </div>
            <span className="dropdown-label" style={{ color: "#ef4444" }}>Delete chat</span>
          </button>

        </div>
      )}
    </div>
  );
}

function ConvRow({ conv, getConversationName, getOtherParticipant, onOpen, onDelete, onSetting, isArchived = false }) {
  const name = getConversationName(conv);
  const other = getOtherParticipant(conv);
  const unread = conv.unreadCount || 0;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border"
      onClick={() => onOpen(conv._id)}
    >
      {/* Avatar with pin indicator */}
      <div className="relative shrink-0">
        <UserAvatar user={other || { displayName: name }} size="md" />
        {conv.isPinned && (
          <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-background flex items-center justify-center">
            <Pin className="w-2.5 h-2.5 text-primary" />
          </div>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className={`text-sm truncate ${unread > 0 ? "font-semibold text-foreground" : "font-medium text-foreground"}`}>
            {name}
          </p>
          {conv.isMuted && <BellOff className="w-3 h-3 text-muted-foreground shrink-0" />}
        </div>
        <p className={`text-xs truncate ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
          {conv.lastMessage?.text || "No messages yet"}
        </p>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1 shrink-0">
        {conv.lastMessage?.timestamp && (
          <span className={`text-xs ${unread > 0 ? "text-primary font-medium" : "text-muted-foreground"}`}>
            {formatTime(conv.lastMessage.timestamp)}
          </span>
        )}
        <div className="flex items-center gap-1">
          {unread > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-black text-[10px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
          <ConvMenu
            conv={conv}
            onDelete={onDelete}
            onSetting={onSetting}
            isArchived={isArchived}
          />
        </div>
      </div>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { dbUser } = useAuth();
  const { isBright } = useTheme();
  const { socket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [archivedCount, setArchivedCount] = useState(0);
  const [archivedConvs, setArchivedConvs] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [storyFeed, setStoryFeed] = useState([]);
  // { convId, isInArchived } — set when user clicks "Delete chat"
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showNewChat, setShowNewChat] = useState(false);
  // Live indicator dots for nav icons
  const [activityPing, setActivityPing] = useState(false);
  const [contactPing, setContactPing] = useState(false);

  const headerRef = useRef(null);
  const storiesBarRef = useRef(null);
  const convListRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      slideFromTop(headerRef.current);
      fadeUp(storiesBarRef.current, { delay: 0.1 });
    });
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (isLoading || !convListRef.current) return;
    const ctx = gsap.context(() => {
      fadeUp(convListRef.current, { delay: 0.05 });
    });
    return () => ctx.revert();
  }, [isLoading]);

  useLayoutEffect(() => {
    if (isLoading || !storiesBarRef.current) return;
    const ctx = gsap.context(() => {
      const buttons = storiesBarRef.current.querySelectorAll("button");
      if (buttons.length) staggerFadeUp(buttons, { stagger: 0.04 });
    });
    return () => ctx.revert();
  }, [isLoading, storyFeed.length]);

  // Track which conversation is currently open so we don't increment unread for it
  const openChatId = useRef(null);
  useEffect(() => {
    const match = location.pathname.match(/^\/chat\/([^/]+)$/);
    openChatId.current = match ? match[1] : null;
  }, [location.pathname]);

  useEffect(() => {
    const load = async () => {
      try {
        const [convRes, storiesRes] = await Promise.all([
          getConversations(),
          getStoryFeed().catch(() => ({ data: { feed: [] } })),
        ]);

        setConversations(convRes.data.conversations);
        setArchivedCount(convRes.data.archivedCount || 0);
        setStoryFeed(storiesRes.data.feed || []);
      } catch {
        // DB unavailable — show empty state
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onRequestAccepted = () => {
      getConversations().then((res) => setConversations(res.data.conversations)).catch(() => {});
      setContactPing(true);
    };

    const onFriendRequestReceived = () => setContactPing(true);

    const onConversationUpdated = ({ conversationId, lastMessage, senderId }) => {
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c._id === conversationId);

        if (idx === -1) {
          // New conversation not in list — fetch it from server and add
          getConversation(conversationId)
            .then((res) => {
              const conv = res.data.conversation;
              if (!conv) return;
              const isOpen = openChatId.current === conversationId;
              setConversations((p) => {
                if (p.some((c) => c._id === conversationId)) return p;
                return [
                  { ...conv, lastMessage, updatedAt: lastMessage.timestamp, unreadCount: isOpen ? 0 : 1 },
                  ...p,
                ];
              });
            })
            .catch(() => {});
          return prev;
        }

        const conv = prev[idx];
        const isOpen = openChatId.current === conversationId;
        const shouldIncrement =
          !isOpen && senderId && senderId !== dbUser?._id;

        const updated = {
          ...conv,
          lastMessage,
          updatedAt: lastMessage.timestamp,
          unreadCount: shouldIncrement ? (conv.unreadCount || 0) + 1 : conv.unreadCount || 0,
        };

        const newList = [...prev];
        newList[idx] = updated;
        return newList.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          return new Date(b.updatedAt) - new Date(a.updatedAt);
        });
      });

      // Flash the activity indicator
      if (senderId && senderId !== dbUser?._id) {
        setActivityPing(true);
      }
    };

    const onFriendOnline = ({ userId }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants?.map((p) =>
            p._id === userId ? { ...p, isOnline: true } : p
          ),
        }))
      );
    };

    const onFriendOffline = ({ userId }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants?.map((p) =>
            p._id === userId ? { ...p, isOnline: false } : p
          ),
        }))
      );
    };

    const onNewStory = ({ author }) => {
      setStoryFeed((prev) => {
        const exists = prev.findIndex((g) => g.author._id === author._id);
        if (exists !== -1) return prev;
        return [{ author, stories: [] }, ...prev];
      });
    };

    const onStoryDeleted = ({ storyId, authorId }) => {
      setStoryFeed((prev) =>
        prev
          .map((g) => {
            if (g.author._id !== authorId) return g;
            const remaining = g.stories.filter((s) => s._id !== storyId);
            return remaining.length === 0 ? null : { ...g, stories: remaining };
          })
          .filter(Boolean)
      );
    };

    socket.on("friend-request-accepted", onRequestAccepted);
    socket.on("friend-request-received", onFriendRequestReceived);
    socket.on("conversation-updated", onConversationUpdated);
    socket.on("friend-online", onFriendOnline);
    socket.on("friend-offline", onFriendOffline);
    socket.on("new-story", onNewStory);
    socket.on("story-deleted", onStoryDeleted);

    return () => {
      socket.off("friend-request-accepted", onRequestAccepted);
      socket.off("friend-request-received", onFriendRequestReceived);
      socket.off("conversation-updated", onConversationUpdated);
      socket.off("friend-online", onFriendOnline);
      socket.off("friend-offline", onFriendOffline);
      socket.off("new-story", onNewStory);
      socket.off("story-deleted", onStoryDeleted);
    };
  }, [socket, dbUser?._id]);

  const handleNewChat = async (friend) => {
    setShowNewChat(false);
    try {
      const res = await createConversation({ type: "direct", participantIds: [friend._id] });
      const convId = res.data.conversation._id;
      // Add to local conversations list if not already there
      setConversations((prev) => {
        if (prev.find((c) => c._id === convId)) return prev;
        return [res.data.conversation, ...prev];
      });
      navigate(`/chat/${convId}`);
    } catch { /* ignore */ }
  };

  const handleOpenChat = (convId) => {
    // Reset unread count locally and on server
    setConversations((prev) =>
      prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
    );
    markConversationRead(convId).catch(() => {});
    navigate(`/chat/${convId}`);
  };

  // Opens the confirmation dialog instead of deleting immediately
  const handleDelete = (convId, isInArchived = false) => {
    setDeleteTarget({ convId, isInArchived });
  };

  const handleConfirmDelete = async (forEveryone) => {
    if (!deleteTarget) return;
    const { convId, isInArchived } = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteConversation(convId, forEveryone);
      if (isInArchived) {
        setArchivedConvs((prev) => prev.filter((c) => c._id !== convId));
        setArchivedCount((n) => Math.max(0, n - 1));
      } else {
        setConversations((prev) => prev.filter((c) => c._id !== convId));
      }
    } catch { /* ignore */ }
  };

  const handleToggleArchived = async () => {
    if (!showArchived && archivedConvs.length === 0) {
      try {
        const res = await getConversations(true);
        setArchivedConvs(res.data.conversations);
      } catch { /* ignore */ }
    }
    setShowArchived((v) => !v);
  };

  const handleSetting = async (convId, action, isInArchived = false) => {
    try {
      await updateConversationSettings(convId, action);
      const applyToList = (prev) =>
        prev.map((c) => {
          if (c._id !== convId) return c;
          if (action === "pin")      return { ...c, isPinned: true };
          if (action === "unpin")    return { ...c, isPinned: false };
          if (action === "mute")     return { ...c, isMuted: true };
          if (action === "unmute")   return { ...c, isMuted: false };
          if (action === "archive")  return { ...c, isArchived: true };
          if (action === "unarchive") return { ...c, isArchived: false };
          return c;
        });

      if (action === "archive") {
        const conv = conversations.find((c) => c._id === convId);
        setConversations((prev) => prev.filter((c) => c._id !== convId));
        setArchivedCount((n) => n + 1);
        if (conv) setArchivedConvs((prev) => [{ ...conv, isArchived: true }, ...prev]);
      } else if (action === "unarchive") {
        const conv = archivedConvs.find((c) => c._id === convId);
        setArchivedConvs((prev) => prev.filter((c) => c._id !== convId));
        setArchivedCount((n) => Math.max(0, n - 1));
        if (conv) {
          setConversations((prev) =>
            [...prev, { ...conv, isArchived: false }].sort((a, b) => {
              if (a.isPinned && !b.isPinned) return -1;
              if (!a.isPinned && b.isPinned) return 1;
              return new Date(b.updatedAt) - new Date(a.updatedAt);
            })
          );
        }
      } else if (isInArchived) {
        setArchivedConvs(applyToList);
      } else {
        setConversations((prev) =>
          applyToList(prev).sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
          })
        );
      }
    } catch { /* ignore */ }
  };

  const getConversationName = (conv) => {
    if (conv.groupName) return conv.groupName;
    if (conv.isAnonymous) return "Anonymous Chat";
    const other = conv.participants?.find((p) => p._id !== dbUser?._id);
    return other?.displayName || other?.username || "Unknown";
  };

  const getOtherParticipant = (conv) => {
    return conv.participants?.find((p) => p._id !== dbUser?._id);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}
      <div
        ref={headerRef}
        className="flex items-center justify-between px-4 py-3 bg-background border-b border-border shrink-0"
      >
        <h1 className="text-xl font-bold">
          <ShinyText>Accioo</ShinyText>
        </h1>
        <div className="flex items-center gap-1">
          {/* Search → contacts */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setContactPing(false);
              navigate("/contacts");
            }}
            className="relative text-muted-foreground"
            title="Search"
          >
            <Search className="w-5 h-5" />
            {contactPing && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
            )}
          </Button>

          {/* Heart → activity feed */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setActivityPing(false);
              navigate("/activity");
            }}
            className="relative text-muted-foreground"
            title="Activity"
          >
            <Heart className="w-5 h-5" />
            {activityPing && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </Button>

          {/* Profile → own profile */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/profile")}
            className="text-muted-foreground"
            title="Profile"
          >
            <User className="w-5 h-5" />
          </Button>

          {/* New chat */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNewChat(true)}
            className="text-muted-foreground"
            title="New chat"
          >
            <Edit className="w-5 h-5" />
          </Button>

          {/* Clerk — account management + sign out */}
          <div className="relative" style={{ width: 30, height: 30 }}>
            {!hasCustomAvatar(dbUser?.avatarUrl) && (
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center pointer-events-none z-10"
                style={{
                  background: "#00A884",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {(dbUser?.displayName ||
                  dbUser?.username ||
                  "?")[0].toUpperCase()}
              </div>
            )}
            <UserButton
              afterSignOutUrl="/auth"
              appearance={{
                variables: {
                  colorBackground: isBright ? "#ffffff" : "#1f1f1f",
                  colorText: isBright ? "#111827" : "#f5f5f5",
                  colorTextSecondary: isBright ? "#6b7280" : "#d1d5db",
                  colorInputBackground: isBright ? "#f5f5f5" : "#2a2a2a",
                  colorInputText: isBright ? "#111827" : "#f5f5f5",
                  colorPrimary: "#00A884",
                  colorDanger: "#f87171",
                  borderRadius: "0.625rem",
                  fontFamily: "inherit",
                },
                elements: {
                  userButtonAvatarBox: { width: 30, height: 30 },
                  ...(!hasCustomAvatar(dbUser?.avatarUrl) && {
                    userButtonAvatarImage: { opacity: 0 },
                  }),
                  userButtonPopoverCard: {
                    boxShadow: "0 4px 24px rgba(0,0,0,0.25)",
                    border: isBright ? "1px solid #e5e7eb" : "1px solid #333",
                  },
                  userButtonPopoverActionButton: {
                    color: isBright ? "#111827" : "#f5f5f5",
                  },
                  userButtonPopoverActionButtonText: {
                    color: isBright ? "#111827" : "#f5f5f5",
                  },
                  userButtonPopoverActionButtonIcon: {
                    color: isBright ? "#6b7280" : "#d1d5db",
                  },
                  userButtonPopoverFooter: { display: "none" },
                },
              }}
              userProfileProps={{
                appearance: {
                  // Always use explicit light-mode colors for the account management
                  // portal — prevents the app's dark-mode CSS variables from bleeding
                  // in and making labels invisible on the white background.
                  variables: {
                    colorBackground: "#ffffff",
                    colorText: "#111827",
                    colorTextSecondary: "#6b7280",
                    colorInputBackground: "#f9fafb",
                    colorInputText: "#111827",
                    colorPrimary: "#00A884",
                    colorDanger: "#ef4444",
                    borderRadius: "0.5rem",
                    fontFamily: "inherit",
                  },
                  elements: {
                    card: { boxShadow: "none" },
                    navbar: {
                      background: "#f9fafb",
                      borderRight: "1px solid #e5e7eb",
                    },
                    navbarButton: { color: "#374151" },
                    navbarButtonActive: {
                      color: "#111827",
                      background: "#e5e7eb",
                    },
                    pageScrollBox: { background: "#ffffff" },
                    profileSectionTitle: { color: "#111827" },
                    profileSectionTitleText: { color: "#111827" },
                    profileSectionContent: { color: "#374151" },
                    formFieldLabel: { color: "#6b7280" },
                    formFieldInput: {
                      background: "#f9fafb",
                      border: "1px solid #d1d5db",
                      color: "#111827",
                    },
                    headerTitle: { color: "#111827" },
                    headerSubtitle: { color: "#6b7280" },
                    dividerLine: { background: "#e5e7eb" },
                    dividerText: { color: "#9ca3af" },
                    accordionTriggerButton: { color: "#374151" },
                    badge: {
                      background: "#ecfdf5",
                      color: "#059669",
                      border: "1px solid #a7f3d0",
                    },
                    footerPagesLink: { color: "#9ca3af" },
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Stories Bar */}
      <div
        ref={storiesBarRef}
        className="shrink-0 px-4 pt-3 border-b border-border pb-3"
      >
        <ScrollArea className="w-full" scrollHideDelay={0}>
          <div className="flex gap-3 pr-2" style={{ minWidth: "max-content" }}>
            {/* Add story button */}
            <button
              onClick={() => navigate("/stories/create")}
              className="flex flex-col items-center gap-1 shrink-0"
            >
              <div className="relative">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                  {hasCustomAvatar(dbUser?.avatarUrl) ? (
                    <img
                      src={dbUser.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-xl font-semibold"
                      style={{ color: "#00A884" }}
                    >
                      {(dbUser?.displayName ||
                        dbUser?.username ||
                        "?")[0].toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-accent flex items-center justify-center border-2 border-background">
                  <Plus className="w-3 h-3 text-white" />
                </div>
              </div>
              <span className="text-xs text-muted-foreground truncate max-w-[56px]">
                Your story
              </span>
            </button>

            {/* Friend stories */}
            {storyFeed.map((group) => {
              const name =
                group.author.displayName || group.author.username || "?";
              return (
                <button
                  key={group.author._id}
                  onClick={() => navigate(`/stories/${group.author._id}`)}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400">
                    <div className="w-full h-full rounded-full overflow-hidden flex items-center justify-center border-2 border-background bg-muted">
                      {hasCustomAvatar(group.author.avatarUrl) ? (
                        <img
                          src={group.author.avatarUrl}
                          alt={name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span
                          className="text-lg font-semibold"
                          style={{ color: "#00A884" }}
                        >
                          {name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-[56px]">
                    {name}
                  </span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Conversations */}
      <div ref={convListRef} className="flex-1 overflow-hidden">
        {isLoading ? (
          <ConvListSkeleton />
        ) : conversations.length > 0 || archivedCount > 0 ? (
          <ScrollArea className="h-full">
            {/* Archived row — WhatsApp style */}
            {archivedCount > 0 && (
              <button
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-border text-left"
                onClick={handleToggleArchived}
              >
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Archive className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    Archived
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {archivedCount} conversation{archivedCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">
                  {showArchived ? "▲" : "▼"}
                </span>
              </button>
            )}

            {/* Archived conversations (expanded) */}
            {showArchived &&
              archivedConvs.map((conv) => (
                <ConvRow
                  key={conv._id}
                  conv={conv}
                  getConversationName={getConversationName}
                  getOtherParticipant={getOtherParticipant}
                  onOpen={handleOpenChat}
                  onDelete={(id) => handleDelete(id, true)}
                  onSetting={(id, action) => handleSetting(id, action, true)}
                  isArchived
                />
              ))}

            {showArchived && archivedConvs.length > 0 && (
              <div className="border-b border-border" />
            )}

            {/* Active conversations */}
            <AnimatedList>
              {conversations.map((conv) => (
                <ConvRow
                  key={conv._id}
                  conv={conv}
                  getConversationName={getConversationName}
                  getOtherParticipant={getOtherParticipant}
                  onOpen={handleOpenChat}
                  onDelete={handleDelete}
                  onSetting={handleSetting}
                />
              ))}
            </AnimatedList>
          </ScrollArea>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
            <MessageCircle
              className="w-12 h-12 text-muted-foreground"
              style={{ opacity: 0.4 }}
            />
            <div>
              <p className="text-foreground font-medium mb-1">
                No conversations yet
              </p>
              <p className="text-muted-foreground text-sm">
                Start a new chat to begin messaging
              </p>
            </div>
            <Button
              onClick={() => setShowNewChat(true)}
              variant="default"
              size="sm"
            >
              New Chat
            </Button>
          </div>
        )}
      </div>

      {/* New chat dialog */}
      <NewChatDialog
        open={showNewChat}
        onClose={() => setShowNewChat(false)}
        onSelect={handleNewChat}
      />

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete chat</DialogTitle>
            <DialogDescription>
              Do you want to delete this chat only for yourself, or for everyone
              in the conversation?
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => handleConfirmDelete(false)}
            >
              Delete for me
            </Button>
            <Button
              variant="destructive"
              className="w-full"
              onClick={() => handleConfirmDelete(true)}
            >
              Delete for everyone
            </Button>
            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
