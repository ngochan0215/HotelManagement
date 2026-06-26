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

    getSupportConversations: async () => {
        const res = await axios.get(`${BASE_URL}/conversations`, authHeader());
        const conversations = (res.data?.conversations ?? []).filter((conversation) => conversation?.type === "support");
        return { ...res.data, conversations };
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

    getSupportConversationMessages: async (conversationId, page = 1, limit = 50) => {
        const res = await axios.get(
            `${BASE_URL}/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
            authHeader()
        );
        return res.data;
    },

    sendSupportReply: async ({ socket, conversationId, content, type = "text" }) => {
        if (!socket) {
            throw new Error("Socket chưa sẵn sàng.");
        }
        socket.emit("chat:send_message", {
            conversation_id: conversationId,
            content,
            type,
        });
        return { success: true };
    },

    endSupportConversation: async (conversationId) => {
        const res = await axios.patch(`${BASE_URL}/conversations/${conversationId}/end`, {}, authHeader());
        return res.data;
    },

    getPendingSupportCount: async () => {
        const res = await axios.get(`${BASE_URL}/conversations`, authHeader());
        const conversations = (res.data?.conversations ?? []).filter((conversation) => conversation?.type === "support" && String(conversation?.status || "").toLowerCase() !== "ended");
        const count = conversations.reduce((total, conversation) => {
            const unread = Number(conversation?.unread_count ?? 0);
            return unread > 0 ? total + 1 : total;
        }, 0);
        return { success: true, count, conversations };
    },

    renameGroup: async (conversationId, name) => {
        const res = await axios.patch(`${BASE_URL}/conversations/${conversationId}`, { name }, authHeader());
        return res.data;
    },
};
