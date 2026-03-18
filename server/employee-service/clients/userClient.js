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

    getUserByEmail: async (email) => {
        const res = await authAPI.get(`/get-email/${email}`);
        return res.data;
    },

    updateUser: async (id, payload) => {
        const res = await authAPI.patch(`/update-user/${id}`, payload);
        return res.data;
    },

    createUserAccount: async(payload) => {
        const res = await authAPI.post(`/create-account`, payload);
        return res.data.user;
    },

    adminResetPassword: async(payload) => {
        const res = await authAPI.patch(`/admin-reset-pass`, payload);
        return res.data;
    },

    deleteUser: async(id) => {
        const res = await authAPI.delete(`/delete-user/${id}`);
        return res.data;
    }
};