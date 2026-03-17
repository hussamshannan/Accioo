const express = require("express");
const router = express.Router();
const { Webhook } = require("standardwebhooks");
const User = require("../models/User");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const ProfilePost = require("../models/ProfilePost");
const Story = require("../models/Story");
const FriendRequest = require("../models/FriendRequest");
const { deleteCloudinaryUrl } = require("../services/cloudinaryService");

// ── Full account cleanup triggered by Clerk's user.deleted webhook ────────
async function deleteUserData(clerkId) {
  const user = await User.findOne({ clerkId });
  if (!user) return;
  const userId = user._id;

  // 1. Delete Cloudinary assets for all ProfilePosts, then delete the posts
  const posts = await ProfilePost.find({ author: userId }).select("imageUrl");
  await Promise.allSettled(posts.map((p) => p.imageUrl ? deleteCloudinaryUrl(p.imageUrl) : null));
  await ProfilePost.deleteMany({ author: userId });

  // 2. Delete Cloudinary assets for all Stories, then delete the stories
  const stories = await Story.find({ author: userId }).select("mediaUrl");
  await Promise.allSettled(stories.map((s) => s.mediaUrl ? deleteCloudinaryUrl(s.mediaUrl) : null));
  await Story.deleteMany({ author: userId });

  // 3. Delete Cloudinary assets for all messages sent by this user
  const messages = await Message.find({ sender: userId, $or: [{ imageUrl: { $ne: "" } }, { audioUrl: { $ne: "" } }] }).select("imageUrl audioUrl");
  await Promise.allSettled(
    messages.flatMap((m) => [
      m.imageUrl ? deleteCloudinaryUrl(m.imageUrl) : null,
      m.audioUrl ? deleteCloudinaryUrl(m.audioUrl) : null,
    ].filter(Boolean))
  );

  // 4. Delete all messages sent by this user
  await Message.deleteMany({ sender: userId });

  // 5. Delete old avatar from Cloudinary
  if (user.avatarUrl) await deleteCloudinaryUrl(user.avatarUrl).catch(() => {});

  // 6. Handle conversations:
  //    - If user is the sole participant → delete conversation + its messages
  //    - Otherwise → remove user from participants; delete conversation if now empty
  const convs = await Conversation.find({ participants: userId }).select("participants");
  for (const conv of convs) {
    if (conv.participants.length <= 1) {
      await Message.deleteMany({ conversationId: conv._id });
      await conv.deleteOne();
    } else {
      await Conversation.findByIdAndUpdate(conv._id, { $pull: { participants: userId, pinnedBy: userId, archivedBy: userId, mutedBy: userId } });
      // If no participants remain after pull, clean up
      const updated = await Conversation.findById(conv._id);
      if (updated && updated.participants.length === 0) {
        await Message.deleteMany({ conversationId: conv._id });
        await updated.deleteOne();
      }
    }
  }

  // 7. Delete all FriendRequests involving this user
  await FriendRequest.deleteMany({ $or: [{ from: userId }, { to: userId }] });

  // 8. Remove user from other users' friends arrays and savedPosts
  await User.updateMany({ friends: userId }, { $pull: { friends: userId } });

  // 9. Remove user from tagged posts
  await ProfilePost.updateMany({ taggedUsers: userId }, { $pull: { taggedUsers: userId } });

  // 10. Delete the user document itself
  await User.deleteOne({ _id: userId });

  console.log(`Account deleted: clerkId=${clerkId}, userId=${userId}`);
}

// POST /api/webhooks/clerk — raw body needed for signature verification
router.post("/clerk", express.raw({ type: "application/json" }), async (req, res) => {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("CLERK_WEBHOOK_SECRET not set — webhook ignored");
    return res.status(200).json({ received: true });
  }

  const wh = new Webhook(secret);
  let event;
  try {
    // standardwebhooks verify(body, headers)
    event = await wh.verify(req.body, {
      "webhook-id":        req.headers["svix-id"],
      "webhook-timestamp": req.headers["svix-timestamp"],
      "webhook-signature": req.headers["svix-signature"],
    });
  } catch (err) {
    console.error("Webhook verification failed:", err.message);
    return res.status(400).json({ error: "Invalid webhook signature" });
  }

  if (event.type === "user.deleted") {
    const clerkId = event.data.id;
    try {
      await deleteUserData(clerkId);
    } catch (err) {
      console.error("deleteUserData error:", err);
      // Return 200 so Clerk doesn't retry — log the error for manual cleanup
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;
