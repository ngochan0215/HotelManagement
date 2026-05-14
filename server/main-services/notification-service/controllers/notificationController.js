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

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    markAsDeleted = async (req, res) => {
        try {
            await this.notificationService.markAsDeletedService(req.params.id, req.user.userId);
            
            return res.status(200).json({
                success: true,
                message: "Notification marked as deleted",
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    markAsReadAll = async (req, res) => {
        try {
            await this.notificationService.markAsReadAllService(req.user.userId);
            
            return res.status(200).json({
                success: true,
                message: "All notifications marked as read",
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    getMyNotifications = async (req, res) => {
        try {
            const notifications = await this.notificationService.getMyNotificationsService(req.user.userId);
            return res.status(200).json({
                success: true,
                notifications
            });
        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

}