const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const upload = require("../middleware/upload");
const {
  getPost,
  getPosts,
  createPost,
  updatePost,
  deletePost,
  toggleLike,
  addComment,
  deleteComment,
  updateAvatar,
  toggleSavePost,
  getSavedPosts,
  getTaggedPosts,
  getActivity,
} = require("../controllers/profileController");

router.get("/posts/:postId", getPost);                                          // public — single post (isSaved if authed)
router.get("/saved-posts", authMiddleware, getSavedPosts);                      // own saved posts
router.get("/:userId/posts", getPosts);                                         // public — posts by user
router.get("/:userId/tagged-posts", getTaggedPosts);                            // public — posts tagging user
router.post("/posts", authMiddleware, upload.single("image"), createPost);
router.patch("/posts/:postId", authMiddleware, updatePost);
router.delete("/posts/:postId", authMiddleware, deletePost);
router.post("/posts/:postId/like", authMiddleware, toggleLike);
router.post("/posts/:postId/save", authMiddleware, toggleSavePost);
router.post("/posts/:postId/comment", authMiddleware, addComment);
router.delete("/posts/:postId/comment/:commentId", authMiddleware, deleteComment);
router.patch("/avatar", authMiddleware, upload.single("avatar"), updateAvatar);
router.get("/activity", authMiddleware, getActivity);

module.exports = router;
