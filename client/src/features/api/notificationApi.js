import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/notifications`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

export const notificationApi = {
  getAllNotifications: async () => {
    const res = await axios.get(`${BASE_URL}/`, getAuthHeader());
    return res.data;
  },

  markAsRead: async (id) => {
    const res = await axios.patch(`${BASE_URL}/${id}`, {}, getAuthHeader());
    return res.data;
  },

  markAsReadAll: async () => {
    const res = await axios.patch(`${BASE_URL}/`, {}, getAuthHeader());
    return res.data;
  },

  deleteNotification: async (id) => {
    const res = await axios.delete(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  },
};
