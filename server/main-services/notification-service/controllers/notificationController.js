import { container } from "../containers/container.js";

export class NotificationController {
    constructor() {
        this.notificationService = container.notificationService;
    }

    markAsRead = async (req, res) => {
        try {
            await this.notificationService.markAsReadService(req.params.id, req.user.userId);

            return res.status(200).json({
                success: true,
                message: "Notification marked as read",
            });

        } catch (error) {
            res.status(500).json({ message: "Failed to mark read notification: ", error: error.message });
        }
    };

    markAsDeleted = async (req, res) => {
        try {
            await this.notificationService.markAsDeletedService(req.params.id, req.user.userId);
            
            return res.status(200).json({
                success: true,
                message: "Notification marked as deleted",
            });

        } catch (error) {
            res.status(500).json({ message: "Failed to mark deleted notification: ", error: error.message });
        }
    };

    markAsReadAll = async (req, res) => {
        try {
            await this.notificationService.markAsReadAllService(req.user.userId);
            
            return res.status(200).json({
                success: true,
                message: "All notifications marked as read",
            });

        } catch (error) {
            res.status(500).json({ message: "Failed to mark read all notifications: ", error: error.message });
        }
    };

    getMyNotifications = async (req, res) => {
        try {
            const notifications = await this.notificationService.getMyNotificationsService(req.user.userId);
            return res.status(200).json({
                success: true,
                notifications
            });
        } catch (error) {
            res.status(500).json({ message: "Failed to get all notifications: ", error: error.message });
        }
    };

}