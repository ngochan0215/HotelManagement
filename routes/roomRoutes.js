import express from "express";
import { 
    createRoom,
    getAllRooms,
    getRoomById,
    updateRoom,
    deleteRoom,
    getRoomsByCategory
} from "../controllers/roomController.js";
import { isManager, verifyToken } from "../middleware/authMiddleware.js";
import uploadRoomImages from "../middleware/uploadImage.js";

const router = express.Router();

router.post("/add", verifyToken, isManager, createRoom);
router.get("/all", getAllRooms);
router.get("/by-category", getRoomsByCategory);
router.get("/:id", getRoomById);
router.put("/:id", verifyToken, isManager, updateRoom);
router.delete("/:id", verifyToken, isManager, deleteRoom);

export default router;