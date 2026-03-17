import axios from "axios";
import { API_URL } from "../utils/constants";

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
});

// Clerk token interceptor — will be attached after Clerk loads
let getTokenFn = null;

export const setTokenGetter = (fn) => {
  getTokenFn = fn;
};

api.interceptors.request.use(async (config) => {
  if (getTokenFn) {
    try {
      const token = await getTokenFn();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Token retrieval failed — proceed without auth
    }
  }
  return config;
});

export default api;
