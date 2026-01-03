import express from "express";
import { verifyToken, isNotCustomer, isManager } from "../middleware/authMiddleware.js";
import { getWeeklyRevenue, getWeeklyBookings } from "../controllers/statisticsControllers.js";
const router = express.Router();

// lấy doanh thu theo tuần
router.get("/revenue-week", verifyToken, isNotCustomer, getWeeklyRevenue);
// lấy số lượt đặt phòng theo tuần
router.get("/bookings-week", verifyToken, isNotCustomer, getWeeklyBookings);

export default router;