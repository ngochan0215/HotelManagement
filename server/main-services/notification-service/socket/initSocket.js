// notification-service/src/socket/initSocket.js
import { Server } from "socket.io";
import { createClient } from "redis";
import { socketAuth } from "../middleware/socketAuth.js";
import { setSocketInstance } from "./instance.js";
import { container } from "../containers/container.js";

const notificationService = container.notificationService;

export async function initSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: { origin: "*", methods: ["GET", "POST"], credentials: true },
    });

    io.use(socketAuth);
    setSocketInstance(io);

    // Redis subscriber
    const subscriber = createClient({ url: process.env.REDIS_URL });
    subscriber.on("error", (err) => console.error("Redis subscriber error:", err));
    await subscriber.connect();
    console.log("Redis subscriber connected");

    await subscriber.subscribe("notifications", async (message) => {
        try {
            const { userIds, ...payload } = JSON.parse(message);
            if (userIds && Array.isArray(userIds)) {
                await notificationService.pushNotificationToUsers({ userIds, ...payload });
            } else {
                await notificationService.pushNotification(payload);
            }
        } catch (err) {
            console.error("Failed to handle notification:", err);
        }
    });

    const userSocketsMap = new Map();

    io.on("connection", (socket) => {
        const { userId, role } = socket.user;
        console.log(`Connected: ${userId} (${socket.id}) as ${role}`);

        if (!userSocketsMap.has(userId)) 
            userSocketsMap.set(userId, new Set());

        userSocketsMap.get(userId).add(socket.id);
        socket.join(`user:${userId}`);

        socket.on("disconnect", () => {
            const set = userSocketsMap.get(userId);
            if (!set) return;
            set.delete(socket.id);
            if (set.size === 0) 
                userSocketsMap.delete(userId);
            
            console.log(`Disconnected: ${userId} (${socket.id})`);
        });
    });

    return io;
}