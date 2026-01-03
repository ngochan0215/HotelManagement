import express from "express";
import { verifyToken, isNotCustomer, isManager } from "../middleware/authMiddleware.js";
import { getWeeklyRevenue, financeOverview,
    getWeeklyBookings,
    getRoomOperationReport,
    getBookingReport
} from "../controllers/statisticsControllers.js";
 import { exportRoomOperationExcel,
    exportBookingReportExcel
  } from "../config/excel.js";
const router = express.Router();

// DOANH THU
// lấy doanh thu theo tuần
router.get("/revenue-week", verifyToken, isNotCustomer, getWeeklyRevenue);

// thống kê doanh thu bao gồm tiền vào/tiền ra/lợi nhuận
//router.get("/finance/overview", verifyToken, isNotCustomer, financeOverview);
//router.get("/finance/overview/export", verifyToken, isNotCustomer, exportFinanceOverview);
// thống kê doanh thu theo nguồn tiền
//router.get("/finance/revenue-by-source", verifyToken, isNotCustomer, revenueBySource);
// bản excel
//router.get("/finance/revenue-by-source/export", verifyToken, isNotCustomer, exportRevenueBySource);

// ĐẶT PHÒNG
// lấy số lượt đặt phòng theo tuần
router.get("/bookings-week", verifyToken, isNotCustomer, getWeeklyBookings);
router.get("/reports/booking", getBookingReport);
router.get("/reports/booking/excel", exportBookingReportExcel);

// PHÒNG
router.get("/reports/room-operation/excel", exportRoomOperationExcel); // xuất excel
router.get("/reports/room-operation", getRoomOperationReport); // trả về json

// THIẾT BỊ
// DỊCH VỤ
// SỰ CỐ
// KHÁCH HÀNG

export default router;