import { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { useSocket } from "../contexts/SocketContext";
import { slideFromTop, fadeUp, staggerFadeUp } from "@/utils/animations";
import {
  searchUsers,
  getFriends,
  getFriendRequests,
  sendFriendRequest,
  acceptFriendRequest,
  rejectFriendRequest,
  cancelFriendRequest,
  removeFriend,
} from "../services/userService";
import { createConversation } from "../services/chatService";
import UserAvatar from "@/components/ui/UserAvatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Search,
  Users,
  MessageCircle,
  UserMinus,
  Check,
  X,
  UserPlus,
  Clock,
} from "lucide-react";
import { ContactListSkeleton } from "@/components/skeletons/ContactsPageSkeleton";

export default function ContactsPage() {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [activeTab, setActiveTab] = useState("friends");
  const [friends, setFriends] = useState([]);
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState(new Set());

  const headerRef = useRef(null);
  const searchBarRef = useRef(null);
  const tabsRef = useRef(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      slideFromTop(headerRef.current);
      fadeUp(searchBarRef.current, { delay: 0.1 });
      fadeUp(tabsRef.current, { delay: 0.18 });
    });
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (isLoading) return;
    const ctx = gsap.context(() => {
      const rows = document.querySelectorAll(".contacts-row");
      if (rows.length) staggerFadeUp(rows, { stagger: 0.04 });
    });
    return () => ctx.revert();
  }, [isLoading, activeTab]);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [friendsRes, requestsRes] = await Promise.all([
        getFriends(),
        getFriendRequests(),
      ]);
      setFriends(friendsRes.data.friends);
      setReceived(requestsRes.data.received);
      setSent(requestsRes.data.sent);
    } catch {
      /* silent */
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const onRequestReceived = ({ request }) =>
      setReceived((prev) => [request, ...prev]);
    const onRequestAccepted = ({ friend, conversationId }) => {
      setFriends((prev) => [...prev, friend]);
      setSent((prev) => prev.filter((r) => r.to._id !== friend._id));
      if (conversationId) navigate(`/chat/${conversationId}`);
    };
    socket.on("friend-request-received", onRequestReceived);
    socket.on("friend-request-accepted", onRequestAccepted);
    return () => {
      socket.off("friend-request-received", onRequestReceived);
      socket.off("friend-request-accepted", onRequestAccepted);
    };
  }, [socket, navigate]);

  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchUsers(searchQuery);
        setSearchResults(res.data.users);
      } catch {
        /* silent */
      } finally {
        setIsSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const withPending = async (key, fn) => {
    if (pendingActions.has(key)) return;
    setPendingActions((prev) => new Set(prev).add(key));
    try {
      await fn();
    } finally {
      setPendingActions((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleSendRequest = (user) =>
    withPending(`send-${user._id}`, async () => {
      const res = await sendFriendRequest(user._id);
      const request = res.data.request;
      setSent((prev) => [...prev, request]);
      setSearchResults((prev) =>
        prev.map((u) =>
          u._id === user._id
            ? { ...u, pendingRequestId: request._id, requestDirection: "sent" }
            : u,
        ),
      );
    });

  const handleCancelRequest = (requestId, userId) =>
    withPending(`cancel-${requestId}`, async () => {
      await cancelFriendRequest(requestId);
      setSent((prev) => prev.filter((r) => r._id !== requestId));
      setSearchResults((prev) =>
        prev.map((u) =>
          u._id === userId
            ? { ...u, pendingRequestId: null, requestDirection: null }
            : u,
        ),
      );
    });

  const handleAccept = (requestId, fromUser) =>
    withPending(`accept-${requestId}`, async () => {
      const res = await acceptFriendRequest(requestId);
      setReceived((prev) => prev.filter((r) => r._id !== requestId));
      setFriends((prev) => [...prev, fromUser]);
      if (res.data.conversationId) navigate(`/chat/${res.data.conversationId}`);
    });

  const handleReject = (requestId) =>
    withPending(`reject-${requestId}`, async () => {
      await rejectFriendRequest(requestId);
      setReceived((prev) => prev.filter((r) => r._id !== requestId));
    });

  const handleRemoveFriend = (userId) =>
    withPending(`remove-${userId}`, async () => {
      await removeFriend(userId);
      setFriends((prev) => prev.filter((f) => f._id !== userId));
    });

  const handleMessage = async (friendId) => {
    try {
      const res = await createConversation({
        type: "direct",
        participantIds: [friendId],
      });
      navigate(`/chat/${res.data.conversation._id}`);
    } catch {
      /* silent */
    }
  };

  const pendingCount = received.length;

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Header */}

      <div ref={headerRef} className="flex items-center gap-3 px-4 py-3 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="text-muted-foreground shrink-0 -ml-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-base font-semibold text-foreground flex-1">
          Contacts
        </h1>
      </div>

      {/* Search bar */}
      <div ref={searchBarRef} className="px-4 pt-3 pb-2 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value.length >= 2) setActiveTab("search");
            }}
            onFocus={() => {
              if (searchQuery.length >= 2) setActiveTab("search");
            }}
            className="pl-9 rounded-full bg-muted border-none focus-visible:ring-1 focus-visible:ring-primary"
          />
        </div>
      </div>

      {/* Tabs — flex-1 so they fill remaining space */}
      <div ref={tabsRef} className="flex flex-col flex-1 overflow-hidden">
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex flex-col flex-1 overflow-hidden"
      >
        <TabsList className="mx-4 shrink-0 bg-transparent border-b border-border rounded-none p-0 h-auto justify-start">
          {[
            { key: "friends", label: "Friends" },
            { key: "requests", label: "Requests" },
            { key: "search", label: "Search" },
          ].map(({ key, label }) => (
            <TabsTrigger
              key={key}
              value={key}
              className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary pb-2 text-sm"
            >
              {label}
              {key === "requests" && pendingCount > 0 && (
                <Badge
                  variant="destructive"
                  className="h-4 min-w-4 px-1 text-[10px]"
                >
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* FRIENDS */}
        <TabsContent
          value="friends"
          className="flex-1 overflow-hidden m-0 mt-0"
        >
          {isLoading ? (
            <ScrollArea className="h-full"><ContactListSkeleton /></ScrollArea>
          ) : friends.length === 0 ? (
            <Empty
              icon={
                <Users className="w-10 h-10 text-muted-foreground opacity-40" />
              }
              text="No friends yet. Search for people to add."
            />
          ) : (
            <ScrollArea className="h-full">
              {friends.map((friend) => (
                <UserRow
                  key={friend._id}
                  user={friend}
                  onClick={() => navigate(`/profile/${friend._id}`)}
                  actions={
                    <>
                      <IconBtn
                        title="Message"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMessage(friend._id);
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </IconBtn>
                      <IconBtn
                        title="Remove friend"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveFriend(friend._id);
                        }}
                        disabled={pendingActions.has(`remove-${friend._id}`)}
                      >
                        <UserMinus className="w-4 h-4" />
                      </IconBtn>
                    </>
                  }
                />
              ))}
            </ScrollArea>
          )}
        </TabsContent>

        {/* REQUESTS */}
        <TabsContent
          value="requests"
          className="flex-1 overflow-hidden m-0 mt-0"
        >
          {isLoading ? (
            <ScrollArea className="h-full"><ContactListSkeleton count={4} /></ScrollArea>
          ) : received.length === 0 && sent.length === 0 ? (
            <Empty text="No pending friend requests." />
          ) : (
            <ScrollArea className="h-full">
              {received.length > 0 && (
                <>
                  <SectionLabel>Received ({received.length})</SectionLabel>
                  {received.map((req) => (
                    <UserRow
                      key={req._id}
                      user={req.from}
                      onClick={() => navigate(`/profile/${req.from._id}`)}
                      actions={
                        <>
                          <IconBtn
                            title="Accept"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAccept(req._id, req.from);
                            }}
                            disabled={pendingActions.has(`accept-${req._id}`)}
                          >
                            <Check className="w-4 h-4" />
                          </IconBtn>
                          <IconBtn
                            title="Reject"
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReject(req._id);
                            }}
                            disabled={pendingActions.has(`reject-${req._id}`)}
                          >
                            <X className="w-4 h-4" />
                          </IconBtn>
                        </>
                      }
                    />
                  ))}
                </>
              )}
              {sent.length > 0 && (
                <>
                  <SectionLabel>Sent ({sent.length})</SectionLabel>
                  {sent.map((req) => (
                    <UserRow
                      key={req._id}
                      user={req.to}
                      onClick={() => navigate(`/profile/${req.to._id}`)}
                      actions={
                        <IconBtn
                          title="Cancel request"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRequest(req._id, req.to._id);
                          }}
                          disabled={pendingActions.has(`cancel-${req._id}`)}
                        >
                          <Clock className="w-4 h-4" />
                        </IconBtn>
                      }
                    />
                  ))}
                </>
              )}
            </ScrollArea>
          )}
        </TabsContent>

        {/* SEARCH */}
        <TabsContent value="search" className="flex-1 overflow-hidden m-0 mt-0">
          {isSearching ? (
            <ScrollArea className="h-full"><ContactListSkeleton count={3} /></ScrollArea>
          ) : searchQuery.length < 2 ? (
            <Empty
              icon={
                <Search className="w-10 h-10 text-muted-foreground opacity-40" />
              }
              text="Type at least 2 characters to search."
            />
          ) : searchResults.length === 0 ? (
            <Empty text={`No users found for "${searchQuery}".`} />
          ) : (
            <ScrollArea className="h-full">
              {searchResults.map((user) => (
                <UserRow
                  key={user._id}
                  user={user}
                  onClick={() => navigate(`/profile/${user._id}`)}
                  actions={
                    user.isFriend ? (
                      <span className="text-xs text-muted-foreground px-2.5 py-1 bg-muted rounded-full">
                        Friends
                      </span>
                    ) : user.requestDirection === "sent" ? (
                      <IconBtn
                        title="Cancel request"
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCancelRequest(user.pendingRequestId, user._id);
                        }}
                        disabled={pendingActions.has(
                          `cancel-${user.pendingRequestId}`,
                        )}
                      >
                        <Clock className="w-4 h-4" />
                      </IconBtn>
                    ) : user.requestDirection === "received" ? (
                      <IconBtn
                        title="Accept request"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccept(user.pendingRequestId, user);
                        }}
                        disabled={pendingActions.has(
                          `accept-${user.pendingRequestId}`,
                        )}
                      >
                        <Check className="w-4 h-4" />
                      </IconBtn>
                    ) : (
                      <IconBtn
                        title="Add friend"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendRequest(user);
                        }}
                        disabled={pendingActions.has(`send-${user._id}`)}
                      >
                        <UserPlus className="w-4 h-4" />
                      </IconBtn>
                    )
                  }
                />
              ))}
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

/* ── small helpers ── */

function UserRow({ user, onClick, actions }) {
  const name = user.displayName || user.username || "?";
  return (
    <div
      className="contacts-row flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-border"
      onClick={onClick}
    >
      <UserAvatar user={user} size="md" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        {user.username && (
          <p className="text-xs text-muted-foreground">@{user.username}</p>
        )}
      </div>
      <div
        className="flex items-center gap-1.5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        {actions}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  variant = "secondary",
  onClick,
  disabled,
}) {
  return (
    <Button
      size="icon"
      variant={variant}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="w-8 h-8 shrink-0"
    >
      {children}
    </Button>
  );
}

function SectionLabel({ children }) {
  return (
    <p className="text-xs text-muted-foreground font-medium px-4 pt-3 pb-1">
      {children}
    </p>
  );
}

function Empty({ text, icon }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 gap-3 text-center px-4">
      {icon}
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
