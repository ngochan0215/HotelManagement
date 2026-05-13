import { BookingStatisticController } from "../controllers/statisticController.js";
import express from "express";
import { verifyToken, isAdmin, isManager } from "../../../shared/middleware/authMiddleware.js";

const router = express.Router();
const controller = new BookingStatisticController();

router.get("/cancellation-reasons", verifyToken, isManager, controller.getCancellationReasonStats);
router.get("/revenue-week", verifyToken, isManager, controller.getWeeklyRevenue);
router.get("/bookings-week", verifyToken, isManager, controller.getWeeklyBookings);
router.get("/bookings-month", verifyToken, isManager, controller.getMonthlyBookings);

router.get("/reports/json", verifyToken, isManager, controller.generateBookingReport);
router.get("/reports/excel", verifyToken, isManager, controller.exportBookingReportExcel);
router.get("/reports/pdf", verifyToken, isManager, controller.exportBookingReportPDF);

export default router;