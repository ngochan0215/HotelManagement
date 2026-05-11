import express from "express";
import { RoomController } from "../controllers/roomController.js";
import { verifyToken, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new RoomController();

router.get("/status-summary", verifyToken, isManager, controller.getRoomStatusSummary);
router.get("/top-booked", verifyToken, isManager, controller.getTopBookedRoomCategories);
router.get("/latest-status", verifyToken, controller.getLatestStatusOfAllRooms);

export default router;