const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["image", "video", "text"],
      required: true,
    },
    mediaUrl: {
      type: String,
      default: "",
    },
    text: {
      type: String,
      default: "",
    },
    backgroundColor: {
      type: String,
      default: "#262626",
    },
    viewers: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        viewedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

// TTL index — MongoDB auto-deletes documents when expiresAt is reached
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Story", storySchema);
