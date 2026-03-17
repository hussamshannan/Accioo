const express = require("express");
const router = express.Router();
const {
  getConversations,
  createConversation,
  getConversation,
  getMessages,
  sharePost,
  sendTextMessage,
  deleteConversation,
  updateConversationSettings,
  markConversationRead,
  forwardMessage,
} = require("../controllers/conversationController");

router.get("/", getConversations);
router.post("/", createConversation);
router.get("/:id", getConversation);
router.get("/:id/messages", getMessages);
router.post("/:id/share-post", sharePost);
router.post("/:id/message", sendTextMessage);
router.delete("/:id", deleteConversation);
router.patch("/:id/settings", updateConversationSettings);
router.post("/:id/read", markConversationRead);
router.post("/:id/forward", forwardMessage);

module.exports = router;
