const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");
const Conversation = require("../models/Conversation");
const { emitToUser } = require("../socket/socketEmitter");

const getMe = async (clerkId) => {
  if (!clerkId) return null;
  return User.findOne({ clerkId });
};

// GET /api/friends — list friends
const getFriends = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const user = await User.findById(me._id).populate(
      "friends",
      "username displayName avatarUrl isOnline lastSeen"
    );

    res.json({ friends: user.friends });
  } catch (err) {
    console.error("getFriends error:", err);
    res.status(500).json({ error: "Failed to get friends" });
  }
};

// GET /api/friends/requests — pending requests (sent + received)
const getRequests = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const [received, sent] = await Promise.all([
      FriendRequest.find({ to: me._id, status: "pending" })
        .populate("from", "username displayName avatarUrl isOnline"),
      FriendRequest.find({ from: me._id, status: "pending" })
        .populate("to", "username displayName avatarUrl isOnline"),
    ]);

    res.json({ received, sent });
  } catch (err) {
    console.error("getRequests error:", err);
    res.status(500).json({ error: "Failed to get requests" });
  }
};

// POST /api/friends/request/:userId — send friend request
const sendRequest = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const toUser = await User.findById(req.params.userId);
    if (!toUser) return res.status(404).json({ error: "Target user not found" });

    if (me._id.toString() === toUser._id.toString())
      return res.status(400).json({ error: "Cannot send request to yourself" });

    // Check already friends
    if (me.friends.some((id) => id.toString() === toUser._id.toString()))
      return res.status(400).json({ error: "Already friends" });

    // Check existing request
    const existing = await FriendRequest.findOne({
      $or: [
        { from: me._id, to: toUser._id },
        { from: toUser._id, to: me._id },
      ],
    });

    if (existing) {
      if (existing.status === "pending")
        return res.status(400).json({ error: "Request already pending" });
      // Re-send a previously rejected request
      existing.status = "pending";
      existing.from = me._id;
      existing.to = toUser._id;
      await existing.save();
      await existing.populate("from", "username displayName avatarUrl");
      emitToUser(toUser.clerkId, "friend-request-received", { request: existing });
      return res.status(201).json({ request: existing });
    }

    const request = await FriendRequest.create({ from: me._id, to: toUser._id });
    await request.populate("from", "username displayName avatarUrl");

    // Notify recipient in real-time
    emitToUser(toUser.clerkId, "friend-request-received", { request });

    res.status(201).json({ request });
  } catch (err) {
    console.error("sendRequest error:", err);
    res.status(500).json({ error: "Failed to send request" });
  }
};

// PATCH /api/friends/request/:requestId/accept
const acceptRequest = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.to.toString() !== me._id.toString())
      return res.status(403).json({ error: "Not authorized" });

    request.status = "accepted";
    await request.save();

    // Add each other as friends
    await Promise.all([
      User.findByIdAndUpdate(me._id, { $addToSet: { friends: request.from } }),
      User.findByIdAndUpdate(request.from, { $addToSet: { friends: me._id } }),
    ]);

    // Auto-create a direct conversation between them
    const existingConv = await Conversation.findOne({
      type: "direct",
      participants: { $all: [me._id, request.from], $size: 2 },
    });

    let conversation = existingConv;
    if (!conversation) {
      conversation = await Conversation.create({
        type: "direct",
        participants: [me._id, request.from],
        createdBy: me._id,
      });
    }

    const requester = await User.findById(request.from).select(
      "username displayName avatarUrl clerkId"
    );

    // Notify the original requester that their request was accepted
    emitToUser(requester.clerkId, "friend-request-accepted", {
      friend: { _id: me._id, username: me.username, displayName: me.displayName, avatarUrl: me.avatarUrl },
      conversationId: conversation._id,
    });

    // Strip internal clerkId before sending to client
    const { clerkId: _clerkId, ...requesterPublic } = requester.toObject();
    res.json({ success: true, requester: requesterPublic, conversationId: conversation._id });
  } catch (err) {
    console.error("acceptRequest error:", err);
    res.status(500).json({ error: "Failed to accept request" });
  }
};

// PATCH /api/friends/request/:requestId/reject
const rejectRequest = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    const request = await FriendRequest.findById(req.params.requestId);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.to.toString() !== me._id.toString())
      return res.status(403).json({ error: "Not authorized" });

    request.status = "rejected";
    await request.save();

    res.json({ success: true });
  } catch (err) {
    console.error("rejectRequest error:", err);
    res.status(500).json({ error: "Failed to reject request" });
  }
};

// DELETE /api/friends/request/:requestId — cancel sent request
const cancelRequest = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    await FriendRequest.findOneAndDelete({
      _id: req.params.requestId,
      from: me._id,
      status: "pending",
    });

    res.json({ success: true });
  } catch (err) {
    console.error("cancelRequest error:", err);
    res.status(500).json({ error: "Failed to cancel request" });
  }
};

// DELETE /api/friends/:userId — remove friend
const removeFriend = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const me = await getMe(clerkId);
    if (!me) return res.status(404).json({ error: "User not found" });

    await Promise.all([
      User.findByIdAndUpdate(me._id, { $pull: { friends: req.params.userId } }),
      User.findByIdAndUpdate(req.params.userId, { $pull: { friends: me._id } }),
      FriendRequest.findOneAndUpdate(
        {
          $or: [
            { from: me._id, to: req.params.userId },
            { from: req.params.userId, to: me._id },
          ],
        },
        { status: "rejected" }
      ),
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("removeFriend error:", err);
    res.status(500).json({ error: "Failed to remove friend" });
  }
};

module.exports = {
  getFriends,
  getRequests,
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeFriend,
};
