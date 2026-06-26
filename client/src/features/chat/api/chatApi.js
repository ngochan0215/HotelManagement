import axios from "axios";
import API_BASE_URL from "../../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/chat`;

const authHeader = () => ({
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
});

export const chatApi = {
    getConversations: async () => {
        const res = await axios.get(`${BASE_URL}/conversations`, authHeader());
        return res.data;
    },

    createConversation: async (body) => {
        const res = await axios.post(`${BASE_URL}/conversations`, body, authHeader());
        return res.data;
    },

    getOrCreateSupportConversation: async () => {
        const res = await axios.post(`${BASE_URL}/conversations`, { type: "support" }, authHeader());
        return res.data;
    },

    getOrCreateBotConversation: async () => {
        const res = await axios.post(`${BASE_URL}/conversations`, { type: "bot" }, authHeader());
        return res.data;
    },

    endConversation: async (conversationId) => {
        const res = await axios.patch(`${BASE_URL}/conversations/${conversationId}/end`, {}, authHeader());
        return res.data;
    },

    getMessages: async (conversationId, page = 1, limit = 50) => {
        const res = await axios.get(
            `${BASE_URL}/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
            authHeader()
        );
        return res.data;
    },

    renameGroup: async (conversationId, name) => {
        const res = await axios.patch(`${BASE_URL}/conversations/${conversationId}`, { name }, authHeader());
        return res.data;
    },
};
