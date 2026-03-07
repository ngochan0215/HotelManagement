import axios from "axios";

const authAPI = axios.create({
  baseURL: process.env.EMPLOYEE_SERVICE_URL || "http://localhost:3003",
  timeout: 5000
});

export const employeeClient = {
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