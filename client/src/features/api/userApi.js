import axios from "axios";
import { jwtDecode } from "jwt-decode";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const USERS_BASE = `${API_BASE_URL}/users`;
const EMPLOYEES_BASE = `${API_BASE_URL}/employees`;
const AUTH_BASE = `${API_BASE_URL}/auth`;

export const userApi = {
  getProfile: async () => {
    const token = localStorage.getItem("token");
    const decoded = jwtDecode(token);
    const userId = decoded.userId || decoded._id || decoded.id;
    const res = await axios.get(`${EMPLOYEES_BASE}/my-profile`, getAuthHeader());

    const profile = res.data;
    return profile;
  },

  getAllUsers: async (params = {}) => {
    const res = await axios.get(USERS_BASE, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

  getUserProfile: async (userId) => {
    const res = await axios.get(`${USERS_BASE}/profile/${userId}`, getAuthHeader());
    return res.data;
  },

  adminResetPassword: async ({ userId, newPassword }) => {
    const res = await axios.patch(
      `${AUTH_BASE}/admin-reset-pass`,
      { userId, newPassword },
      getAuthHeader()
    );
    return res.data;
  },

  updateProfile: async (data) => {
      const payload = {};
      if (data.phone != null) payload.phone_number = data.phone;
      if (data.dob != null) payload.date_birth = data.dob;
      if (data.bank_shortName != null) payload.bank_shortName = data.bank_shortName;
      if (data.account_number != null) payload.account_number = data.account_number;
      const res = await axios.patch(`${EMPLOYEES_BASE}/my-profile`, payload, getAuthHeader());
      return res.data;
  },

  changePassword: async (data) => {
    const res = await axios.patch(`${USERS_BASE}/change-password`, data, getAuthHeader());
    return res.data;
  },

  sendChangeEmailOtp: async (newEmail) => {
    const res = await axios.post(`${USERS_BASE}/change-email/send-otp`, { newEmail }, getAuthHeader());
    return res.data;
  },

  verifyChangeEmail: async (otp) => {
    const res = await axios.post(`${USERS_BASE}/change-email/verify-otp`, { otp }, getAuthHeader());
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
