import express from "express";
import { 
    createRoom,
    getAllRooms,
    getRoomById,
    updateRoom,
    deleteRoom,
    getRoomsByCategory,
    getRoomStatusSummary,
    getTopBookedRoomCategories,
    getLatestStatusOfAllRooms,
    completeCleaning,
    completeMaintenance
} from "../controllers/roomController.js";
import { isManager, isNotCustomer, verifyToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/add", verifyToken, isManager, createRoom);
router.get("/all", getAllRooms);

// trả về số lượng phòng group by trạng thái
router.get("/statistic/status", verifyToken, isManager, getRoomStatusSummary);
// trả về top các loại phòng được đặt nhiều nhất, có tên và giá
router.get("/statistic/top-booked", verifyToken, isManager, getTopBookedRoomCategories);
// trả về top các loại phòng được đặt nhiều nhất, có tên và giá
router.get("/status/latest", verifyToken, getLatestStatusOfAllRooms);

router.get("/by-category", getRoomsByCategory);
router.get("/:id", getRoomById);
router.put("/:id", verifyToken, isManager, updateRoom);
router.delete("/:id", verifyToken, isManager, deleteRoom);

// xác nhận hoàn thành dọn dẹp
router.post("/:roomId/cleaning/complete", verifyToken, completeCleaning);
// xác nhận hoàn thành bảo trì
router.post("/:roomId/maintenance/complete", verifyToken, completeMaintenance);
export default router;