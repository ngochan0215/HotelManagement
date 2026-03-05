import { Notification } from "../models/index.js";
import * as notificationService from "../services/notificationService.js";

export const markAsRead = async (req, res) => {
    try {
        await notificationService.markAsReadService(req.params.id, req.user.userId);
        
        return res.status(200).json({
            success: true,
            message: "Notification marked as read",
        });

    } catch (error) {
        res.status(500).json({ message: "Failed to mark read notification: ", error: error.message });
    }
};

export const markAsDeleted = async (req, res) => {
    try {
        await notificationService.markAsDeletedService(req.params.id, req.user.userId);
        
        return res.status(200).json({
            success: true,
            message: "Notification marked as deleted",
        });

    } catch (error) {
        res.status(500).json({ message: "Failed to mark deleted notification: ", error: error.message });
    }
};

export const markAsReadAll = async (req, res) => {
    try {
        await notificationService.markAsReadAllService(req.user.userId);
        
        return res.status(200).json({
            success: true,
            message: "All notifications marked as read",
        });

    } catch (error) {
        res.status(500).json({ message: "Failed to mark read all notifications: ", error: error.message });
    }
};

export const getMyNotifications = async (req, res) => {
    try {
        const notifications = await notificationService.getMyNotificationsService(req.user.userId);
        return res.status(200).json({
            success: true,
            notifications
        });
    } catch (error) {
        res.status(500).json({ message: "Failed to get all notifications: ", error: error.message });
    }
};

