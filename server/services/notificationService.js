import { Notification } from "../models/index.js";
import { getSocketInstance } from "../sockets/instance.js";

export const markAsReadService = async (notificationId, userId) => {
    try {
        const now = new Date();
        await Notification.updateOne(
            { _id: notificationId, user_id: userId },
            { 
                status: "read",
                read_at: now  
            }
        );
        return { success: true };

    } catch (error) {
        console.log("Failed to mark read notification: ", error);
        throw new Error("Failed to mark read notification: " + error.message);
    }
};

export const markAsDeletedService = async (notificationId, userId) => {
    try {
        const now = new Date();
        await Notification.updateMany(
            { _id: notificationId, user_id: userId },
            { 
                status: "deleted",
                deleted_at: now  
            }
        );
        return { success: true };

    } catch (error) {
        console.log("Failed to delete notification: ", error);
        throw new Error("Failed to delete notification: " + error.message);
    }
};

export const markAsReadAllService = async (userId) => {
    try {
        const now = new Date();
        await Notification.updateMany(
            { user_id: userId },
            { 
                status: "read",
                read_at: now  
            }
        );
        return { success: true };

    } catch (error) {
        console.log("Failed to mark read all notifications: ", error);
        throw new Error("Failed to mark read all notifications: " + error.message);
    }
};

export const getMyNotificationsService = async (userId) => {
    try {
        const notifications = await Notification
            .find({ user_id: userId, status: ["read", "unread"] })
            .sort({ created_at: -1 })
            .limit(20);

        return notifications;
    } catch (error) {
        console.log("Failed to get all notifications: ", error);
        throw new Error("Failed to get all notifications: " + error.message);
    }
};

// send notification to a single user
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

        let io;
        try {
            io = getSocketInstance();
        } catch (socketError) {
            console.error("Socket not initialized, notification saved but not sent via socket:", socketError.message);
            // Vẫn trả về notification dù không gửi được qua socket
            return notification;
        }
        
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

// send notification to multiple users
export async function pushNotificationToUsers(userIds, title, content, type, kind, refId, status = "unread") {
    try {
        const notifications = [];
        
        let io;
        try {
            io = getSocketInstance();
        } catch (socketError) {
            console.error("Socket not initialized, notifications saved but not sent via socket:", socketError.message);
            // Vẫn tạo notifications dù không gửi được qua socket
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
            }
            return notifications;
        }

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
