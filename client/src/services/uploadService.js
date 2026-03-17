import { API_URL } from "../utils/constants";

// Mirror the same token-getter pattern as api.js so XHR requests also carry the Clerk Bearer token.
let _getToken = null;
export const setUploadTokenGetter = (fn) => { _getToken = fn; };
const getAuthHeader = async () => {
  try { const t = _getToken ? await _getToken() : null; return t ? `Bearer ${t}` : null; } catch { return null; }
};

/**
 * Upload + persist + broadcast media in one HTTP request.
 * The server uploads to Cloudinary, saves the message to DB,
 * and broadcasts to all conversation participants via socket.
 *
 * Returns { ok, messageId, url, type }.
 */
export const sendMediaMessage = (file, { conversationId, clientMessageId, audioDuration }, onProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("image", file, file.name || "media");
    formData.append("conversationId", conversationId);
    if (clientMessageId) formData.append("clientMessageId", clientMessageId);
    if (audioDuration != null) formData.append("audioDuration", String(audioDuration));

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Send failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Send failed: ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error. Please check your connection."));
    xhr.ontimeout = () => reject(new Error("Request timed out. Please try again."));
    xhr.timeout = 120000; // 2 min for large uploads

    xhr.open("POST", `${API_URL}/api/messages/send`);
    xhr.withCredentials = true;

    getAuthHeader().then((authHeader) => {
      if (authHeader) xhr.setRequestHeader("Authorization", authHeader);
      xhr.send(formData);
    });
  });
};

/**
 * Legacy: Upload-only (no persistence). Kept for backward compatibility.
 */
export const uploadImageWithProgress = (file, onProgress) => {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("image", file);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.url);
        } catch {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));

    xhr.open("POST", `${API_URL}/api/messages/upload`);
    xhr.withCredentials = true;

    getAuthHeader().then((authHeader) => {
      if (authHeader) xhr.setRequestHeader("Authorization", authHeader);
      xhr.send(formData);
    });
  });
};

/**
 * Legacy: Upload audio blob only (no persistence).
 */
export const uploadAudioWithProgress = (blob, onProgress) => {
  const ext = blob.type?.includes("mp4") ? "mp4" : blob.type?.includes("ogg") ? "ogg" : "webm";

  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("image", blob, `voice-message.${ext}`);

    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve(data.url);
        } catch {
          reject(new Error("Invalid response from server"));
        }
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err.error || `Upload failed: ${xhr.status}`));
        } catch {
          reject(new Error(`Upload failed: ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));

    xhr.open("POST", `${API_URL}/api/messages/upload`);
    xhr.withCredentials = true;

    getAuthHeader().then((authHeader) => {
      if (authHeader) xhr.setRequestHeader("Authorization", authHeader);
      xhr.send(formData);
    });
  });
};
