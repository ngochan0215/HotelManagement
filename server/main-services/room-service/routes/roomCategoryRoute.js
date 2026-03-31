import express from "express";
import { RoomController } from "../controllers/roomController.js";
import { verifyToken, isManager } from "../../../shared/middleware/authMiddleware.js";
import { uploadRoomImages } from "../utils/uploadImage.js";

const router = express.Router();
const controller = new RoomController();

//router.get("/available-by", verifyToken, controller.getAvailableRoomCategories);
router.get("/:category_id/default-equipments", verifyToken, controller.getDefaultEquipmentsByCategory);
router.post("/add", verifyToken, isManager, uploadRoomImages.array("images", 10), controller.createRoomCategory );
router.get("/all", controller.getAllRoomCategories);
router.get("/:id", controller.getRoomCategoryById);
router.put("/:id", verifyToken, isManager, uploadRoomImages.array("images", 10), controller.updateRoomCategory);
router.delete("/:id", verifyToken, isManager, controller.deleteRoomCategory);

export default router;