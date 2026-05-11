import { container } from "../containers/container.js";

export class CleaningController {
    constructor() {
        this.cleaningService = container.cleaningService;
    }

    getAvailableHousekeepers = async (req, res) => {
        try {
            const data = await this.cleaningService.getAvailableHousekeepersService();
            res.status(200).json({ success: true, ...data });
        } catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    };

    assignCleaningTask = async (req, res) => {
        try {
            const task = await this.cleaningService.assignCleaningTaskService(
                req.body.room_log_id,
                req.body.handled_by
            );
            res.status(200).json({ success: true, message: "Gán nhân viên thành công", data: task });
        } catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    };

    startCleaningTask = async (req, res) => {
        try {
            const task = await this.cleaningService.startCleaningTaskService(
                req.params.id,
                req.user?.userId
            );
            res.status(200).json({ success: true, data: task });
        } catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    };

    completeCleaningTask = async (req, res) => {
        try {
            const task = await this.cleaningService.completeCleaningTaskService(
                req.params.id,
                req.user?.userId
            );
            res.status(200).json({ success: true, message: "Hoàn thành công việc dọn dẹp", data: task });
        } catch (err) {
            res.status(400).json({ success: false, message: err.message });
        }
    };
}