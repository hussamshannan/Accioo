const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
      index: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "image", "audio", "system"],
      default: "text",
    },
    text: {
      type: String,
      default: "",
    },
    imageUrl: {
      type: String,
      default: "",
    },
    audioUrl: {
      type: String,
      default: "",
    },
    audioDuration: {
      type: Number,
      default: 0,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
    reactions: {
      type: Map,
      of: [String], // emoji -> array of user IDs
      default: {},
    },
    readBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    sharedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProfilePost",
      default: null,
    },
    // Denormalized snapshot of the story this message replies to. Stored inline
    // (not just a ref) so the quote survives the 24h story expiry/cleanup.
    storyReply: {
      type: {
        storyId: { type: mongoose.Schema.Types.ObjectId, ref: "Story" },
        storyAuthor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        mediaUrl: { type: String, default: "" },
        mediaType: { type: String, default: "" }, // "image" | "video" | "text"
        storyText: { type: String, default: "" },
        backgroundColor: { type: String, default: "" },
      },
      default: null,
    },
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Index for paginated message loading
messageSchema.index({ conversationId: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
