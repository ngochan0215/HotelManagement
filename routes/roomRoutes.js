import express from "express";
import { 
    createRoom,
    getAllRooms,
    getRoomById,
    updateRoom,
    deleteRoom,
    getRoomsByCategory,
    getRoomStatusSummary,
    getTopBookedRoomCategories
} from "../controllers/roomController.js";
import { isManager, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add", verifyToken, isManager, createRoom);
router.get("/all", getAllRooms);

// trả về số lượng phòng group by trạng thái
router.get("/statistic/status", verifyToken, isManager, getRoomStatusSummary);
// trả về top các loại phòng được đặt nhiều nhất, có tên và giá
router.get("/statistic/top-booked", verifyToken, isManager, getTopBookedRoomCategories);

router.get("/by-category", getRoomsByCategory);
router.get("/:id", getRoomById);
router.put("/:id", verifyToken, isManager, updateRoom);
router.delete("/:id", verifyToken, isManager, deleteRoom);
export default router;