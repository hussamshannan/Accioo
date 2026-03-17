import api from "./api";

export const getStoryFeed = () => api.get("/api/stories/feed");

export const createStory = (formData) =>
  api.post("/api/stories", formData, { headers: { "Content-Type": "multipart/form-data" } });

export const createTextStory = (data) => api.post("/api/stories", data);

export const markStoryViewed = (storyId) => api.post(`/api/stories/${storyId}/view`);

export const deleteStory = (storyId) => api.delete(`/api/stories/${storyId}`);
