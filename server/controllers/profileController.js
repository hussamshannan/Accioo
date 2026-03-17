const ProfilePost = require("../models/ProfilePost");
const User = require("../models/User");
const { emitToUser } = require("../socket/socketEmitter");
const { deleteFile, deleteCloudinaryUrl } = require("../services/cloudinaryService");

const getMe = async (clerkId) => {
  if (!clerkId) return null;
  return User.findOne({ clerkId });
};

// GET /api/profile/posts/:postId — single post (isSaved included if authenticated)
const getPost = async (req, res) => {
  try {
    const post = await ProfilePost.findById(req.params.postId)
      .populate("author", "username displayName avatarUrl _id")
      .populate("taggedUsers", "username displayName avatarUrl _id")
      .populate("comments.user", "username displayName avatarUrl _id");
    if (!post) return res.status(404).json({ error: "Post not found" });

    let isSaved = false;
    const clerkId = req.auth?.userId;
    if (clerkId) {
      const me = await User.findOne({ clerkId }).select("savedPosts");
      isSaved = me?.savedPosts?.some((id) => id.toString() === post._id.toString()) ?? false;
    }

    res.json({ post, isSaved });
  } catch (err) {
    console.error("getPost error:", err);
    res.status(500).json({ error: "Failed to get post" });
  }
};

// GET /api/profile/:userId/posts
const getPosts = async (req, res) => {
  try {
    const posts = await ProfilePost.find({ author: req.params.userId })
      .populate("author", "username displayName avatarUrl")
      .populate("taggedUsers", "username displayName avatarUrl")
      .populate("comments.user", "username displayName avatarUrl")
      .sort({ createdAt: -1 });
    res.json({ posts });
  } catch (err) {
    console.error("getPosts error:", err);
    res.status(500).json({ error: "Failed to get posts" });
  }
};

// POST /api/profile/posts
const createPost = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const imageUrl = req.file?.path || req.file?.secure_url;
    if (!imageUrl) return res.status(400).json({ error: "Image required" });

    const caption = req.body.caption || "";
    let taggedUsers = [];
    try { taggedUsers = JSON.parse(req.body.tags || "[]"); } catch { /* ignore */ }
    const post = await ProfilePost.create({ author: me._id, imageUrl, caption, taggedUsers });
    await post.populate("author", "username displayName avatarUrl");
    await post.populate("taggedUsers", "username displayName avatarUrl");

    res.status(201).json({ post });
  } catch (err) {
    console.error("createPost error:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
};

// DELETE /api/profile/posts/:postId
const deletePost = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const post = await ProfilePost.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.author.toString() !== me._id.toString())
      return res.status(403).json({ error: "Not authorized" });

    // Extract Cloudinary public_id from URL and delete
    if (post.imageUrl) {
      const match = post.imageUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
      if (match) await deleteFile(match[1]).catch(() => {});
    }

    await post.deleteOne();
    res.json({ success: true });
  } catch (err) {
    console.error("deletePost error:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
};

// POST /api/profile/posts/:postId/like
const toggleLike = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const post = await ProfilePost.findById(req.params.postId).populate(
      "author",
      "clerkId username displayName"
    );
    if (!post) return res.status(404).json({ error: "Post not found" });

    const alreadyLiked = post.likes.some((id) => id.toString() === me._id.toString());
    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== me._id.toString());
    } else {
      post.likes.push(me._id);
      if (post.author._id.toString() !== me._id.toString()) {
        emitToUser(post.author.clerkId, "post-liked", {
          postId: post._id,
          liker: {
            _id: me._id,
            username: me.username,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
          },
        });
      }
    }

    await post.save();
    res.json({ likes: post.likes, liked: !alreadyLiked });
  } catch (err) {
    console.error("toggleLike error:", err);
    res.status(500).json({ error: "Failed to toggle like" });
  }
};

// POST /api/profile/posts/:postId/comment
const addComment = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const text = req.body.text?.trim();
    if (!text) return res.status(400).json({ error: "Comment text required" });

    const post = await ProfilePost.findById(req.params.postId).populate(
      "author",
      "clerkId"
    );
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.comments.push({ user: me._id, text });
    await post.save();

    await post.populate("comments.user", "username displayName avatarUrl");
    const added = post.comments[post.comments.length - 1];

    if (post.author._id.toString() !== me._id.toString()) {
      emitToUser(post.author.clerkId, "post-commented", {
        postId: post._id,
        comment: added,
      });
    }

    res.status(201).json({ comment: added });
  } catch (err) {
    console.error("addComment error:", err);
    res.status(500).json({ error: "Failed to add comment" });
  }
};

// DELETE /api/profile/posts/:postId/comment/:commentId
const deleteComment = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const post = await ProfilePost.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    const comment = post.comments.id(req.params.commentId);
    if (!comment) return res.status(404).json({ error: "Comment not found" });

    const isCommentAuthor = comment.user.toString() === me._id.toString();
    const isPostAuthor = post.author.toString() === me._id.toString();
    if (!isCommentAuthor && !isPostAuthor)
      return res.status(403).json({ error: "Not authorized" });

    comment.deleteOne();
    await post.save();
    res.json({ success: true });
  } catch (err) {
    console.error("deleteComment error:", err);
    res.status(500).json({ error: "Failed to delete comment" });
  }
};

// PATCH /api/profile/posts/:postId
const updatePost = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const post = await ProfilePost.findById(req.params.postId);
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (post.author.toString() !== me._id.toString())
      return res.status(403).json({ error: "Not authorized" });

    const { caption, taggedUsers } = req.body;
    if (caption !== undefined) post.caption = String(caption).slice(0, 500);
    if (Array.isArray(taggedUsers)) post.taggedUsers = taggedUsers;

    await post.save();
    await post.populate("author", "username displayName avatarUrl");
    await post.populate("taggedUsers", "username displayName avatarUrl");
    await post.populate("comments.user", "username displayName avatarUrl");

    res.json({ post });
  } catch (err) {
    console.error("updatePost error:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
};

// PATCH /api/profile/avatar
const updateAvatar = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const imageUrl = req.file?.path || req.file?.secure_url;
    if (!imageUrl) return res.status(400).json({ error: "Image required" });

    // Fetch current user to get old avatar URL before overwriting
    const existing = await User.findOne({ clerkId }).select("avatarUrl");
    const oldAvatarUrl = existing?.avatarUrl;

    const user = await User.findOneAndUpdate(
      { clerkId },
      { $set: { avatarUrl: imageUrl } },
      { returnDocument: "after" }
    ).select("-__v");

    if (!user) return res.status(404).json({ error: "User not found" });

    // Delete old avatar from Cloudinary after successful update
    if (oldAvatarUrl) deleteCloudinaryUrl(oldAvatarUrl).catch(() => {});

    res.json({ user });
  } catch (err) {
    console.error("updateAvatar error:", err);
    res.status(500).json({ error: "Failed to update avatar" });
  }
};

// POST /api/profile/posts/:postId/save — toggle save/unsave
const toggleSavePost = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const postExists = await ProfilePost.exists({ _id: req.params.postId });
    if (!postExists) return res.status(404).json({ error: "Post not found" });

    const postId = req.params.postId;
    const alreadySaved = me.savedPosts?.some((id) => id.toString() === postId);

    if (alreadySaved) {
      await User.findByIdAndUpdate(me._id, { $pull: { savedPosts: postId } });
    } else {
      await User.findByIdAndUpdate(me._id, { $addToSet: { savedPosts: postId } });
    }

    res.json({ saved: !alreadySaved });
  } catch (err) {
    console.error("toggleSavePost error:", err);
    res.status(500).json({ error: "Failed to toggle save" });
  }
};

// GET /api/profile/saved-posts — authenticated user's saved posts
const getSavedPosts = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId }).populate({
      path: "savedPosts",
      populate: { path: "author", select: "username displayName avatarUrl" },
      options: { sort: { createdAt: -1 } },
    });
    if (!me) return res.status(404).json({ error: "User not found" });
    res.json({ posts: me.savedPosts || [] });
  } catch (err) {
    console.error("getSavedPosts error:", err);
    res.status(500).json({ error: "Failed to get saved posts" });
  }
};

// GET /api/profile/:userId/tagged-posts — posts where user is tagged
const getTaggedPosts = async (req, res) => {
  try {
    const posts = await ProfilePost.find({ taggedUsers: req.params.userId })
      .populate("author", "username displayName avatarUrl")
      .sort({ createdAt: -1 });
    res.json({ posts });
  } catch (err) {
    console.error("getTaggedPosts error:", err);
    res.status(500).json({ error: "Failed to get tagged posts" });
  }
};

// GET /api/profile/activity — recent activity for the authenticated user
const getActivity = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId }).select("_id");
    if (!me) return res.status(404).json({ error: "User not found" });

    const LIMIT = 40;
    const items = [];

    // 1. Comments on my posts (by others) + likes on my posts
    const myPosts = await ProfilePost.find({ author: me._id })
      .select("_id imageUrl caption comments likes updatedAt createdAt")
      .populate("comments.user", "username displayName avatarUrl _id")
      .populate("likes", "username displayName avatarUrl _id");

    for (const post of myPosts) {
      // Comments
      for (const c of post.comments || []) {
        const uid = c.user?._id?.toString() || c.user?.toString();
        if (!uid || uid === me._id.toString()) continue;
        items.push({
          type: "comment",
          actor: c.user,
          postId: post._id,
          postImage: post.imageUrl,
          postCaption: post.caption || "",
          text: c.text,
          createdAt: c.createdAt || post.createdAt,
        });
      }

      // Likes — one item per post showing all likers
      const likers = (post.likes || []).filter(
        (u) => u._id?.toString() !== me._id.toString()
      );
      if (likers.length > 0) {
        items.push({
          type: "like",
          likers,
          postId: post._id,
          postImage: post.imageUrl,
          postCaption: post.caption || "",
          createdAt: post.updatedAt || post.createdAt,
        });
      }
    }

    // 2. Posts where I am tagged
    const taggedPosts = await ProfilePost.find({ taggedUsers: me._id })
      .select("_id imageUrl caption author createdAt")
      .populate("author", "username displayName avatarUrl _id");

    for (const post of taggedPosts) {
      const authorId = post.author?._id?.toString() || post.author?.toString();
      if (!authorId || authorId === me._id.toString()) continue;
      items.push({
        type: "tag",
        actor: post.author,
        postId: post._id,
        postImage: post.imageUrl,
        postCaption: post.caption || "",
        text: null,
        createdAt: post.createdAt,
      });
    }

    // Sort newest first, cap at LIMIT
    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ activity: items.slice(0, LIMIT) });
  } catch (err) {
    console.error("getActivity error:", err);
    res.status(500).json({ error: "Failed to get activity" });
  }
};

module.exports = {
  getPost,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  deleteComment,
  updateAvatar,
  toggleSavePost,
  getSavedPosts,
  getTaggedPosts,
  getActivity,
};
