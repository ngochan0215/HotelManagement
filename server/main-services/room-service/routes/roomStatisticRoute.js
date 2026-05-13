import express from "express";
import { RoomController } from "../controllers/roomController.js";
import { verifyToken, isManager, isEmployee } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new RoomController();

router.get("/status-summary", verifyToken, isManager, controller.getRoomStatusSummary);
router.get("/top-booked", verifyToken, isManager, controller.getTopBookedRoomCategories);
router.get("/latest-status", verifyToken, controller.getLatestStatusOfAllRooms);
router.get("/calendar", verifyToken, isEmployee, controller.getCalendarRooms);

router.get("/reports/json", verifyToken, isManager, controller.generateRoomReport);
router.get("/reports/excel", verifyToken, isManager, controller.exportRoomReportExcel);
router.get("/reports/pdf", verifyToken, isManager, controller.exportRoomReportPDF); 

export default router;