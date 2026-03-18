import axios from "axios";

const authAPI = axios.create({
  baseURL: process.env.AUTH_SERVICE_URL || "http://auth-service:3001",
  timeout: 5000
});

export const userClient = {
  getUserById: async (id) => {
    const res = await authAPI.get(`/get-user/${id}`);
    return res.data;
  },
};