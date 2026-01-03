import express from "express";
import { verifyToken, isNotCustomer, isManager } from "../middleware/authMiddleware.js";
import { getWeeklyRevenue, financeOverview,
    getWeeklyBookings,
    getRoomOperationReport,
    getBookingReport,
    getEquipmentsReport,
    getCustomersReport,
    getServicesReport
} from "../controllers/statisticsControllers.js";
 import { exportRoomOperationExcel,
    exportBookingReportExcel,
    exportEquipmentReportExcel,
    exportCustomerReportExcel,
    exportServiceReportExcel
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
router.get("/reports/booking", getBookingReport);   // trả về json
router.get("/reports/booking/excel", exportBookingReportExcel); // xuất excel

// PHÒNG
router.get("/reports/room-operation/excel", exportRoomOperationExcel); // xuất excel
router.get("/reports/room-operation", getRoomOperationReport); // trả về json

// KHÁCH HÀNG
router.get("/reports/customers/excel", exportCustomerReportExcel); // xuất excel
router.get("/reports/customers", getCustomersReport); // trả về json

// THIẾT BỊ
router.get("/reports/equipments/excel", exportEquipmentReportExcel); // xuất excel
router.get("/reports/equipments", getEquipmentsReport); // trả về json

// DỊCH VỤ
router.get("/reports/services/excel", exportServiceReportExcel); // xuất excel
router.get("/reports/services", getServicesReport); // trả về json

// SỰ CỐ

export default router;