import express from "express";
import { RoomController } from "../controllers/roomController.js";
import { verifyToken, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new RoomController();

router.get("/all", controller.getAllRooms);
router.get("/by-category", controller.getRoomsByCategory);

router.get("/statistic/status", verifyToken, isManager, controller.getRoomStatusSummary);
router.get("/statistic/top-booked", verifyToken, isManager, controller.getTopBookedRoomCategories);
router.get("/status/latest", verifyToken, controller.getLatestStatusOfAllRooms);

router.get("/:id", controller.getRoomById);
router.post("/add", verifyToken, isManager, controller.createRoom);
router.put("/:id", verifyToken, isManager, controller.updateRoom);
router.delete("/:id", verifyToken, isManager, controller.deleteRoom);

router.post("/:roomId/cleaning/complete", verifyToken, controller.completeCleaning);
router.post("/:roomId/maintenance/complete", verifyToken, controller.completeMaintenance);

//router.get("/:id/equipments", verifyToken, controller.getRoomEquipments);

export default router;