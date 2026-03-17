const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const User = require("../models/User");
const { uploadBuffer } = require("../services/cloudinaryService");
const { emitToUser } = require("../socket/socketEmitter");

// In-memory cache for link previews (url → { data, cachedAt })
const linkPreviewCache = new Map();
const LINK_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// POST /api/messages/upload — upload image to Cloudinary
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    let imageUrl;

    // If Cloudinary is configured, the file is already uploaded by multer-storage-cloudinary
    if (req.file.path && req.file.path.startsWith("http")) {
      imageUrl = req.file.path; // Cloudinary URL from multer-storage-cloudinary
    } else if (req.file.buffer) {
      // Memory storage fallback — fail fast if Cloudinary is not configured
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        return res.status(503).json({
          error:
            "Media upload is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to the server .env file.",
        });
      }
      const result = await uploadBuffer(req.file.buffer, req.file.mimetype);
      imageUrl = result.url;
    } else {
      return res.status(500).json({ error: "Upload configuration error" });
    }

    res.json({ url: imageUrl });
  } catch (err) {
    console.error("uploadImage error:", err);
    res.status(500).json({ error: "Failed to upload image" });
  }
};

// POST /api/messages/send — upload media, persist message, and broadcast to participants
// This is the reliable path for media messages (images, videos, audio).
// Uses HTTP instead of socket for the send path to guarantee delivery.
const sendMedia = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    if (!clerkId) return res.status(401).json({ error: "Unauthorized" });

    const user = await User.findOne({ clerkId }).select("_id");
    if (!user) return res.status(401).json({ error: "User not found" });

    const { conversationId, clientMessageId, audioDuration } = req.body;
    if (!conversationId) return res.status(400).json({ error: "conversationId is required" });

    if (!req.file) return res.status(400).json({ error: "No file provided" });

    // Get the uploaded URL (multer-storage-cloudinary already uploaded it)
    let mediaUrl;
    if (req.file.path && req.file.path.startsWith("http")) {
      mediaUrl = req.file.path;
    } else if (req.file.buffer) {
      if (!process.env.CLOUDINARY_CLOUD_NAME) {
        return res.status(503).json({ error: "Media upload is not configured." });
      }
      const result = await uploadBuffer(req.file.buffer, req.file.mimetype);
      mediaUrl = result.url;
    } else {
      return res.status(500).json({ error: "Upload configuration error" });
    }

    // Determine message type from mime
    const mime = req.file.mimetype || "";
    const isAudio = mime.startsWith("audio/") || /\.(webm|ogg|mp3|m4a|opus|wav)$/i.test(req.file.originalname || "");
    const isVideo = !isAudio && (mime.startsWith("video/") || /\.(mp4|webm|mov)$/i.test(req.file.originalname || ""));
    const type = isAudio ? "audio" : isVideo ? "video" : "image";

    // Persist message to DB
    const msg = await Message.create({
      conversationId,
      sender: user._id,
      type,
      text: "",
      imageUrl: type !== "audio" ? mediaUrl : "",
      audioUrl: type === "audio" ? mediaUrl : "",
      audioDuration: type === "audio" ? parseFloat(audioDuration) || 0 : 0,
    });

    // Update conversation lastMessage
    const lastText = type === "audio" ? "🎵 Voice message" : type === "video" ? "🎬 Video" : "📷 Image";
    const now = new Date();
    const conv = await Conversation.findByIdAndUpdate(
      conversationId,
      { lastMessage: { text: lastText, sender: user._id, timestamp: now }, updatedAt: now },
      { returnDocument: "before" }
    ).populate("participants", "clerkId _id");

    if (conv) {
      // Increment unread counts for non-senders
      const nonSenders = conv.participants.filter(
        (p) => p._id.toString() !== user._id.toString()
      );
      if (nonSenders.length > 0) {
        const incUpdate = {};
        nonSenders.forEach((p) => { incUpdate[`unreadCounts.${p._id}`] = 1; });
        await Conversation.findByIdAndUpdate(conversationId, { $inc: incUpdate }).catch(() => {});
      }

      // Build the real-time payload
      const eventName = type === "audio" ? "receive-audio" : "receive-image";
      const payload = {
        id: clientMessageId || msg._id.toString(),
        conversationId,
        isMe: false,
        timestamp: msg.createdAt.toISOString(),
        sender: { _id: user._id.toString(), clerkId },
        ...(type === "audio"
          ? { audioUrl: mediaUrl, audioDuration: msg.audioDuration }
          : { imageUrl: mediaUrl }),
      };

      const conversationUpdatedPayload = {
        conversationId,
        lastMessage: { text: lastText, timestamp: now.toISOString() },
        senderId: user._id.toString(),
      };

      // Broadcast to all participants (including sender for multi-device)
      conv.participants.forEach((p) => {
        emitToUser(p.clerkId, "conversation-updated", conversationUpdatedPayload);
        if (p._id.toString() !== user._id.toString()) {
          emitToUser(p.clerkId, eventName, payload);
        }
      });
    }

    res.json({
      ok: true,
      messageId: msg._id.toString(),
      url: mediaUrl,
      type,
    });
  } catch (err) {
    console.error("sendMedia error:", err);
    res.status(500).json({ error: "Failed to send media" });
  }
};

// PATCH /api/messages/:id/react — update reactions
const updateReactions = async (req, res) => {
  try {
    const { reactions } = req.body;
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { $set: { reactions } },
      { returnDocument: "after" }
    );
    if (!message) return res.status(404).json({ error: "Message not found" });
    res.json({ message });
  } catch (err) {
    console.error("updateReactions error:", err);
    res.status(500).json({ error: "Failed to update reactions" });
  }
};

// PATCH /api/messages/:id/edit — edit message text
const editMessage = async (req, res) => {
  try {
    const { text } = req.body;
    const message = await Message.findByIdAndUpdate(
      req.params.id,
      { $set: { text, edited: true, editedAt: new Date() } },
      { returnDocument: "after" }
    );
    if (!message) return res.status(404).json({ error: "Message not found" });
    res.json({ message });
  } catch (err) {
    console.error("editMessage error:", err);
    res.status(500).json({ error: "Failed to edit message" });
  }
};

// POST /api/messages/:id/read — mark message as read
const markRead = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const user = await User.findOne({ clerkId });
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    await Message.findByIdAndUpdate(req.params.id, {
      $addToSet: { readBy: { user: user._id } },
    });

    res.json({ success: true });
  } catch (err) {
    console.error("markRead error:", err);
    res.status(500).json({ error: "Failed to mark as read" });
  }
};

// GET /api/messages/link-preview?url=
const getLinkPreview = async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "url required" });

  // Check cache
  const cached = linkPreviewCache.get(url);
  if (cached && Date.now() - cached.cachedAt < LINK_CACHE_TTL) {
    return res.json(cached.data);
  }

  try {
    // Lazy-load ogs to avoid startup cost when not used
    const ogs = require("open-graph-scraper");
    const { result, error } = await ogs({ url, timeout: 5000 });
    if (error || !result.success) return res.status(204).end();

    const data = {
      title: result.ogTitle || result.twitterTitle || "",
      description: result.ogDescription || result.twitterDescription || "",
      image: result.ogImage?.[0]?.url || result.twitterImage?.[0]?.url || "",
      siteName: result.ogSiteName || "",
      url,
    };

    linkPreviewCache.set(url, { data, cachedAt: Date.now() });
    res.json(data);
  } catch {
    res.status(204).end();
  }
};

module.exports = { uploadImage, sendMedia, updateReactions, editMessage, markRead, getLinkPreview };
