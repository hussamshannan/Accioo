import api from "./api";

// Conversations
export const getConversations = (archived = false) =>
  api.get("/api/conversations", { params: archived ? { archived: "true" } : {} });

export const createConversation = (data) => api.post("/api/conversations", data);

export const getConversation = (id) => api.get(`/api/conversations/${id}`);

export const getMessages = (conversationId, page = 1, limit = 40) =>
  api.get(`/api/conversations/${conversationId}/messages`, {
    params: { page, limit },
  });

// Message operations (via REST for persistence, socket for real-time)
export const updateReactions = (messageId, reactions) =>
  api.patch(`/api/messages/${messageId}/react`, { reactions });

export const editMessageApi = (messageId, text) =>
  api.patch(`/api/messages/${messageId}/edit`, { text });

export const markMessageRead = (messageId) =>
  api.post(`/api/messages/${messageId}/read`);

export const sharePostToConversation = (conversationId, imageUrl, text = "", postId = null) =>
  api.post(`/api/conversations/${conversationId}/share-post`, { imageUrl, text, postId });

export const sendMessageToConversation = (conversationId, text) =>
  api.post(`/api/conversations/${conversationId}/message`, { text });

export const deleteConversation = (conversationId, forEveryone = false) =>
  api.delete(`/api/conversations/${conversationId}`, { data: { forEveryone } });

export const updateConversationSettings = (conversationId, action) =>
  api.patch(`/api/conversations/${conversationId}/settings`, { action });

export const markConversationRead = (conversationId) =>
  api.post(`/api/conversations/${conversationId}/read`);

export const forwardMessageToConversation = (conversationId, messageId) =>
  api.post(`/api/conversations/${conversationId}/forward`, { messageId });

export const getLinkPreview = (url) =>
  api.get("/api/messages/link-preview", { params: { url } });
