const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const ProfilePost = require("../models/ProfilePost");
const { deleteCloudinaryUrl } = require("../services/cloudinaryService");

// Helper: annotate a raw conversation document with per-user metadata
const annotateConv = (c, uid) => {
  const obj = c.toObject();
  obj.unreadCount = c.unreadCounts?.get(uid) || 0;
  obj.isPinned    = c.pinnedBy?.some((id) => id.toString() === uid) || false;
  obj.isArchived  = c.archivedBy?.some((id) => id.toString() === uid) || false;
  obj.isMuted     = c.mutedBy?.some((id) => id.toString() === uid) || false;
  delete obj.unreadCounts;
  delete obj.pinnedBy;
  delete obj.archivedBy;
  delete obj.mutedBy;
  return obj;
};

// GET /api/conversations — list user's conversations
// ?archived=true returns only archived conversations
const getConversations = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(404).json({ error: "User not found" });

    const uid = user._id.toString();
    const wantArchived = req.query.archived === "true";

    const filter = wantArchived
      ? { participants: user._id, archivedBy: user._id }
      : { participants: user._id, archivedBy: { $ne: user._id } };

    const rawConvs = await Conversation.find(filter)
      .populate("participants", "username displayName avatarUrl isOnline lastSeen")
      .populate("lastMessage.sender", "displayName")
      .sort({ updatedAt: -1 });

    const conversations = rawConvs.map((c) => annotateConv(c, uid));

    if (!wantArchived) {
      // Pinned first, then by recency
      conversations.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });

      // Also return count of archived conversations so the UI can show the row
      const archivedCount = await Conversation.countDocuments({
        participants: user._id,
        archivedBy: user._id,
      });

      return res.json({ conversations, archivedCount });
    }

    res.json({ conversations });
  } catch (err) {
    console.error("getConversations error:", err);
    res.status(500).json({ error: "Failed to get conversations" });
  }
};

// POST /api/conversations — create or find a direct conversation
const createConversation = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const { type = "direct", participantIds = [], groupName = "", isAnonymous = false } = req.body;

    let creatorId = null;
    if (clerkId) {
      const creator = await User.findOne({ clerkId });
      if (creator) creatorId = creator._id;
    }

    let conversation;

    // For direct chats, find existing conversation between these two users
    if (type === "direct" && participantIds.length === 1 && creatorId) {
      const otherUser = await User.findById(participantIds[0]);
      if (!otherUser) return res.status(404).json({ error: "User not found" });

      conversation = await Conversation.findOne({
        type: "direct",
        participants: { $all: [creatorId, otherUser._id], $size: 2 },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          type: "direct",
          participants: [creatorId, otherUser._id],
          createdBy: creatorId,
        });
      }
    } else {
      // Group or anonymous chat
      const participants = creatorId ? [creatorId, ...participantIds] : [];
      conversation = await Conversation.create({
        type: participantIds.length > 0 ? type : "direct",
        participants,
        groupName,
        createdBy: creatorId,
        isAnonymous,
      });
    }

    await conversation.populate("participants", "username displayName avatarUrl isOnline");

    res.status(201).json({ conversation });
  } catch (err) {
    console.error("createConversation error:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
};

// GET /api/conversations/:id — get single conversation
const getConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate("participants", "username displayName avatarUrl isOnline lastSeen");

    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    res.json({ conversation });
  } catch (err) {
    console.error("getConversation error:", err);
    res.status(500).json({ error: "Failed to get conversation" });
  }
};

// GET /api/conversations/:id/messages — paginated messages
const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 40;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ conversationId: id })
        .populate("sender", "username displayName avatarUrl")
        .populate("replyTo", "text imageUrl audioUrl sender type deletedForEveryone")
        .populate({
          path: "sharedPost",
          select: "imageUrl caption likes comments taggedUsers author",
          populate: { path: "author", select: "username displayName avatarUrl _id" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments({ conversationId: id }),
    ]);

    res.json({
      messages: messages.reverse(), // oldest first
      pagination: {
        page,
        limit,
        total,
        hasMore: skip + messages.length < total,
      },
    });
  } catch (err) {
    console.error("getMessages error:", err);
    res.status(500).json({ error: "Failed to get messages" });
  }
};

// POST /api/conversations/:id/share-post
const sharePost = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (!conv.participants.some((p) => p.toString() === me._id.toString()))
      return res.status(403).json({ error: "Not a participant" });

    const { imageUrl, text = "", postId } = req.body;
    if (!imageUrl) return res.status(400).json({ error: "imageUrl required" });

    // Fetch post preview for socket event
    let postPreview = null;
    if (postId) {
      const post = await ProfilePost.findById(postId)
        .select("imageUrl caption likes comments author")
        .populate("author", "username displayName avatarUrl _id");
      if (post) {
        postPreview = {
          _id: post._id.toString(),
          imageUrl: post.imageUrl,
          caption: post.caption || "",
          author: post.author,
          likesCount: post.likes?.length || 0,
          commentsCount: post.comments?.length || 0,
        };
      }
    }

    const now = new Date();
    const msg = await Message.create({
      conversationId: conv._id,
      sender: me._id,
      type: "image",
      imageUrl,
      text,
      sharedPost: postId || null,
    });

    const lastText = text ? `📷 ${text}` : "📷 Shared a post";
    await Conversation.findByIdAndUpdate(conv._id, {
      lastMessage: { text: lastText, sender: me._id, timestamp: now },
      updatedAt: now,
    });

    const { emitToUser } = require("../socket/socketEmitter");
    await conv.populate("participants", "clerkId _id");

    // Increment unread for non-sender participants
    const shareIncUpdate = {};
    conv.participants.forEach((p) => {
      if (p._id.toString() !== me._id.toString()) shareIncUpdate[`unreadCounts.${p._id}`] = 1;
    });
    if (Object.keys(shareIncUpdate).length > 0) {
      await Conversation.findByIdAndUpdate(conv._id, { $inc: shareIncUpdate }).catch(() => {});
    }

    const payload = {
      conversationId: conv._id.toString(),
      lastMessage: { text: lastText, timestamp: now.toISOString() },
      senderId: me._id.toString(),
    };
    conv.participants.forEach((p) => {
      emitToUser(p.clerkId, "conversation-updated", payload);
      if (p.clerkId !== clerkId) {
        emitToUser(p.clerkId, "receive-image", {
          id: msg._id.toString(),
          imageUrl,
          text,
          isMe: false,
          timestamp: now.toISOString(),
          sender: me._id.toString(),
          sharedPost: postPreview,
        });
      }
    });

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error("sharePost error:", err);
    res.status(500).json({ error: "Failed to share post" });
  }
};

// POST /api/conversations/:id/message — send a plain-text message via REST
// Used by story replies (no socket context available in viewer page)
const sendTextMessage = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (!conv.participants.some((p) => p.toString() === me._id.toString()))
      return res.status(403).json({ error: "Not a participant" });

    const { text, storyReply: rawStoryReply } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });

    // Sanitize the optional story-reply snapshot — keep only known fields.
    const hex24 = (v) => typeof v === "string" && /^[0-9a-fA-F]{24}$/.test(v);
    let storyReply = null;
    if (rawStoryReply && typeof rawStoryReply === "object") {
      storyReply = {
        storyId: hex24(rawStoryReply.storyId) ? rawStoryReply.storyId : null,
        storyAuthor: hex24(rawStoryReply.storyAuthor) ? rawStoryReply.storyAuthor : null,
        mediaUrl: String(rawStoryReply.mediaUrl || ""),
        mediaType: String(rawStoryReply.mediaType || ""),
        storyText: String(rawStoryReply.storyText || ""),
        backgroundColor: String(rawStoryReply.backgroundColor || ""),
      };
    }

    const now = new Date();
    const msg = await Message.create({
      conversationId: conv._id,
      sender: me._id,
      type: "text",
      text: text.trim(),
      storyReply,
    });

    await Conversation.findByIdAndUpdate(conv._id, {
      lastMessage: { text: text.trim(), sender: me._id, timestamp: now },
      updatedAt: now,
    });

    const { emitToUser } = require("../socket/socketEmitter");
    await conv.populate("participants", "clerkId _id");

    // Increment unread for non-sender participants
    const incUpdate = {};
    conv.participants.forEach((p) => {
      if (p._id.toString() !== me._id.toString()) incUpdate[`unreadCounts.${p._id}`] = 1;
    });
    if (Object.keys(incUpdate).length > 0) {
      await Conversation.findByIdAndUpdate(conv._id, { $inc: incUpdate }).catch(() => {});
    }

    const payload = {
      conversationId: conv._id.toString(),
      lastMessage: { text: text.trim(), timestamp: now.toISOString() },
      senderId: me._id.toString(),
    };
    conv.participants.forEach((p) => {
      emitToUser(p.clerkId, "conversation-updated", payload);
      if (p.clerkId !== clerkId) {
        emitToUser(p.clerkId, "chat-message", {
          id: msg._id.toString(),
          text: text.trim(),
          isMe: false,
          timestamp: now.toISOString(),
          sender: me._id.toString(),
          storyReply: storyReply || null,
        });
      }
    });

    res.status(201).json({ message: msg });
  } catch (err) {
    console.error("sendTextMessage error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
};

// DELETE /api/conversations/:id — remove self from conversation, or delete for everyone
const deleteConversation = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });
    if (!conv.participants.some((p) => p.toString() === me._id.toString()))
      return res.status(403).json({ error: "Not a participant" });

    const forEveryone = req.body?.forEveryone === true;

    if (forEveryone) {
      // Delete Cloudinary assets for all messages that have media
      const mediaMessages = await Message.find({
        conversationId: conv._id,
        $or: [{ imageUrl: { $ne: "" } }, { audioUrl: { $ne: "" } }],
      }).select("imageUrl audioUrl");

      await Promise.allSettled(
        mediaMessages.flatMap((msg) => [
          msg.imageUrl ? deleteCloudinaryUrl(msg.imageUrl) : null,
          msg.audioUrl ? deleteCloudinaryUrl(msg.audioUrl) : null,
        ].filter(Boolean))
      );

      // Delete all messages and the conversation itself
      await Message.deleteMany({ conversationId: conv._id });
      await Conversation.findByIdAndDelete(conv._id);
    } else {
      // Only remove this user from participants
      await Conversation.findByIdAndUpdate(req.params.id, {
        $pull: { participants: me._id },
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteConversation error:", err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
};

// PATCH /api/conversations/:id/settings — toggle pin / mute / archive
const updateConversationSettings = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    const { action } = req.body; // "pin"|"unpin"|"mute"|"unmute"|"archive"|"unarchive"
    const updateMap = {
      pin:       { $addToSet: { pinnedBy:   me._id } },
      unpin:     { $pull:     { pinnedBy:   me._id } },
      mute:      { $addToSet: { mutedBy:    me._id } },
      unmute:    { $pull:     { mutedBy:    me._id } },
      archive:   { $addToSet: { archivedBy: me._id } },
      unarchive: { $pull:     { archivedBy: me._id } },
    };

    if (!updateMap[action]) return res.status(400).json({ error: "Invalid action" });

    await Conversation.findByIdAndUpdate(req.params.id, updateMap[action]);
    res.json({ success: true });
  } catch (err) {
    console.error("updateConversationSettings error:", err);
    res.status(500).json({ error: "Failed to update settings" });
  }
};

// POST /api/conversations/:id/read — mark all messages as read (reset unread count)
const markConversationRead = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await User.findOne({ clerkId });
    if (!me) return res.status(404).json({ error: "User not found" });

    await Conversation.findByIdAndUpdate(req.params.id, {
      $unset: { [`unreadCounts.${me._id}`]: 1 },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("markConversationRead error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

// POST /api/conversations/:id/forward
const forwardMessage = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const { messageId } = req.body;
    if (!messageId) return res.status(400).json({ error: "messageId required" });

    const sourceMsg = await Message.findById(messageId);
    if (!sourceMsg) return res.status(404).json({ error: "Source message not found" });

    const targetConvId = req.params.id;
    const targetConv = await Conversation.findOne({
      _id: targetConvId,
      participants: user._id,
    });
    if (!targetConv) return res.status(403).json({ error: "Conversation not found" });

    const newMsg = await Message.create({
      conversation: targetConvId,
      sender: user._id,
      type: sourceMsg.type || "text",
      text: sourceMsg.text || "",
      imageUrl: sourceMsg.imageUrl || undefined,
      audioUrl: sourceMsg.audioUrl || undefined,
      audioDuration: sourceMsg.audioDuration || undefined,
    });

    await Conversation.findByIdAndUpdate(targetConvId, {
      "lastMessage.text": sourceMsg.text || (sourceMsg.imageUrl ? "📷 Photo" : "🎵 Voice"),
      "lastMessage.sender": user._id,
      "lastMessage.timestamp": newMsg.createdAt,
      updatedAt: newMsg.createdAt,
    });

    res.status(201).json({ message: newMsg });
  } catch (err) {
    console.error("forwardMessage error:", err);
    res.status(500).json({ error: "Failed to forward message" });
  }
};

module.exports = {
  getConversations,
  createConversation,
  getConversation,
  getMessages,
  sharePost,
  sendTextMessage,
  deleteConversation,
  updateConversationSettings,
  markConversationRead,
  forwardMessage,
};
