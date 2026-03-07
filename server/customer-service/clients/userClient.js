import axios from "axios";

const authAPI = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL || "http://localhost:3001",
  timeout: 5000
});

export const userClient = {
  getUserById: async (id) => {
    const res = await authAPI.get(`/get-user/${id}`);
    return res.data;
  },

  getUserByEmail: async (email) => {
    const res = await authAPI.get(`/get-email/${email}`);
    return res.data;
  },

  updateUser: async (id, payload) => {
    const res = await authAPI.patch(`/update-user/${id}`, payload);
    return res.data;
  }
};