import express from "express";
import { 
    createRoomCategory, 
    updateRoomCategory, 
    deleteRoomCategory, 
    getAllRoomCategories, 
    getRoomCategoryById,
    createRoom,
    getAllRooms,
    getRoomById,
    updateRoom,
    deleteRoom,
    getRoomsByCategory
} from "../controllers/roomController.js";
import { isManager, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

// ROOM CATEGORY
router.post("/category/add", verifyToken, isManager, createRoomCategory);
router.get("/category/all", getAllRoomCategories);
router.get("/category/:id", getRoomCategoryById);
router.put("/category/:id", verifyToken, isManager, updateRoomCategory);
router.delete("/category/:id", verifyToken, isManager, deleteRoomCategory);

// ROOM
router.post("/add", verifyToken, isManager, createRoom);
router.get("/all", getAllRooms);
router.get("/by-category", getRoomsByCategory);
router.get("/:id", getRoomById);
router.put("/:id", verifyToken, isManager, updateRoom);
router.delete("/:id", verifyToken, isManager, deleteRoom);

export default router;