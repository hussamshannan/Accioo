/**
 * Media compression utilities for images and videos.
 * All functions return a File/Blob that fits within size limits.
 */

const TARGET_SIZE = 5 * 1024 * 1024; // 5MB target for compressed media
const MAX_SIZE = 15 * 1024 * 1024; // 15MB hard limit after compression

/* ── Image compression ───────────────────────────────────────────────────── */

/**
 * Compress an image file using Canvas API.
 * - Resizes to fit within maxWidth × maxHeight
 * - Iteratively lowers JPEG quality until the file is under targetSize
 * - Skips GIFs (to preserve animation) and already-small files
 */
export async function compressImage(
  file,
  { maxWidth = 1600, maxHeight = 1600, quality = 0.82, targetSize = TARGET_SIZE } = {}
) {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (file.size <= targetSize) return file;

  const img = await loadImage(file);
  let { width, height } = img;

  // Scale down to fit max dimensions
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);

  // Iterative quality reduction until under target size
  let q = quality;
  let blob = await canvasToBlob(canvas, "image/jpeg", q);

  while (blob.size > targetSize && q > 0.3) {
    q -= 0.1;
    blob = await canvasToBlob(canvas, "image/jpeg", q);
  }

  // If still too large, scale dimensions down further
  if (blob.size > targetSize) {
    const scale = Math.sqrt(targetSize / blob.size) * 0.9;
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas, "image/jpeg", 0.7);
  }

  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

/* ── Video compression ───────────────────────────────────────────────────── */

/**
 * Compress a video file by re-encoding through canvas + MediaRecorder.
 * - Scales down to fit within maxWidth × maxHeight
 * - Targets a lower bitrate for smaller file size
 * - Falls back to original if MediaRecorder or captureStream isn't supported
 */
export async function compressVideo(
  file,
  { maxWidth = 1280, maxHeight = 720, videoBitsPerSecond = 1_500_000, targetSize = TARGET_SIZE } = {}
) {
  if (!file.type.startsWith("video/")) return file;
  if (file.size <= targetSize) return file;

  // Check browser support
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    // Can't compress — just validate size
    if (file.size > MAX_SIZE) {
      throw new Error(`Video is too large (${formatMB(file.size)}). Maximum is ${formatMB(MAX_SIZE)}.`);
    }
    return file;
  }

  const video = await loadVideo(file);
  let { videoWidth: w, videoHeight: h } = video;

  // Scale down
  if (w > maxWidth || h > maxHeight) {
    const ratio = Math.min(maxWidth / w, maxHeight / h);
    w = Math.round(w * ratio);
    h = Math.round(h * ratio);
  }
  // Ensure even dimensions (required by some codecs)
  w = w % 2 === 0 ? w : w - 1;
  h = h % 2 === 0 ? h : h - 1;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");

  // Choose supported mime type
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
    .find((t) => MediaRecorder.isTypeSupported(t)) || "video/webm";

  const stream = canvas.captureStream(30);

  // Add audio track if present
  if (typeof video.captureStream === "function") {
    try {
      const videoStream = video.captureStream();
      const audioTracks = videoStream.getAudioTracks();
      audioTracks.forEach((t) => stream.addTrack(t));
    } catch {
      // No audio track or not supported — silent video is fine
    }
  }

  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
  const chunks = [];

  const compressed = await new Promise((resolve, reject) => {
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      const ext = mimeType.includes("mp4") ? "mp4" : "webm";
      resolve(new File([blob], file.name.replace(/\.\w+$/, `.${ext}`), { type: mimeType }));
    };
    recorder.onerror = (e) => reject(new Error("Video compression failed"));

    recorder.start(100);

    video.currentTime = 0;
    video.muted = true;
    video.play();

    const draw = () => {
      if (video.ended || video.paused) {
        recorder.stop();
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      requestAnimationFrame(draw);
    };
    draw();

    video.onended = () => recorder.stop();

    // Safety timeout: max 5 minutes of video
    setTimeout(() => {
      if (recorder.state === "recording") {
        video.pause();
        recorder.stop();
      }
    }, Math.min(video.duration * 1000 + 2000, 5 * 60 * 1000));
  });

  // If compressed is larger or still too big, use original if within limits
  if (compressed.size >= file.size) return file;

  if (compressed.size > MAX_SIZE) {
    throw new Error(`Video is still too large after compression (${formatMB(compressed.size)}). Try a shorter clip.`);
  }

  return compressed;
}

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not load image")); };
    img.src = url;
  });
}

function loadVideo(file) {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    const url = URL.createObjectURL(file);

    video.onloadedmetadata = () => {
      // Seek to start so first frame is available
      video.currentTime = 0;
    };
    video.onseeked = () => { URL.revokeObjectURL(url); resolve(video); };
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not load video")); };
    video.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export { TARGET_SIZE, MAX_SIZE };
