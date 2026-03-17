const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const {
  searchUsers,
  getUserProfile,
  updateProfile,
  getMe,
} = require("../controllers/userController");

router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, updateProfile);
router.get("/search", searchUsers); // public, attaches relationship if authed
router.get("/:id", getUserProfile);

module.exports = router;
