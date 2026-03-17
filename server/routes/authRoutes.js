const express = require("express");
const router = express.Router();
const User = require("../models/User");

// POST /api/auth/sync — Sync Clerk user with MongoDB
router.post("/sync", async (req, res) => {
  try {
    const { clerkId, email, username, displayName, avatarUrl } = req.body;

    if (!clerkId || !email) {
      return res.status(400).json({ error: "clerkId and email are required" });
    }

    // $set: always update email (Clerk is source of truth for email)
    // $setOnInsert: only set these on first creation — never overwrite user edits
    let user = await User.findOne({ clerkId });
    if (user) {
      user.email = email;
      await user.save();
    } else {
      // Fallback: existing doc with same email but different clerkId (e.g. re-created account)
      user = await User.findOne({ email });
      if (user) {
        user.clerkId = clerkId;
        user.email = email;
        await user.save();
      } else {
        user = await User.create({
          clerkId,
          email,
          username: username || email.split("@")[0],
          displayName: displayName || username || "User",
          avatarUrl: avatarUrl || "",
        });
      }
    }

    res.json({ user });
  } catch (error) {
    console.error("Auth sync error:", error);
    res.status(500).json({ error: "Failed to sync user" });
  }
});

// GET /api/auth/me — Get current user profile
router.get("/me", async (req, res) => {
  try {
    const clerkId = req.headers["x-clerk-id"] || req.auth?.userId;
    if (!clerkId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const user = await User.findOne({ clerkId }).select("-__v");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ user });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Failed to get user" });
  }
});

module.exports = router;
