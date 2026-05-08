import express from "express";
import { BookingController } from "../controllers/bookingController.js";
import { isManager, verifyToken, isEmployee } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new BookingController();

router.get("/", verifyToken, isEmployee, controller.getAllBookings);
router.get("/:id", verifyToken, controller.getBookingDetail);

router.post("/", verifyToken, controller.createBooking);
router.patch("/update-status/:id", verifyToken, controller.updateBookingStatus);
router.patch("/confirm-deposited/:id", verifyToken, controller.confirmBooking);
router.patch("/:id", verifyToken, controller.addRoomsToBooking);
router.patch("/cancel-booking/:id", verifyToken, controller.cancelBooking);

router.post("/:bookingId/details/:detailId/checkin", verifyToken, controller.checkinBookingDetail);
router.post("/:bookingId/details/:detailId/checkout", verifyToken, controller.checkoutBookingDetail);
router.patch("/:bookingId/details/:detailId/cancel", verifyToken, controller.cancelBookingDetail);

// router.get("/statistics/cancellation-reasons", verifyToken, isManager, getCancellationReasonStats);

// // Cleaning Tasks Routes
// router.get("/cleaning/available-housekeepers", verifyToken, isManager, getAvailableHousekeepers);
// router.post("/cleaning/assign", verifyToken, isManager, assignCleaningTask);
// router.get("/cleaning/my-tasks", verifyToken, isEmployee, getMyCleaningTasks);
// router.post("/cleaning/:id/start", verifyToken, isEmployee, startCleaningTask);
// router.post("/cleaning/:id/complete", verifyToken, isEmployee, completeCleaningTask);
// router.post("/cleaning/:id/confirm", verifyToken, isManager, confirmCleaningTask);
// router.get("/tasks/all", verifyToken, isManager, getAllTasks);
// router.get("/cleaning/task-by-room", verifyToken, isEmployee, getCleaningTaskByRoom);

export default router;