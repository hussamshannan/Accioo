const { cloudinary } = require("../config/cloudinary");

const uploadImage = async (filePath, folder = "gocall/messages") => {
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "auto",
    transformation: [{ quality: "auto", fetch_format: "auto" }],
  });
  return { url: result.secure_url, publicId: result.public_id };
};

const uploadBuffer = async (buffer, mimetype, folder = "gocall/messages") => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto",
        transformation: [{ quality: "auto", fetch_format: "auto" }],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    uploadStream.end(buffer);
  });
};

const deleteFile = async (publicId, resourceType = "image") => {
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

// Extract public_id from a Cloudinary URL and delete it.
// Handles both image and audio/video resource types automatically.
const deleteCloudinaryUrl = async (url) => {
  if (!url || !url.includes("cloudinary.com")) return;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
  if (!match) return;
  const publicId = match[1];
  // Cloudinary resource_type: audio → "video", video → "video", image → "image"
  const resourceType =
    publicId.startsWith("gocall/audio/") || publicId.startsWith("gocall/videos/")
      ? "video"
      : "image";
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
};

module.exports = { uploadImage, uploadBuffer, deleteFile, deleteCloudinaryUrl };
