import express from "express";
import { RoomController } from "../controllers/roomController.js";
import { verifyToken, isManager, isNotCustomer } from "../../../shared/middleware/authMiddleware.js";
import { uploadRoomImages } from "../utils/uploadImage.js";

const router = express.Router();
const controller = new RoomController();

router.get("/available-by", controller.getAvailableRoomCategories);
router.get("/", controller.getAllRoomCategories);
router.get("/:id", controller.getRoomCategoryById);
router.get("/default-equipments/:id", verifyToken, isNotCustomer, controller.getDefaultEquipmentsByCategory);

router.post("/", verifyToken, isManager, uploadRoomImages.array("images", 10), controller.createRoomCategory);
router.patch("/:id", verifyToken, isManager, uploadRoomImages.array("images", 10), controller.updateRoomCategory);
router.delete("/:id", verifyToken, isManager, controller.deleteRoomCategory);

export default router;