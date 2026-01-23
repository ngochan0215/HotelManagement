import { Notification } from "../models/index.js";

export const markAsRead = async (req, res) => {
    try {
        const now = new Date();
        await Notification.updateOne(
            { _id: req.params.id, user_id: req.userId },
            { 
                status: "read",
                read_at: now  
            }
        );
        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ message: "Failed to mark read notification: ", error: error.message });
    }
};

export const markAsDeleted = async (req, res) => {
    try {
        const now = new Date();
        await Notification.updateMany(
            { _id: req.params.id, user_id: req.userId },
            { 
                status: "deleted",
                deleted_at: now  
            }
        );
        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ message: "Failed to delete notification:", error: error.message });
    }
};

export const markAsReadAll = async (req, res) => {
    try {
        const now = new Date();
        await Notification.updateMany(
            { user_id: req.userId },
            { 
                status: "read",
                read_at: now  
            }
        );
        res.json({ success: true });

    } catch (error) {
        res.status(500).json({ message: "Failed to mark read all notifications:", error: error.message });
    }
};

export const getMyNotifications = async (req, res) => {
    try {
        const userId = req.userId;

        const notifications = await Notification
            .find({ user_id: userId, status: ["read", "unread"] })
            .sort({ created_at: -1 })
            .limit(20);

        res.json(notifications);
    } catch (error) {
        res.status(500).json({ message: "Failed to get all notifications: ", error: error.message });
    }
};

