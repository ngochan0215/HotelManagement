import API_BASE_URL from "./apiConfig.js";

export const CHAT_SOCKET_URL =
  import.meta.env.VITE_CHAT_SOCKET_URL || API_BASE_URL;

export const CHAT_SOCKET_PATH =
  import.meta.env.VITE_CHAT_SOCKET_PATH || "/chat/socket.io";
