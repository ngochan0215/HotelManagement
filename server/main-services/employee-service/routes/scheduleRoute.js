import express from "express";
import { ScheduleController } from "../controllers/scheduleController.js";
import { verifyToken, isManager, isEmployee } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const scheduleController = new ScheduleController();

// manager routes
router.get("/", verifyToken, isManager, scheduleController.getAllSchedules);
router.get("/pending-requests", verifyToken, isManager, scheduleController.getPendingScheduleRequests);
router.get("/my", verifyToken, isEmployee, scheduleController.viewMySchedule);
router.get("/available-shifts", verifyToken, isEmployee, scheduleController.getAvailableShifts);

router.get("/:id", verifyToken, isManager, scheduleController.getScheduleById);
router.get("/contracts/:id", verifyToken, isManager, scheduleController.getContractById);
router.patch("/contracts/:id", verifyToken, isManager, scheduleController.updateScheduleContractStatus);

router.post("/", verifyToken, isEmployee, scheduleController.registerSchedule);
router.patch("/:id", verifyToken, isEmployee, scheduleController.updateSchedule);
router.delete("/:id", verifyToken, isEmployee, scheduleController.deleteSchedule);
router.post("/cancel-contract/:id", verifyToken, isEmployee, scheduleController.cancelContract);

export default router;