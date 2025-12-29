import express from "express";
import { createBooking, getCancellationReasonStats, getBookingDetail, updateBookingStatus, cancelBooking, getAllBookings, confirmBooking, checkinBookingDetail, checkoutBookingDetail, cancelBookingDetail } from "../controllers/bookingController.js";
import { isManager, verifyToken, isCustomer, isEmployee, canAccessBooking } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/all", verifyToken, isManager, getAllBookings);
router.post("/add", verifyToken, createBooking);
router.get("/:id", verifyToken, getBookingDetail);
router.put("/:booking_id/update", verifyToken, updateBookingStatus);
router.put("/:booking_id/confirm", verifyToken, confirmBooking);

// checkin một phòng bất kì trong booking
router.post("/:bookingId/details/:detailId/checkin", verifyToken, checkinBookingDetail);
// checkout một phòng bất kì trong booking
router.post("/:bookingId/details/:detailId/checkout", verifyToken, checkoutBookingDetail);

// xóa một phòng bất kì trong booking
router.patch("/:bookingId/details/:detailId/cancel", verifyToken, cancelBookingDetail);
// xóa toàn bộ booking
router.patch("/:bookingId/cancel", verifyToken, cancelBooking);

// thống kê lý do hủy phòng
router.get("/statistics/cancellation-reasons", verifyToken, isManager, getCancellationReasonStats);

export default router;