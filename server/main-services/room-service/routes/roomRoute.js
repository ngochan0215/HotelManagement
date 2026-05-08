import express from "express";
import { RoomController } from "../controllers/roomController.js";
import { verifyToken, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new RoomController();

router.get("/", controller.getAllRooms);
router.get("/by-category", controller.getRoomsByCategory);

router.get("/:id", controller.getRoomById);
router.post("/", verifyToken, isManager, controller.createRoom);
router.patch("/:id", verifyToken, isManager, controller.updateRoom);
router.delete("/:id", verifyToken, isManager, controller.deleteRoom);

router.post("/:roomId/cleaning/complete", verifyToken, controller.completeCleaning);
router.post("/:roomId/maintenance/complete", verifyToken, controller.completeMaintenance);

export default router;