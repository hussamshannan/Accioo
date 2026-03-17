const User = require("../models/User");
const FriendRequest = require("../models/FriendRequest");

// GET /api/users/search?q=
const searchUsers = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const q = req.query.q?.trim();
    if (!q || q.length < 2) return res.json({ users: [] });

    const me = clerkId ? await User.findOne({ clerkId }) : null;

    const users = await User.find({
      $and: [
        { _id: { $ne: me?._id } },
        {
          $or: [
            { username: { $regex: q, $options: "i" } },
            { displayName: { $regex: q, $options: "i" } },
          ],
        },
      ],
    })
      .select("_id username displayName avatarUrl isOnline bio")
      .limit(20);

    // Attach relationship status for each result
    if (!me) return res.json({ users });

    const results = await Promise.all(
      users.map(async (u) => {
        const isFriend = me.friends.some((id) => id.toString() === u._id.toString());
        const pendingRequest = await FriendRequest.findOne({
          $or: [
            { from: me._id, to: u._id, status: "pending" },
            { from: u._id, to: me._id, status: "pending" },
          ],
        });
        return {
          ...u.toObject(),
          isFriend,
          pendingRequestId: pendingRequest?._id || null,
          requestDirection: pendingRequest
            ? pendingRequest.from.toString() === me._id.toString()
              ? "sent"
              : "received"
            : null,
        };
      })
    );

    res.json({ users: results });
  } catch (err) {
    console.error("searchUsers error:", err);
    res.status(500).json({ error: "Search failed" });
  }
};

// GET /api/users/:id
const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select("_id username displayName avatarUrl bio isOnline lastSeen")
      .populate("friends", "username displayName avatarUrl isOnline");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (err) {
    console.error("getUserProfile error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
};

// PATCH /api/users/me
const updateProfile = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const { displayName, bio } = req.body;

    const user = await User.findOneAndUpdate(
      { clerkId },
      { $set: { displayName, bio } },
      { returnDocument: "after", runValidators: true }
    ).select("-__v");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (err) {
    console.error("updateProfile error:", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

// GET /api/users/me
const getMe = async (req, res) => {
  try {
    const clerkId = req.auth?.userId || req.headers["x-clerk-id"];
    const user = await User.findOne({ clerkId })
      .select("-__v")
      .populate("friends", "username displayName avatarUrl isOnline lastSeen");

    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ user });
  } catch (err) {
    console.error("getMe error:", err);
    res.status(500).json({ error: "Failed to get profile" });
  }
};

module.exports = { searchUsers, getUserProfile, updateProfile, getMe };
