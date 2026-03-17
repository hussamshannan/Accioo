const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  getFriends,
  getRequests,
  sendRequest,
  acceptRequest,
  rejectRequest,
  cancelRequest,
  removeFriend,
} = require("../controllers/friendController");

router.get("/", authMiddleware, getFriends);
router.get("/requests", authMiddleware, getRequests);
router.post("/request/:userId", authMiddleware, sendRequest);
router.patch("/request/:requestId/accept", authMiddleware, acceptRequest);
router.patch("/request/:requestId/reject", authMiddleware, rejectRequest);
router.delete("/request/:requestId", authMiddleware, cancelRequest);
router.delete("/:userId", authMiddleware, removeFriend);

module.exports = router;
