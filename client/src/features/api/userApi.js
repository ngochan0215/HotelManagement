import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/user`;

export const userApi = {
  getProfile: async () => {
    const res = await axios.get(`${BASE_URL}/profile/view`, getAuthHeader());
    return res.data;
  },

  updateProfile: async (data) => {
    const res = await axios.patch(`${BASE_URL}/profile/update`, data, getAuthHeader());
    return res.data;
  },

  changePassword: async (data) => {
    const res = await axios.patch(`${BASE_URL}/change-password`, data, getAuthHeader());
    return res.data;
  },

  updateAvatar: async (formData) => {
    const token = localStorage.getItem("token");
    const res = await axios.put(`${BASE_URL}/update-avatar`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },
};