const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const { getFeed, createStory, markViewed, deleteStory } = require("../controllers/storyController");

router.get("/feed", authMiddleware, getFeed);
router.post("/", authMiddleware, upload.single("media"), createStory);
router.post("/:storyId/view", authMiddleware, markViewed);
router.delete("/:storyId", authMiddleware, deleteStory);

module.exports = router;
