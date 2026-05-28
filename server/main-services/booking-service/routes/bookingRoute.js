import express from "express";
import { BookingController } from "../controllers/bookingController.js";
import { isManager, verifyToken, isEmployee, isCustomer } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new BookingController();

// customer self-service — must be before /:id
router.post("/customer", verifyToken, isCustomer, controller.createCustomerBooking);
router.patch("/customer/cancel/:id", verifyToken, isCustomer, controller.cancelCustomerBooking);
router.patch("/customer/:bookingId/details/:detailId/cancel", verifyToken, isCustomer, controller.cancelCustomerBookingDetail);
router.get("/my", verifyToken, isCustomer, controller.getMyBookings);
router.get("/my/:id", verifyToken, isCustomer, controller.getMyBookingDetail);

router.get("/", verifyToken, isEmployee, controller.getAllBookings);
router.get("/:id", verifyToken, isEmployee, controller.getBookingDetail);

router.post("/", verifyToken, isEmployee, controller.createBooking);
router.patch("/update-status/:id", verifyToken, isEmployee, controller.updateBookingStatus);
router.patch("/confirm-deposited/:id", verifyToken, isEmployee, controller.confirmBooking);
router.patch("/:id", verifyToken, isEmployee, controller.addRoomsToBooking);
router.patch("/cancel-booking/:id", verifyToken, isEmployee, controller.cancelBooking);

router.post("/:bookingId/details/:detailId/checkin", verifyToken, isEmployee, controller.checkinBookingDetail);
router.post("/:bookingId/details/:detailId/checkout", verifyToken, isEmployee, controller.checkoutBookingDetail);
router.patch("/:bookingId/details/:detailId/cancel", verifyToken, isEmployee, controller.cancelBookingDetail);

export default router;