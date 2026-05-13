import express from "express";
import { CleaningController } from "../controllers/cleaningController.js";
import { verifyToken, isManager, isEmployee } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new CleaningController();

router.get("/available-housekeepers", verifyToken, isManager, controller.getAvailableHousekeepers);
router.get("/", verifyToken, isManager, controller.getAllTasks);
router.get("/by-room", verifyToken, isEmployee, controller.getCleaningTaskByRoom);

router.post("/assign", verifyToken, isManager, controller.assignCleaningTask);
router.get("/my-tasks", verifyToken, isEmployee, controller.getMyCleaningTasks);
router.post("/:id/start", verifyToken, isEmployee, controller.startCleaningTask);
router.post("/:id/complete", verifyToken, isEmployee, controller.completeCleaningTask);
router.post("/:id/confirm", verifyToken, isManager, controller.confirmCleaningTask);

export default router;