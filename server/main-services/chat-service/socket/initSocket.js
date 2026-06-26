import { Server } from "socket.io";
import { socketAuth } from "./socketAuth.js";
import { setSocketInstance } from "./instance.js";
import { BOT_USER_ID, BOT_NAME } from "../config/botConfig.js";

async function handleBotReply(io, conversationId, chatService, botService, userMessage, caller) {
    io.to(`conv:${conversationId}`).emit("chat:typing", {
        conversation_id: conversationId,
        user_id: BOT_USER_ID,
        user_name: BOT_NAME,
    });

    try {
        // Fetch last 21 messages, drop the final one (user's just-sent message) as it becomes the current turn
        const allMessages = await chatService.getMessages(conversationId, BOT_USER_ID, 1, 21);
        const history = allMessages.slice(0, -1);

        // caller identity (role + JWT) lets the bot act-as-user for staff tools
        const replyText = await botService.generateReply(history, userMessage, caller);

        const botSnapshot = { user_id: BOT_USER_ID, name: BOT_NAME, avatar: null, role: "bot" };
        const { message: botMessage } = await chatService.sendMessage(conversationId, botSnapshot, replyText);

        io.to(`conv:${conversationId}`).emit("chat:stop_typing", {
            conversation_id: conversationId,
            user_id: BOT_USER_ID,
        });

        io.to(`conv:${conversationId}`).emit("chat:new_message", {
            conversation_id: conversationId,
            message: botMessage,
        });
    } catch (err) {
        io.to(`conv:${conversationId}`).emit("chat:stop_typing", {
            conversation_id: conversationId,
            user_id: BOT_USER_ID,
        });
        console.error("[handleBotReply] Error:", err.message);
    }
}

export async function initSocket(httpServer, chatService, botService) {
    const io = new Server(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    });

    io.use(socketAuth);
    setSocketInstance(io);

    // userId → Set of socket IDs (user may have multiple tabs open)
    const onlineUsers = new Map();

    io.on("connection", async (socket) => {
        const { userId, role, position } = socket.user;
        console.log(`[CHAT] Connected: ${userId} (${socket.id}) as ${role}`);
        const isSupportInboxUser = chatService.isSupportInboxUser({ role, position });

        // Keep the bare JWT so the bot can act-as-user when calling protected staff endpoints.
        const rawToken = socket.handshake?.auth?.token || "";
        socket.authToken = rawToken.startsWith("Bearer ") ? rawToken.slice(7) : rawToken;

        if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
        const wasOffline = onlineUsers.get(userId).size === 0;
        onlineUsers.get(userId).add(socket.id);

        socket.join(`user:${userId}`);

        // Fetch and cache user display info for message snapshots.
        // Best-effort only: socket connection must not fail if the DB/event bus is slow.
        let userInfo = null;
        try {
            userInfo = await chatService.getUserInfo(userId);
        } catch (err) {
            console.warn("[CHAT] getUserInfo failed during socket connect:", err.message);
        }

        socket.userSnapshot = {
            user_id: userId,
            name: userInfo?.email ?? userId,
            avatar: userInfo?.avatar ?? null,
            role,
            position: position ?? null,
        };

        // Join all conversation rooms, but never crash the socket if the query fails.
        try {
            const convIds = await chatService.getConversationIds(userId, { role, position });
            convIds.forEach(id => socket.join(`conv:${id}`));
        } catch (err) {
            console.warn("[CHAT] getConversationIds failed during socket connect:", err.message);
        }

        // Broadcast online status to everyone if this is the user's first connection
        if (wasOffline) {
            socket.broadcast.emit("chat:user_online", { user_id: userId });
        }

        if (isSupportInboxUser) {
            socket.join("support:inbox");
        }

        // Send messages
        socket.on("chat:send_message", async ({ conversation_id, content, type = "text" }) => {
            try {
                if (!conversation_id || !content?.trim()) return;

                const { message, conversationType } = await chatService.sendMessage(
                    conversation_id,
                    socket.userSnapshot,
                    content,
                    type
                );

                io.to(`conv:${conversation_id}`).emit("chat:new_message", {
                    conversation_id,
                    message,
                });

                if (conversationType === "support") {
                    io.to("support:inbox").emit("chat:support_inbox_message", {
                        conversation_id,
                        message,
                    });
                }

                // Trigger bot reply asynchronously — fire and forget
                if (conversationType === "bot") {
                    const caller = { userId, role, token: socket.authToken };
                    handleBotReply(io, conversation_id, chatService, botService, content, caller).catch(err =>
                        console.error("[BotReply] Unhandled error:", err.message)
                    );
                }
            } catch (err) {
                socket.emit("chat:error", { message: err.message });
            }
        });

        // Typing indicators
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
                const read_at = await chatService.markAsRead(conversation_id, userId, { role, position });
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
        socket.on("chat:join_conversation", ({ conversation_id }) => {
            if (!conversation_id) return;
            socket.join(`conv:${conversation_id}`);
        });

        socket.on("chat:leave_conversation", ({ conversation_id }) => {
            if (!conversation_id) return;
            socket.leave(`conv:${conversation_id}`);
        });

        // Delete a message
        socket.on("chat:delete_message", async ({ conversation_id, message_id }) => {
            try {
                if (!conversation_id || !message_id) return;
                await chatService.deleteMessage(message_id, conversation_id, userId, { role, position });
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
                const message = await chatService.editMessage(message_id, conversation_id, userId, content, { role, position });
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
