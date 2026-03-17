const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../config/cloudinary");

// Cloudinary storage for multer
const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    // MIME type is the source of truth; fall back to extension only when MIME is absent
    const isAudio =
      file.mimetype?.startsWith("audio/") ||
      (!file.mimetype?.startsWith("video/") &&
        /\.(mp3|ogg|m4a|opus|wav)$/i.test(file.originalname || ""));

    const isVideo =
      !isAudio && (
        file.mimetype?.startsWith("video/") ||
        /\.(mp4|webm|mov|avi|mkv)$/i.test(file.originalname || "")
      );

    if (isAudio) {
      return {
        folder: "gocall/audio",
        resource_type: "auto", // Let Cloudinary auto-detect; avoids "Unsupported format" on webm/opus
      };
    }

    if (isVideo) {
      return {
        folder: "gocall/videos",
        resource_type: "video",
      };
    }

    return {
      folder: "gocall",
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
      transformation: [{ quality: "auto", fetch_format: "auto" }],
    };
  },
});

// Memory storage fallback when Cloudinary is not configured
const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: process.env.CLOUDINARY_CLOUD_NAME ? storage : memoryStorage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB (covers long voice messages)
  },
});

module.exports = upload;
