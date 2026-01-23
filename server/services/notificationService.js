import { Notification } from "../models/index.js";
import { getSocketInstance } from "../sockets/instance.js";

export async function pushNotification(userId, title, content, type, kind, refId, status) {
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
        created_at: notification.create_at,
        reference: notification.reference,
    });

    return notification;
}
