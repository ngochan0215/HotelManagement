import express from "express";
import {
    createBooking, getCancellationReasonStats, getBookingDetail, updateBookingStatus,
    cancelBooking, getAllBookings, confirmBooking, checkinBookingDetail, checkoutBookingDetail,
    cancelBookingDetail,
} from "../controllers/bookingController.js";
import { getCalendarRooms } from "../controllers/managerController.js";
import {
    getAvailableHousekeepers, assignCleaningTask, startCleaningTask,
    completeCleaningTask, confirmCleaningTask, getAllTasks, getMyCleaningTasks,
    getCleaningTaskByRoom
} from "../controllers/cleaningController.js";
import { isManager, verifyToken, isEmployee } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/calendar/rooms", verifyToken, isEmployee, getCalendarRooms);
router.get("/all", verifyToken, isEmployee, getAllBookings);
router.get("/:id", verifyToken, getBookingDetail);

// preview và thêm booking cho checkin-out chung
router.post("/add/general", verifyToken, createBooking);

// preview và thêm booking cho checkin-out riêng
//router.post("/add/particular", verifyToken, createBookingg);

// update trạng thái toàn bộ booking (nên dùng cho booking có checkin-out chung)
router.put("/:booking_id/update", verifyToken, updateBookingStatus);
// xác nhận khách đã đặt cọc
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

// Cleaning Tasks Routes
router.get("/cleaning/available-housekeepers", verifyToken, isManager, getAvailableHousekeepers);
router.post("/cleaning/assign", verifyToken, isManager, assignCleaningTask);
router.get("/cleaning/my-tasks", verifyToken, isEmployee, getMyCleaningTasks);
router.post("/cleaning/:id/start", verifyToken, isEmployee, startCleaningTask);
router.post("/cleaning/:id/complete", verifyToken, isEmployee, completeCleaningTask);
router.post("/cleaning/:id/confirm", verifyToken, isManager, confirmCleaningTask);
router.get("/tasks/all", verifyToken, isManager, getAllTasks);
router.get("/cleaning/task-by-room", verifyToken, isEmployee, getCleaningTaskByRoom);

export default router;