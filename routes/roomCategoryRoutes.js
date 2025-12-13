import express from "express";
import { 
    createRoomCategory, 
    updateRoomCategory, 
    deleteRoomCategory, 
    getAllRoomCategories, 
    getRoomCategoryById,
} from "../controllers/roomCategoryController.js";
import { isManager, verifyToken } from "../middleware/authMiddleware.js";
import uploadRoomImages from "../middleware/uploadImage.js";

const router = express.Router();

// ROOM CATEGORY
router.post("/add", verifyToken, isManager, uploadRoomImages.array("images", 10), createRoomCategory );
router.get("/all", getAllRoomCategories);
router.get("/:id", getRoomCategoryById);
router.put("/:id", verifyToken, isManager, uploadRoomImages.array("images", 10), updateRoomCategory);
router.delete("/:id", verifyToken, isManager, deleteRoomCategory);

export default router;