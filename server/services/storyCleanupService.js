const cron = require("node-cron");
const Story = require("../models/Story");
const { cloudinary } = require("../config/cloudinary");

// Runs every hour as a backup to MongoDB TTL index
const startStoryCleanup = () => {
  cron.schedule("0 * * * *", async () => {
    try {
      const expired = await Story.find({ expiresAt: { $lte: new Date() } });

      for (const story of expired) {
        if (story.mediaUrl) {
          const match = story.mediaUrl.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
          if (match) {
            await cloudinary.uploader.destroy(match[1]).catch(() => {});
          }
        }
        await story.deleteOne();
      }

      if (expired.length > 0) {
        console.log(`[StoryCleanup] Deleted ${expired.length} expired stories`);
      }
    } catch (err) {
      console.error("[StoryCleanup] Error:", err.message);
    }
  });

  console.log("Story cleanup cron started (hourly)");
};

module.exports = { startStoryCleanup };
