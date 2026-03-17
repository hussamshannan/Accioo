import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import gsap from "gsap";
import { slideFromTop, fadeUp, staggerFadeUp } from "@/utils/animations";
import { useAuth } from "../contexts/AuthContext";
import {
  getUserProfile, sendFriendRequest, cancelFriendRequest, acceptFriendRequest,
  rejectFriendRequest, removeFriend, getFriends, getFriendRequests,
} from "../services/userService";
import { createConversation } from "../services/chatService";
import { formatTime } from "../utils/formatTime";
import { getUserPosts, getTaggedPosts } from "../services/profileService";
import UserAvatar from "@/components/ui/UserAvatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, Heart, MessageCircle, Image, Grid3X3, Users, Tag } from "lucide-react";
import ProfilePageSkeleton, { PostGridSkeleton } from "@/components/skeletons/ProfilePageSkeleton";

/* ─── UserProfilePage ─────────────────────────────────────────────────── */
export default function UserProfilePage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { dbUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [relationship, setRelationship] = useState(null);
  const [requestId, setRequestId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState(null);
  const [posts, setPosts] = useState([]);
  const [taggedPosts, setTaggedPosts] = useState(null);

  const isMe = dbUser?._id === userId;

  const headerRef = useRef(null);
  const heroRef = useRef(null);
  const actionsRef = useRef(null);
  const gridRef = useRef(null);

  useLayoutEffect(() => {
    if (isLoading) return;
    const ctx = gsap.context(() => {
      slideFromTop(headerRef.current);
      fadeUp(heroRef.current, { delay: 0.1 });
      fadeUp(actionsRef.current, { delay: 0.22 });
    });
    return () => ctx.revert();
  }, [isLoading]);

  useLayoutEffect(() => {
    if (!posts.length || !gridRef.current) return;
    const ctx = gsap.context(() => {
      const cells = gridRef.current.querySelectorAll("button");
      if (cells.length) staggerFadeUp(cells, { stagger: 0.03 });
    });
    return () => ctx.revert();
  }, [posts.length]);

  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [profileRes, requestsRes, friendsRes, postsRes] = await Promise.all([
          getUserProfile(userId),
          getFriendRequests().catch(() => ({ data: { received: [], sent: [] } })),
          getFriends().catch(() => ({ data: { friends: [] } })),
          getUserPosts(userId).catch(() => ({ data: { posts: [] } })),
        ]);
        setProfile(profileRes.data.user);
        setPosts(postsRes.data.posts || []);
        const friendsList = friendsRes.data.friends || [];
        const isFriend = friendsList.some((f) => f._id === userId);
        if (isFriend) {
          setRelationship("friend");
        } else {
          const { received, sent } = requestsRes.data;
          const inReceived = received.find((r) => r.from._id === userId);
          const inSent = sent.find((r) => r.to._id === userId);
          if (inReceived) { setRelationship("received"); setRequestId(inReceived._id); }
          else if (inSent) { setRelationship("sent"); setRequestId(inSent._id); }
          else setRelationship(null);
        }
      } catch { setError("Could not load profile."); } finally { setIsLoading(false); }
    };
    load();
  }, [userId, dbUser]);

  const withPending = async (fn) => {
    if (isPending) return;
    setIsPending(true);
    try { await fn(); } finally { setIsPending(false); }
  };

  const handleAdd = () => withPending(async () => {
    const res = await sendFriendRequest(userId);
    setRequestId(res.data.request._id);
    setRelationship("sent");
  });
  const handleCancel = () => withPending(async () => {
    await cancelFriendRequest(requestId);
    setRequestId(null);
    setRelationship(null);
  });
  const handleAccept = () => withPending(async () => {
    const res = await acceptFriendRequest(requestId);
    setRelationship("friend");
    setRequestId(null);
    if (res.data.conversationId) navigate(`/chat/${res.data.conversationId}`);
  });
  const handleReject = () => withPending(async () => {
    await rejectFriendRequest(requestId);
    setRelationship(null);
    setRequestId(null);
  });
  const handleRemove = () => withPending(async () => {
    await removeFriend(userId);
    setRelationship(null);
  });

  if (isLoading) {
    return <ProfilePageSkeleton />;
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col h-full bg-background overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-1 text-muted-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex items-center justify-center flex-1">
          <p className="text-muted-foreground text-sm">{error || "User not found."}</p>
        </div>
      </div>
    );
  }

  const displayName = profile.displayName || profile.username || "User";

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ── Header ── */}
      <div ref={headerRef} className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="-ml-1 text-muted-foreground">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="text-base font-bold text-foreground flex-1">@{profile.username}</span>
      </div>

      <ScrollArea className="flex-1">

        {/* ── Hero ── */}
        <div ref={heroRef} className="flex flex-col items-center px-5 pt-6 pb-4 gap-3">

          {/* Avatar */}
          <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-border bg-muted">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                {displayName[0]?.toUpperCase()}
              </div>
            )}
          </div>

          {/* Name + last seen */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-foreground leading-tight">{displayName}</h2>
            {profile.isOnline ? (
              <p className="text-xs text-primary mt-0.5">Online</p>
            ) : profile.lastSeen ? (
              <p className="text-xs text-muted-foreground mt-0.5">Last seen {formatTime(profile.lastSeen)}</p>
            ) : null}
          </div>

          {/* Bio */}
          {profile.bio && (
            <p className="text-sm text-muted-foreground text-center px-4 leading-snug whitespace-pre-line">
              {profile.bio}
            </p>
          )}

          {/* Stats row */}
          <div className="flex w-full max-w-xs mt-1">
            <div className="flex-1 flex flex-col items-center py-1">
              <span className="text-base font-bold text-foreground leading-tight">{posts.length}</span>
              <span className="text-xs text-muted-foreground">Posts</span>
            </div>
            <Separator orientation="vertical" className="h-10 self-center" />
            <div className="flex-1 flex flex-col items-center py-1">
              <span className="text-base font-bold text-foreground leading-tight">
                {profile.friends?.length || 0}
              </span>
              <span className="text-xs text-muted-foreground">Friends</span>
            </div>
          </div>

          {/* Action buttons */}
          {!isMe && (
            <div ref={actionsRef} className="flex gap-2 w-full max-w-xs">
              {relationship === "friend" ? (
                <>
                  <Button
                    className="flex-1 rounded-full"
                    onClick={async () => {
                      try {
                        const res = await createConversation({ type: "direct", participantIds: [userId] });
                        navigate(`/chat/${res.data.conversation._id}`);
                      } catch { /* silent */ }
                    }}
                  >
                    <MessageCircle className="w-4 h-4 mr-1.5" /> Message
                  </Button>
                  <Button variant="outline" className="rounded-full px-4" onClick={handleRemove} disabled={isPending}>
                    Remove
                  </Button>
                </>
              ) : relationship === "sent" ? (
                <Button variant="outline" className="flex-1 rounded-full" onClick={handleCancel} disabled={isPending}>
                  Requested
                </Button>
              ) : relationship === "received" ? (
                <>
                  <Button className="flex-1 rounded-full" onClick={handleAccept} disabled={isPending}>
                    Accept
                  </Button>
                  <Button variant="secondary" className="flex-1 rounded-full" onClick={handleReject} disabled={isPending}>
                    Decline
                  </Button>
                </>
              ) : (
                <Button className="flex-1 rounded-full" onClick={handleAdd} disabled={isPending}>
                  Add Friend
                </Button>
              )}
            </div>
          )}

          {isMe && (
            <Button variant="outline" className="w-full max-w-xs rounded-full font-semibold h-9" onClick={() => navigate("/profile")}>
              Edit Profile
            </Button>
          )}
        </div>

        {/* ── Tabs ── */}
        <Separator />
        <Tabs defaultValue="posts" onValueChange={(tab) => {
          if (tab === "tagged" && taggedPosts === null && userId)
            getTaggedPosts(userId).then((r) => setTaggedPosts(r.data.posts || [])).catch(() => setTaggedPosts([]));
        }}>
          <TabsList className="w-full bg-background border-b border-border rounded-none p-0 h-auto sticky top-0 z-10">
            <TabsTrigger
              value="posts"
              className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent text-[11px] font-semibold uppercase tracking-widest py-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Posts
            </TabsTrigger>
            <TabsTrigger
              value="tagged"
              className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent text-[11px] font-semibold uppercase tracking-widest py-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              <Tag className="w-3.5 h-3.5" />
              Tagged
            </TabsTrigger>
            <TabsTrigger
              value="friends"
              className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent text-[11px] font-semibold uppercase tracking-widest py-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              <Users className="w-3.5 h-3.5" />
              Friends
            </TabsTrigger>
          </TabsList>

          {/* POSTS grid */}
          <TabsContent value="posts" className="m-0">
            {posts.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center px-6">
                <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
                  <Image className="w-7 h-7 text-muted-foreground opacity-60" />
                </div>
                <p className="text-sm text-muted-foreground">No posts yet.</p>
              </div>
            ) : (
              <div ref={gridRef} className="grid grid-cols-3 md:grid-cols-4 gap-px">
                {posts.map((post) => (
                  <button
                    key={post._id}
                    className="aspect-square relative overflow-hidden bg-muted"
                    onClick={() => navigate(`/post/${post._id}`)}
                  >
                    <img src={post.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <span className="flex items-center gap-1 text-white text-xs font-semibold">
                        <Heart className="w-4 h-4 fill-white" />{post.likes?.length || 0}
                      </span>
                      <span className="flex items-center gap-1 text-white text-xs font-semibold">
                        <MessageCircle className="w-4 h-4 fill-white" />{post.comments?.length || 0}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* TAGGED tab */}
          <TabsContent value="tagged" className="m-0">
            {taggedPosts === null ? (
              <PostGridSkeleton count={6} />
            ) : taggedPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
                <Tag className="w-10 h-10 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">No tagged posts yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-px">
                {taggedPosts.map((post) => (
                  <button
                    key={post._id}
                    className="aspect-square relative overflow-hidden bg-muted"
                    onClick={() => navigate(`/post/${post._id}`)}
                  >
                    <img src={post.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* FRIENDS tab */}
          <TabsContent value="friends" className="m-0">
            {!profile.friends?.length ? (
              <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
                <Users className="w-10 h-10 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">No friends yet.</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {profile.friends.map((friend) => {
                  const name = friend.displayName || friend.username || "?";
                  return (
                    <button
                      key={friend._id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-border"
                      onClick={() => navigate(`/profile/${friend._id}`)}
                    >
                      <UserAvatar user={friend} size="md" />
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        <p className="text-xs text-muted-foreground truncate">@{friend.username}</p>
                      </div>
                      {friend.isOnline && (
                        <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>

      </ScrollArea>

    </div>
  );
}
