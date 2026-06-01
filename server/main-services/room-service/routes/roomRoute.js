import express from "express";
import { RoomController } from "../controllers/roomController.js";
import { verifyToken, isManager, isAdmin, isEmployee } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new RoomController();

router.get("/", controller.getAllRooms);
router.get("/by-category", controller.getRoomsByCategory);

router.get("/:id/equipments", verifyToken, isEmployee, controller.getRoomEquipments);
router.get("/:id", controller.getRoomById);
router.post("/", verifyToken, isAdmin, controller.createRoom);
router.patch("/:id", verifyToken, isManager, controller.updateRoom);
router.delete("/:id", verifyToken, isAdmin, controller.deleteRoom);

router.post("/:id/cleaning/complete", verifyToken, isEmployee, controller.completeCleaning);
router.post("/:id/maintenance/complete", verifyToken, isEmployee, controller.completeMaintenance);

export default router;