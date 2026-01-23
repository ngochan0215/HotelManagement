import { Notification } from "../models/index.js";
import { getSocketInstance } from "../sockets/instance.js";

export async function pushNotification(userId, title, content, type, kind, refId, status = "unread") {
    try {
        const notification = await Notification.create({
            user_id: userId,
            title,
            content,
            type,
            reference: { kind, refId },
            status
        });

        const io = getSocketInstance();
        
        io.to(`user:${userId}`).emit("notification", {
            id: notification._id,
            title: notification.title,
            content: notification.content,
            type: notification.type,
            created_at: notification.created_at,
            reference: notification.reference,
        });

        return notification;
    } catch (error) {
        console.error("Error pushing notification:", error);
        throw error;
    }
}

// Gửi thông báo cho nhiều user cùng lúc
export async function pushNotificationToUsers(userIds, title, content, type, kind, refId, status = "unread") {
    try {
        const notifications = [];
        const io = getSocketInstance();

        for (const userId of userIds) {
            const notification = await Notification.create({
                user_id: userId,
                title,
                content,
                type,
                reference: { kind, refId },
                status
            });

            notifications.push(notification);

            io.to(`user:${userId}`).emit("notification", {
                id: notification._id,
                title: notification.title,
                content: notification.content,
                type: notification.type,
                created_at: notification.created_at,
                reference: notification.reference,
            });
        }

        return notifications;
    } catch (error) {
        console.error("Error pushing notifications to users:", error);
        throw error;
    }
}
