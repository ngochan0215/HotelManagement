import { Server } from "socket.io";
import { socketAuth } from "./socketAuth.js";
import { setSocketInstance } from "./instance.js";

export async function initSocket(httpServer, chatService) {
    const io = new Server(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    });

    io.use(socketAuth);
    setSocketInstance(io);

    // userId → Set of socket IDs (user may have multiple tabs open)
    const onlineUsers = new Map();

    io.on("connection", async (socket) => {
        const { userId, role } = socket.user;
        console.log(`[CHAT] Connected: ${userId} (${socket.id}) as ${role}`);

        if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
        const wasOffline = onlineUsers.get(userId).size === 0;
        onlineUsers.get(userId).add(socket.id);

        socket.join(`user:${userId}`);

        // Fetch and cache user display info for message snapshots
        const userInfo = await chatService.getUserInfo(userId);
        socket.userSnapshot = {
            user_id: userId,
            name: userInfo?.email ?? userId,   // use email as display name
            avatar: userInfo?.avatar ?? null,
            role,
        };

        // Join all conversation rooms
        const convIds = await chatService.getConversationIds(userId);
        convIds.forEach(id => socket.join(`conv:${id}`));

        // Broadcast online status to everyone if this is the user's first connection
        if (wasOffline) {
            socket.broadcast.emit("chat:user_online", { user_id: userId });
        }

        // send messages
        socket.on("chat:send_message", async ({ conversation_id, content, type = "text" }) => {
            try {
                if (!conversation_id || !content?.trim()) return;

                const message = await chatService.sendMessage(
                    conversation_id,
                    socket.userSnapshot,
                    content,
                    type
                );

                io.to(`conv:${conversation_id}`).emit("chat:new_message", {
                    conversation_id,
                    message,
                });
            } catch (err) {
                socket.emit("chat:error", { message: err.message });
            }
        });

        // typing indicators
        socket.on("chat:typing", ({ conversation_id }) => {
            if (!conversation_id) return;
            socket.to(`conv:${conversation_id}`).emit("chat:typing", {
                conversation_id,
                user_id: userId,
                user_name: socket.userSnapshot.name,
            });
        });

        socket.on("chat:stop_typing", ({ conversation_id }) => {
            if (!conversation_id) return;
            socket.to(`conv:${conversation_id}`).emit("chat:stop_typing", {
                conversation_id,
                user_id: userId,
            });
        });

        // Read receipts
        socket.on("chat:mark_read", async ({ conversation_id }) => {
            try {
                if (!conversation_id) return;
                const read_at = await chatService.markAsRead(conversation_id, userId);
                socket.to(`conv:${conversation_id}`).emit("chat:read_receipt", {
                    conversation_id,
                    user_id: userId,
                    read_at,
                });
            } catch (err) {
                socket.emit("chat:error", { message: err.message });
            }
        });

        // Join a newly created conversation room
        // Called after POST /conversations so the socket is immediately in the room
        socket.on("chat:join_conversation", ({ conversation_id }) => {
            if (!conversation_id) return;
            socket.join(`conv:${conversation_id}`);
        });

        // Delete a message
        socket.on("chat:delete_message", async ({ conversation_id, message_id }) => {
            try {
                if (!conversation_id || !message_id) return;
                await chatService.deleteMessage(message_id, conversation_id, userId);
                io.to(`conv:${conversation_id}`).emit("chat:message_deleted", {
                    conversation_id,
                    message_id,
                });
            } catch (err) {
                socket.emit("chat:error", { message: err.message });
            }
        });

        // Edit a message
        socket.on("chat:edit_message", async ({ conversation_id, message_id, content }) => {
            try {
                if (!conversation_id || !message_id || !content?.trim()) return;
                const message = await chatService.editMessage(message_id, conversation_id, userId, content);
                io.to(`conv:${conversation_id}`).emit("chat:message_updated", {
                    conversation_id,
                    message,
                });
            } catch (err) {
                socket.emit("chat:error", { message: err.message });
            }
        });

        // Disconnect
        socket.on("disconnect", () => {
            const sockets = onlineUsers.get(userId);
            if (sockets) {
                sockets.delete(socket.id);
                if (sockets.size === 0) {
                    onlineUsers.delete(userId);
                    io.emit("chat:user_offline", { user_id: userId });
                }
            }
            console.log(`[CHAT] Disconnected: ${userId} (${socket.id})`);
        });
    });

    return io;
}
