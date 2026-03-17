const Story = require("../models/Story");
const User = require("../models/User");
const { cloudinary } = require("../config/cloudinary");
const socketEmitter = require("../socket/socketEmitter");

const STORY_TTL_HOURS = 24;

// GET /api/stories/feed — stories from self + friends (unexpired)
const getFeed = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const authorIds = [me._id, ...(me.friends || [])];
    const now = new Date();

    const stories = await Story.find({
      author: { $in: authorIds },
      expiresAt: { $gt: now },
    })
      .populate("author", "displayName username avatarUrl")
      .populate("viewers.user", "displayName username avatarUrl")
      .sort({ createdAt: -1 });

    // Group by author
    const grouped = {};
    for (const story of stories) {
      const authorId = story.author._id.toString();
      if (!grouped[authorId]) {
        grouped[authorId] = { author: story.author, stories: [] };
      }
      grouped[authorId].stories.push(story);
    }

    res.json({ feed: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/stories — create a story
const createStory = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const { type, text, backgroundColor } = req.body;
    const mediaUrl = req.file?.path || "";

    if (!type) return res.status(400).json({ error: "type is required" });
    if (type !== "text" && !mediaUrl)
      return res.status(400).json({ error: "media file required for image/video stories" });

    const expiresAt = new Date(Date.now() + STORY_TTL_HOURS * 60 * 60 * 1000);

    const story = await Story.create({
      author: me._id,
      type,
      mediaUrl,
      text: text || "",
      backgroundColor: backgroundColor || "#262626",
      expiresAt,
    });

    await story.populate("author", "displayName username avatarUrl");

    // Notify friends
    for (const friendId of me.friends || []) {
      const friend = await User.findById(friendId).select("clerkId");
      if (friend) {
        socketEmitter.emitToUser(friend.clerkId, "new-story", {
          author: story.author,
          storyId: story._id,
        });
      }
    }

    res.status(201).json({ story });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/stories/:storyId/view — mark viewed
const markViewed = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const story = await Story.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });

    const alreadyViewed = story.viewers.some(
      (v) => v.user.toString() === me._id.toString()
    );
    if (!alreadyViewed) {
      story.viewers.push({ user: me._id });
      await story.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/stories/:storyId — delete own story
const deleteStory = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const story = await Story.findById(req.params.storyId);
    if (!story) return res.status(404).json({ error: "Story not found" });
    if (story.author.toString() !== me._id.toString())
      return res.status(403).json({ error: "Forbidden" });

    // Delete media from Cloudinary if present
    if (story.mediaUrl) {
      const match = story.mediaUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
      if (match) {
        await cloudinary.uploader.destroy(match[1]).catch(() => {});
      }
    }

    await story.deleteOne();

    // Notify the author + their friends so their feeds update immediately
    const authorUser = await User.findById(story.author).select("clerkId friends");
    const notifyIds = authorUser ? [authorUser.clerkId, ...(authorUser.friends || []).map((f) => f.toString())] : [];
    for (const friendId of authorUser?.friends || []) {
      const friend = await User.findById(friendId).select("clerkId");
      if (friend) notifyIds.push(friend.clerkId);
    }
    const payload = { storyId: req.params.storyId, authorId: story.author.toString() };
    if (authorUser) socketEmitter.emitToUser(authorUser.clerkId, "story-deleted", payload);
    for (const friendId of authorUser?.friends || []) {
      const friend = await User.findById(friendId).select("clerkId");
      if (friend) socketEmitter.emitToUser(friend.clerkId, "story-deleted", payload);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getFeed, createStory, markViewed, deleteStory };
