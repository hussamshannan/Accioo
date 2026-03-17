import api from "./api";

export const getPost = (postId) => api.get(`/api/profile/posts/${postId}`);

export const getUserPosts = (userId) => api.get(`/api/profile/${userId}/posts`);

export const createPost = (formData) =>
  api.post("/api/profile/posts", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const updatePost = (postId, data) => api.patch(`/api/profile/posts/${postId}`, data);

export const deletePost = (postId) => api.delete(`/api/profile/posts/${postId}`);

export const toggleLike = (postId) => api.post(`/api/profile/posts/${postId}/like`);

export const addComment = (postId, text) =>
  api.post(`/api/profile/posts/${postId}/comment`, { text });

export const deleteComment = (postId, commentId) =>
  api.delete(`/api/profile/posts/${postId}/comment/${commentId}`);

export const updateAvatar = (formData) =>
  api.patch("/api/profile/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

export const toggleSavePost = (postId) => api.post(`/api/profile/posts/${postId}/save`);

export const getSavedPosts = () => api.get("/api/profile/saved-posts");

export const getTaggedPosts = (userId) => api.get(`/api/profile/${userId}/tagged-posts`);

export const getActivity = () => api.get("/api/profile/activity");
