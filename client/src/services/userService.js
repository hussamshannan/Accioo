import api from "./api";

export const searchUsers = (q) => api.get(`/api/users/search?q=${encodeURIComponent(q)}`);

export const getUserProfile = (userId) => api.get(`/api/users/${userId}`);

export const getMe = () => api.get("/api/users/me");

export const updateProfile = (data) => api.patch("/api/users/me", data);

export const updateTheme = (data) => api.patch("/api/users/me/theme", data);

export const getFriends = () => api.get("/api/friends");

export const getFriendRequests = () => api.get("/api/friends/requests");

export const sendFriendRequest = (userId) => api.post(`/api/friends/request/${userId}`);

export const acceptFriendRequest = (requestId) =>
  api.patch(`/api/friends/request/${requestId}/accept`);

export const rejectFriendRequest = (requestId) =>
  api.patch(`/api/friends/request/${requestId}/reject`);

export const cancelFriendRequest = (requestId) =>
  api.delete(`/api/friends/request/${requestId}`);

export const removeFriend = (userId) => api.delete(`/api/friends/${userId}`);
