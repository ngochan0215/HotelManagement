import { container } from "../containers/container.js";

export class CleaningController {
    constructor() {
        this.cleaningService = container.cleaningService;
    }

    getAvailableHousekeepers = async (req, res) => {
        try {
            const { count, housekeepers } = await this.cleaningService.getAvailableHousekeepers();
            
            return res.status(200).json({
                success: true,
                count,
                housekeepers
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    assignCleaningTask = async (req, res) => {
    try {
        const task = await this.cleaningService.assignCleaningTask(
            req.body.room_log_id,
            req.body.handled_by
        );
        
        return res.status(200).json({ success: true, message: "Gán nhân viên thành công", data: task });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    startCleaningTask = async (req, res) => {
        try {
            const task = await this.cleaningService.startCleaningTask(
                req.params.id,
                req.user?.userId,
            );

            return res.status(200).json({
                success: true,
                data: task,
            });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    completeCleaningTask = async (req, res) => {
        try {
            const task = await this.cleaningService.completeCleaningTaskService(req.params.id, req.user?.userId);

            return res.status(200).json({ success: true, message: "Hoàn thành công việc dọn dẹp. Chờ admin xác nhận.", data: task });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });
        }
    };

    confirmCleaningTask = async (req, res) => {
    try {
        const task = await this.cleaningService.confirmCleaningTask(
            req.params.id,
            req.user?.userId,
        );

        return res.status(200).json({ success: true, message: "Xác nhận hoàn thành công việc dọn dẹp.", data: task });

        } catch (err) {
            return res.status(err.status || 400).json({ message: err.message });        
        }
    };

    getAllTasks = async (req, res) => {
        try {
            const tasks = await this.cleaningService.getAllTasks( req.query );

            return res.status(200).json({ success: true, tasks: tasks });

        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    getCleaningTaskByRoom = async (req, res) => {
        try {
            const { task, room_log_id } = await this.cleaningService.getCleaningTaskByRoomS(req.query);
            
            return res.status(200).json({ success: true, task: task, room_log_id: room_log_id });

        } catch (err) {
            return res.status(err.status || 400).json({ success: false, message: err.message });
        }
    };

    getMyCleaningTasks = async (req, res) => {
        try {
            const tasks = await this.cleaningService.getMyCleaningTasks(req.user?.userId);

            return res.status(200).json({ success: true, tasks: tasks });

        } catch (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
    };
}