
export class NotificationService {
    constructor({ Notification, getSocketInstance }) {
        this.Notification = Notification;
        this.getSocketInstance = getSocketInstance;
    }

    markAsReadService = async (notificationId, userId) => {
        try {
            const now = new Date();
            await this.Notification.updateOne(
                { _id: notificationId, user_id: userId },
                { 
                    status: "read",
                    read_at: now  
                }
            );
            return { success: true };

        } catch (error) {
            console.log("Failed to mark read notification: ", error);
            throw error;
        }
    };

    markAsDeletedService = async (notificationId, userId) => {
        try {
            const now = new Date();
            await this.Notification.updateMany(
                { _id: notificationId, user_id: userId },
                { 
                    status: "deleted",
                    deleted_at: now  
                }
            );
            return { success: true };

        } catch (error) {
            console.log("Failed to delete notification: ", error);
            throw error;
        }
    };

    markAsReadAllService = async (userId) => {
        try {
            const now = new Date();
            await this.Notification.updateMany(
                { user_id: userId },
                { 
                    status: "read",
                    read_at: now  
                }
            );
            return { success: true };

        } catch (error) {
            console.log("Failed to mark read all notifications: ", error);
            throw error;
        }
    };

    getMyNotificationsService = async (userId) => {
        try {
            const notifications = await this.Notification
                .find({ user_id: userId, status: ["read", "unread"] })
                .sort({ created_at: -1 })
                .limit(20);

            return notifications;
        } catch (error) {
            console.log("Failed to get all notifications: ", error);
            throw error;
        }
    };

    // send notification to a single user
    pushNotification = async ({ userId, title, content, type, kind, refId, status = "unread" }) => {
        try {
            const notification = await this.Notification.create({
                user_id: userId,
                title,
                content,
                type,
                reference: { kind, refId },
                status
            });

            this.#emitToUser(userId, notification);

            return notification;

        } catch (error) {
            console.error("Error pushing notification:", error);
            throw error;
        }
    }

    // send notification to multiple users
    pushNotificationToUsers = async ({ userIds, title, content, type, kind, refId, status = "unread" }) => {
        try {
            const docs = userIds.map((userId) => ({
                user_id: userId,
                title,
                content,
                type,
                reference: { kind, refId },
                status,
            }));

            const notifications = await this.Notification.insertMany(docs);

            notifications.forEach((notification) => {
                this.#emitToUser(notification.user_id, notification);
            });

            return notifications;

        } catch (error) {
            console.error("Error pushing notifications to users:", error);
            throw error;
        }
    }

    // emit socket, không throw nếu socket chưa init
    #emitToUser(userId, notification) {
        try {
            const io = this.getSocketInstance();
            io.to(`user:${userId}`).emit("notification", {
                id: notification._id,
                title: notification.title,
                content: notification.content,
                type: notification.type,
                reference: notification.reference,
                created_at: notification.created_at,
            });
        } catch (socketErr) {
            console.warn(`Socket emit failed for user ${userId}:`, socketErr.message);
        }
    }
}


