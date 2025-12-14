import express from "express";
import { createBooking, getCancellationReasonStats, getBookingDetail, updateBookingStatus, cancelRoomInBooking, cancelBooking, getAllBookings } from "../controllers/bookingController.js";
import { isManager, verifyToken, isCustomer, isEmployee, canAccessBooking } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/all", verifyToken, isManager, getAllBookings);
router.post("/add", verifyToken, createBooking);
router.get("/:id", verifyToken, getBookingDetail);
router.put("/:booking_id/update", verifyToken, updateBookingStatus);

// xóa một phòng bất kì trong booking
router.patch("/:bookingId/cancel-room/:bookingDetailId", verifyToken, canAccessBooking, cancelRoomInBooking);
// xóa toàn bộ booking
router.patch("/:bookingId/cancel", verifyToken, canAccessBooking, cancelBooking);

// thống kê lý do hủy phòng
router.get("/statistics/cancellation-reasons", verifyToken, isManager, getCancellationReasonStats);

export default router;