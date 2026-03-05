import * as cleaningService from "../services/cleaningTaskService.js";

export const getAvailableHousekeepers = async (req, res) => {
  try {
    const { count, housekeepers } = await cleaningService.getAvailableHousekeepersService();
    res.status(200).json({
      success: true,
      count,
      housekeepers
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

export const assignCleaningTask = async (req, res) => {
  try {
    const task = await cleaningService.assignCleaningTaskService({
        room_log_id: req.body.room_log_id,
        handled_by: req.body.handled_by
    });
    res.status(200).json({ success: true, message: "Gán nhân viên thành công", data: task });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const startCleaningTask = async (req, res) => {
  try {
    const task = await cleaningService.startCleaningTaskService({
      taskId: req.params.id,
      userId: req.user?.userId,
    });

    res.status(200).json({
      success: true,
      data: task,
    });
  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    });
  }
};

export const completeCleaningTask = async (req, res) => {
  try {
    const task = await cleaningService.completeCleaningTaskService(req.params.id, req.user?.userId);

    res.status(200).json({ success: true, message: "Hoàn thành công việc dọn dẹp. Chờ admin xác nhận.", data: task });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const confirmCleaningTask = async (req, res) => {
  try {
    const task = await cleaningService.confirmCleaningTaskService({
        taskId: req.params.id,
        userId: req.user?.userId,
    });

    res.status(200).json({ success: true, message: "Xác nhận hoàn thành công việc dọn dẹp.", data: task });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const getAllTasks = async (req, res) => {
  try {
    const tasks = await cleaningService.getAllTasksService( req.query );

    res.status(200).json({ success: true, tasks: tasks });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const getCleaningTaskByRoom = async (req, res) => {
  try {
    const { task, room_log_id } = await cleaningService.getCleaningTaskByRoomService(req.query);
    
    res.status(200).json({ success: true, task: task, room_log_id: room_log_id });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};

export const getMyCleaningTasks = async (req, res) => {
  try {
    const tasks = await cleaningService.getMyCleaningTasksService(req.user?.userId);

    res.status(200).json({ success: true, tasks: tasks });

    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
};