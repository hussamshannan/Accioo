const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["direct", "group"],
      default: "direct",
    },
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    groupName: {
      type: String,
      default: "",
    },
    groupAvatar: {
      type: String,
      default: "",
    },
    lastMessage: {
      text: String,
      sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      timestamp: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    // For anonymous/room-based chats (migration period)
    isAnonymous: {
      type: Boolean,
      default: false,
    },
    // Per-user unread message counts  { userId: count }
    unreadCounts: {
      type: Map,
      of: Number,
      default: {},
    },
    // Per-user flags
    pinnedBy:  [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    archivedBy:[{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    mutedBy:   [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Conversation", conversationSchema);
