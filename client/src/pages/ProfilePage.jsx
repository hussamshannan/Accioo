import { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap";
import { slideFromTop, fadeUp, staggerFadeUp } from "@/utils/animations";
import { useAuth } from "../contexts/AuthContext";
import { updateProfile, getFriends } from "../services/userService";
import {
  getUserPosts,
  createPost,
  updateAvatar,
  getSavedPosts,
  getTaggedPosts,
} from "../services/profileService";
import { getStoryFeed } from "../services/storyService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import UserAvatar from "@/components/ui/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Plus,
  Heart,
  MessageCircle,
  X,
  Image,
  Grid3X3,
  Bookmark,
  Tag,
  Camera,
  Pencil,
  MoreVertical,
  Palette,
} from "lucide-react";
import { PostGridSkeleton } from "@/components/skeletons/ProfilePageSkeleton";

/* ─── Upload Dialog ────────────────────────────────────────────────────── */
/* ── Tag picker inside UploadDialog ── */
function TagPicker({ selected, onChange }) {
  const [friends, setFriends] = useState([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getFriends()
      .then((r) => setFriends(r.data.friends || []))
      .catch(() => {});
  }, []);

  const filtered = friends.filter((f) =>
    (f.displayName || f.username || "")
      .toLowerCase()
      .includes(search.toLowerCase()),
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
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between text-sm text-foreground py-1"
      >
        <span className="font-medium">
          Tag people {selected.length > 0 && `(${selected.length})`}
        </span>
        <Plus
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-45" : ""}`}
        />
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          {selected.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {selected.map((s) => (
                <span
                  key={s._id}
                  className="flex items-center gap-1 text-xs bg-muted text-foreground rounded-full px-2.5 py-1"
                >
                  @{s.username || s.displayName}
                  <button
                    type="button"
                    onClick={() => toggle(s)}
                    className="text-muted-foreground"
                  >
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
            placeholder="Search friends…"
            className="text-sm bg-muted rounded-full px-3 py-1.5 outline-none text-foreground placeholder:text-muted-foreground"
          />
          {search && (
            <div className="flex flex-col max-h-32 overflow-y-auto">
              {filtered.map((f) => {
                const isSelected = !!selected.find((s) => s._id === f._id);
                return (
                  <button
                    key={f._id}
                    type="button"
                    onClick={() => toggle(f)}
                    className={`flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-left ${isSelected ? "bg-primary/10" : "hover:bg-muted"}`}
                  >
                    <UserAvatar user={f} size="xs" showOnline={false} />
                    <span className="text-sm text-foreground flex-1 truncate">
                      {f.displayName || f.username}
                    </span>
                    {isSelected && (
                      <span className="text-primary text-xs">✓</span>
                    )}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground px-1">No matches</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function UploadDialog({ onClose, onSubmit }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const handleFile = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file || uploading) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("image", file);
    fd.append("caption", caption);
    fd.append("tags", JSON.stringify(tags.map((t) => t._id)));
    await onSubmit(fd);
    setUploading(false);
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="p-0 gap-0 max-w-sm overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button onClick={onClose} className="text-sm text-muted-foreground">
            Cancel
          </button>
          <h3 className="text-sm font-semibold text-foreground">New Post</h3>
          <button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="text-sm font-semibold text-primary disabled:opacity-40"
          >
            {uploading ? "Sharing…" : "Share"}
          </button>
        </div>

        {/* Image picker */}
        <div
          className="mx-0 aspect-square bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
          onClick={() => fileRef.current?.click()}
        >
          {preview ? (
            <img
              src={preview}
              alt="preview"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <Image className="w-12 h-12 opacity-40" />
              <span className="text-sm">Tap to select photo</span>
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            className="hidden"
          />
        </div>

        {/* Caption + Tags */}
        <div className="px-4 py-3 flex flex-col gap-3">
          <textarea
            rows={3}
            placeholder="Write a caption…"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={500}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none"
          />
          <div className="border-t border-border pt-3">
            <TagPicker selected={tags} onChange={setTags} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Edit Profile Dialog ─────────────────────────────────────────────── */
function EditProfileDialog({ open, onClose, dbUser, onSaved }) {
  const [form, setForm] = useState({ displayName: "", bio: "" });
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileRef = useRef();

  useEffect(() => {
    if (open && dbUser) {
      setForm({
        displayName: dbUser.displayName || "",
        bio: dbUser.bio || "",
      });
      setAvatarPreview(null);
      setAvatarFile(null);
      setSaveError("");
    }
  }, [open, dbUser]);

  const handleAvatarPick = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveError("");
    try {
      let updatedUser;

      // Upload avatar first if changed
      if (avatarFile) {
        const fd = new FormData();
        fd.append("avatar", avatarFile);
        const avatarRes = await updateAvatar(fd);
        updatedUser = avatarRes.data.user;
      }

      // Update text profile
      const profileRes = await updateProfile({
        displayName: form.displayName,
        bio: form.bio,
      });
      updatedUser = { ...(updatedUser || {}), ...profileRes.data.user };

      onSaved(updatedUser);
      onClose();
    } catch (err) {
      setSaveError(
        err?.response?.data?.error || "Failed to save. Please try again.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = dbUser?.displayName || dbUser?.username || "User";
  const currentAvatar = avatarPreview || dbUser?.avatarUrl;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="text-base font-semibold text-foreground">
            Edit Profile
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[80vh]">
          <div className="flex flex-col gap-5 px-4 py-5">
            {/* Avatar picker */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                className="relative group"
                onClick={() => fileRef.current?.click()}
              >
                <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-border bg-muted">
                  {currentAvatar ? (
                    <img
                      src={currentAvatar}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                      {displayName[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center">
                  <Camera className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarPick}
                  className="hidden"
                />
              </button>
              <button
                type="button"
                className="text-xs text-primary font-medium"
                onClick={() => fileRef.current?.click()}
              >
                Change Photo
              </button>
            </div>

            {/* Fields */}
            <div className="flex flex-col gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Display Name
                </Label>
                <Input
                  value={form.displayName}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, displayName: e.target.value }))
                  }
                  placeholder="Your name"
                  className="bg-muted border-none rounded-lg"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  Bio
                </Label>
                <textarea
                  rows={4}
                  value={form.bio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, bio: e.target.value }))
                  }
                  placeholder="Tell people about yourself…"
                  maxLength={300}
                  className="w-full rounded-lg bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground resize-none outline-none focus:ring-1 focus:ring-ring"
                />
                <p className="text-right text-[10px] text-muted-foreground mt-1">
                  {form.bio.length}/300
                </p>
              </div>
            </div>

            {/* Error */}
            {saveError && (
              <p className="text-xs text-destructive text-center">
                {saveError}
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pb-1">
              <Button
                variant="secondary"
                onClick={onClose}
                className="flex-1 rounded-full"
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 rounded-full"
              >
                {isSaving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ─── ProfilePage ─────────────────────────────────────────────────────── */
export default function ProfilePage() {
  const navigate = useNavigate();
  const { dbUser, setDbUser } = useAuth();

  const headerRef = useRef(null);
  const heroRef = useRef(null);
  const statsRef = useRef(null);
  const gridRef = useRef(null);

  const [posts, setPosts] = useState([]);
  const [savedPosts, setSavedPosts] = useState(null);
  const [taggedPosts, setTaggedPosts] = useState(null);
  const [myStories, setMyStories] = useState([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      slideFromTop(headerRef.current);
      fadeUp(heroRef.current, { delay: 0.1 });
      fadeUp(statsRef.current, { delay: 0.18 });
    });
    return () => ctx.revert();
  }, []);

  useLayoutEffect(() => {
    if (!posts.length || !gridRef.current) return;
    const ctx = gsap.context(() => {
      const cells = gridRef.current.querySelectorAll("button");
      if (cells.length) staggerFadeUp(cells, { stagger: 0.03 });
    });
    return () => ctx.revert();
  }, [posts.length]);

  /* ── load posts + own stories ── */
  useEffect(() => {
    if (!dbUser?._id) return;
    getUserPosts(dbUser._id)
      .then((r) => setPosts(r.data.posts))
      .catch(() => {});
    getStoryFeed()
      .then((r) => {
        const mine = r.data.feed?.find((g) => g.author._id === dbUser._id);
        setMyStories(mine?.stories || []);
      })
      .catch(() => {});
  }, [dbUser?._id]);

  const handleUploadPost = async (formData) => {
    try {
      const res = await createPost(formData);
      setPosts((prev) => [res.data.post, ...prev]);
      setShowUpload(false);
    } catch {
      /* silent */
    }
  };

  if (!dbUser) return null;
  const displayName = dbUser.displayName || dbUser.username || "User";

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* ── Header ── */}
      <div ref={headerRef} className="flex items-center gap-2 px-3 py-3 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="-ml-1 text-muted-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <span className="text-base font-bold text-foreground flex-1">
          @{dbUser.username}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label="Menu">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-44 bg-popover text-popover-foreground border-border"
          >
            <DropdownMenuItem onClick={() => setShowEdit(true)}>
              <Pencil className="w-4 h-4" />
              Edit Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowUpload(true)}>
              <Plus className="w-4 h-4" />
              New Post
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/settings/appearance")}>
              <Palette className="w-4 h-4" />
              Theme
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="flex-1">
        {/* ── Hero ── */}
        <div ref={heroRef} className="flex flex-col items-center px-5 pt-6 pb-4 gap-3">
          {/* Avatar — tap to open edit dialog */}
          <button className="relative group" onClick={() => setShowEdit(true)}>
            {myStories.length > 0 ? (
              <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400">
                <div className="w-full h-full rounded-full overflow-hidden border-2 border-background bg-muted">
                  {dbUser.avatarUrl ? (
                    <img
                      src={dbUser.avatarUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                      {displayName[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-24 h-24 rounded-full overflow-hidden ring-2 ring-border bg-muted">
                {dbUser.avatarUrl ? (
                  <img
                    src={dbUser.avatarUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl font-bold text-muted-foreground">
                    {displayName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
            )}
            <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-primary border-2 border-background flex items-center justify-center">
              <Camera className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
          </button>

          {/* Name */}
          <h2 className="text-xl font-bold text-foreground text-center leading-tight">
            {displayName}
          </h2>

          {/* Bio */}
          {dbUser.bio && (
            <p className="text-sm text-muted-foreground text-center px-4 leading-snug whitespace-pre-line">
              {dbUser.bio}
            </p>
          )}

          {/* Stats row */}
          <div ref={statsRef} className="flex w-full max-w-xs mt-1">
            <div className="flex-1 flex flex-col items-center py-1">
              <span className="text-base font-bold text-foreground leading-tight">
                {posts.length}
              </span>
              <span className="text-xs text-muted-foreground">Posts</span>
            </div>
            <Separator orientation="vertical" className="h-10 self-center" />
            <div className="flex-1 flex flex-col items-center py-1">
              <span className="text-base font-bold text-foreground leading-tight">
                {dbUser.friends?.length || 0}
              </span>
              <span className="text-xs text-muted-foreground">Friends</span>
            </div>
            <Separator orientation="vertical" className="h-10 self-center" />
            <div className="flex-1 flex flex-col items-center py-1">
              <span className="text-base font-bold text-foreground leading-tight">
                {(dbUser.friends?.length || 0) > 0
                  ? Math.floor((dbUser.friends.length * 3) / 4)
                  : 0}
              </span>
              <span className="text-xs text-muted-foreground">Mutual</span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full max-w-xs rounded-full font-semibold h-9"
            onClick={() => setShowEdit(true)}
          >
            Edit Profile
          </Button>
        </div>

        {/* ── Story Highlights ── */}
        {myStories.length > 0 && (
          <>
            <Separator />
            <div className="px-4 py-3">
              <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-none">
                {myStories.map((story, i) => (
                  <button
                    key={story._id}
                    onClick={() => navigate(`/stories/${dbUser._id}`)}
                    className="flex flex-col items-center gap-1.5 shrink-0"
                  >
                    <div className="w-[62px] h-[62px] rounded-full p-[2px] bg-gradient-to-tr from-purple-500 via-pink-500 to-orange-400">
                      <div className="w-full h-full rounded-full overflow-hidden border-2 border-background bg-muted">
                        {story.imageUrl ? (
                          <img
                            src={story.imageUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center text-lg"
                            style={{
                              background: story.bgColor || "var(--muted)",
                            }}
                          >
                            {story.textContent?.slice(0, 1) || "✨"}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground max-w-[62px] truncate">
                      Highlight {i + 1}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Tabs + Grid ── */}
        <Separator />
        <Tabs
          defaultValue="posts"
          onValueChange={(tab) => {
            if (tab === "saved" && savedPosts === null && dbUser?._id)
              getSavedPosts()
                .then((r) => setSavedPosts(r.data.posts || []))
                .catch(() => setSavedPosts([]));
            if (tab === "tagged" && taggedPosts === null && dbUser?._id)
              getTaggedPosts(dbUser._id)
                .then((r) => setTaggedPosts(r.data.posts || []))
                .catch(() => setTaggedPosts([]));
          }}
        >
          <TabsList className="w-full bg-background border-b border-border rounded-none p-0 h-auto sticky top-0 z-10">
            <TabsTrigger
              value="posts"
              className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent text-[11px] font-semibold uppercase tracking-widest py-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              <Grid3X3 className="w-3.5 h-3.5" />
              Posts
            </TabsTrigger>
            <TabsTrigger
              value="saved"
              className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent text-[11px] font-semibold uppercase tracking-widest py-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              <Bookmark className="w-3.5 h-3.5" />
              Saved
            </TabsTrigger>
            <TabsTrigger
              value="tagged"
              className="flex-1 gap-1.5 rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent text-[11px] font-semibold uppercase tracking-widest py-3 text-muted-foreground data-[state=active]:text-foreground"
            >
              <Tag className="w-3.5 h-3.5" />
              Tagged
            </TabsTrigger>
          </TabsList>

          {/* POSTS grid */}
          <TabsContent value="posts" className="m-0">
            {posts.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center px-6">
                <div className="w-16 h-16 rounded-full border-2 border-border flex items-center justify-center">
                  <Image className="w-7 h-7 text-muted-foreground opacity-60" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">
                    Share Photos
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    When you share photos, they'll appear on your profile.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-primary font-semibold"
                  onClick={() => setShowUpload(true)}
                >
                  Share your first photo
                </Button>
              </div>
            ) : (
              <div ref={gridRef} className="grid grid-cols-3 md:grid-cols-4 gap-px">
                {posts.map((post) => (
                  <button
                    key={post._id}
                    className="aspect-square relative overflow-hidden bg-muted"
                    onClick={() => navigate(`/post/${post._id}`)}
                  >
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <span className="flex items-center gap-1 text-white text-xs font-semibold">
                        <Heart className="w-4 h-4 fill-white" />
                        {post.likes?.length || 0}
                      </span>
                      <span className="flex items-center gap-1 text-white text-xs font-semibold">
                        <MessageCircle className="w-4 h-4 fill-white" />
                        {post.comments?.length || 0}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="saved" className="m-0">
            {savedPosts === null ? (
              <PostGridSkeleton count={6} />
            ) : savedPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
                <Bookmark className="w-10 h-10 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">
                  No saved posts yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-px">
                {savedPosts.map((post) => (
                  <button
                    key={post._id}
                    className="aspect-square relative overflow-hidden bg-muted"
                    onClick={() => navigate(`/post/${post._id}`)}
                  >
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tagged" className="m-0">
            {taggedPosts === null ? (
              <PostGridSkeleton count={6} />
            ) : taggedPosts.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 px-6 text-center">
                <Tag className="w-10 h-10 text-muted-foreground opacity-30" />
                <p className="text-sm text-muted-foreground">
                  No tagged posts yet
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-3 md:grid-cols-4 gap-px bg-border">
                {taggedPosts.map((post) => (
                  <button
                    key={post._id}
                    className="aspect-square relative overflow-hidden bg-muted"
                    onClick={() => navigate(`/post/${post._id}`)}
                  >
                    <img
                      src={post.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </ScrollArea>

      {/* ── Modals ── */}
      <EditProfileDialog
        open={showEdit}
        onClose={() => setShowEdit(false)}
        dbUser={dbUser}
        onSaved={(updatedUser) =>
          setDbUser((prev) => ({ ...prev, ...updatedUser }))
        }
      />
      {showUpload && (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onSubmit={handleUploadPost}
        />
      )}
    </div>
  );
}
