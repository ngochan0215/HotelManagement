import express from "express";
import { RoomController } from "../controllers/roomController.js";
import { verifyToken, isManager, isAdmin, isEmployee } from "../../../shared/middleware/authMiddleware.js";
import { uploadRoomImages } from "../utils/uploadImage.js";

const router = express.Router();
const controller = new RoomController();

router.get("/", controller.getAllRoomCategories);
router.get("/available-by", controller.getAvailableRoomCategories);
router.get("/:id", controller.getRoomCategoryById);
router.get("/default-equipments/:id", verifyToken, isEmployee, controller.getDefaultEquipmentsByCategory);

router.post("/", verifyToken, isAdmin, uploadRoomImages.array("images", 10), controller.createRoomCategory);
router.patch("/:id", verifyToken, isAdmin, uploadRoomImages.array("images", 10), controller.updateRoomCategory);
router.delete("/:id", verifyToken, isAdmin, controller.deleteRoomCategory);

export default router;