const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { uploadImage, sendMedia, updateReactions, editMessage, markRead, getLinkPreview } = require("../controllers/messageController");

// Link preview (must come before /:id routes to avoid conflict)
router.get("/link-preview", getLinkPreview);

// Image/video/audio upload endpoint (legacy — upload only, no persistence)
// Wrap multer so Cloudinary errors are caught here (not by the global handler)
router.post("/upload", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.error("Upload middleware error:", err.message);
      return res.status(500).json({ error: err.message || "File upload failed" });
    }
    next();
  });
}, uploadImage);

// Upload + persist + broadcast in one request (reliable media sending)
router.post("/send", (req, res, next) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      console.error("Send media upload error:", err.message);
      return res.status(500).json({ error: err.message || "File upload failed" });
    }
    next();
  });
}, sendMedia);

// Message operations
router.patch("/:id/react", updateReactions);
router.patch("/:id/edit", editMessage);
router.post("/:id/read", markRead);

module.exports = router;
