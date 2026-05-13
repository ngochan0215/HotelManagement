import axios from "axios";
import { jwtDecode } from "jwt-decode";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const USERS_BASE = `${API_BASE_URL}/users`;
const EMPLOYEES_BASE = `${API_BASE_URL}/employees`;

export const userApi = {
  getProfile: async () => {
    const token = localStorage.getItem("token");
    const decoded = jwtDecode(token);
    const userId = decoded.userId || decoded._id || decoded.id;
    const res = await axios.get(`${USERS_BASE}/profile/${userId}`, getAuthHeader());
    const profile = res.data.userProfile;
    return { data: profile };
  },

  updateProfile: async (data) => {
      const my = await axios.get(`${EMPLOYEES_BASE}/my-profile`, getAuthHeader());
      const emp = my.data;
      const id = emp._id;
      const payload = {};
      if (data.phone != null) payload.phone_number = data.phone;
      if (data.dob != null) payload.date_birth = data.dob;
      const res = await axios.patch(`${EMPLOYEES_BASE}/${id}`, payload, getAuthHeader());
      return res.data;
  },

  changePassword: async (data) => {
    const res = await axios.patch(`${USERS_BASE}/change-password`, data, getAuthHeader());
    return res.data;
  },

  updateAvatar: async (formData) => {
    const token = localStorage.getItem("token");
    const res = await axios.put(`${USERS_BASE}/update-avatar`, formData, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },
};
