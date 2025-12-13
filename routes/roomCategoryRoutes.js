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
router.post("/category/add", verifyToken, isManager, uploadRoomImages.array("images", 10), createRoomCategory );
router.get("/category/all", getAllRoomCategories);
router.get("/category/:id", getRoomCategoryById);
router.put("/category/:id", verifyToken, isManager, uploadRoomImages.array("images", 10), updateRoomCategory);
router.delete("/category/:id", verifyToken, isManager, deleteRoomCategory);

export default router;