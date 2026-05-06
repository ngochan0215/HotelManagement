import mongoose from "mongoose";

export class CleaningService {
    constructor({ CleaningTask, eventBus }) {
        this.CleaningTask = CleaningTask;
        this.eventBus = eventBus;
    }

    async assignCleaningTaskService(room_log_id, handled_by) {
        const task = await this.CleaningTask.findOne({ room_log_id });
        if (!task) throw new Error("Không tìm thấy công việc dọn dẹp.");

        task.handled_by = handled_by;
        task.status = "pending";
        await task.save();
        return task;
    }

    async startCleaningTaskService(taskId, userId) {
        const task = await this.CleaningTask.findById(taskId);
        if (!task) throw new Error("Không tìm thấy công việc");

        task.status = "in_progress";
        task.started_at = new Date();
        await task.save();
        return task;
    }

    async completeCleaningTaskService(taskId, userId) {
        const task = await this.CleaningTask.findById(taskId);
        if (!task) throw new Error("Không tìm thấy công việc");

        task.status = "completed";
        task.completed_at = new Date();
        await task.save();
        return task;
    }
}