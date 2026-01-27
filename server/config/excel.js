import ExcelJS from "exceljs";
import { roomOperationReport, generateBookingReport,
  generateEquipmentReport, generateCustomerReport,
  generateServiceReport,
 } from "../controllers/statisticsControllers.js";

const safeForEach = (data, callback) => {
    if (data && Array.isArray(data)) {
        data.forEach(callback);
    }
};

export const exportRoomOperationExcel = async (req, res) => {
  try {
    const { from, to } = req.query;
    const report = await roomOperationReport(from, to);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Management System";

    const summarySheet = workbook.addWorksheet("Tổng quan");
    summarySheet.columns = [
      { header: "Chỉ số", key: "label", width: 35 },
      { header: "Giá trị", key: "value", width: 20 }
    ];

    summarySheet.addRows([
      { label: "Tổng số phòng", value: report.summary?.total_rooms || 0 },
      { label: "Phòng đang sử dụng", value: report.summary?.occupied_rooms || 0 },
      { label: "Phòng bảo trì", value: report.summary?.maintenance_rooms || 0 },
      { label: "Phòng đang dọn dẹp", value: report.summary?.cleaning_rooms || 0 },
      { label: "Tỷ lệ lấp phòng (%)", value: report.summary?.occupancy_rate || 0 },
      { label: "Tổng giờ sử dụng phòng", value: report.summary?.total_occupied_hours || 0 }
    ]);
    summarySheet.getRow(1).font = { bold: true };

    const roomSheet = workbook.addWorksheet("Hiệu suất phòng");
    roomSheet.columns = [
      { header: "Phòng", key: "room_number", width: 15 },
      { header: "Loại phòng", key: "category", width: 25 },
      { header: "Số lần sử dụng", key: "usage_count", width: 18 },
      { header: "Giờ sử dụng", key: "occupied_hours", width: 18 },
      { header: "Giờ bảo trì", key: "maintenance_hours", width: 18 }
    ];

    safeForEach(report.tables?.room_performance, r => {
      roomSheet.addRow({
        room_number: r.room_number,
        category: r.category,
        usage_count: r.usage_count,
        occupied_hours: Number(r.occupied_hours?.toFixed(2) || 0),
        maintenance_hours: Number(r.maintenance_hours?.toFixed(2) || 0)
      });
    });
    roomSheet.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=bao_cao_van_hanh_phong.xlsx");
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel Room Error:", err);
    res.status(500).json({ success: false, message: "Lỗi xuất file Phòng" });
  }
};

export const exportBookingReportExcel = async (req, res) => {
  const { from, to } = req.query;
  const report = await generateBookingReport(from, to);

  const wb = new ExcelJS.Workbook();

  // sheet tổng quan
  const summarySheet = wb.addWorksheet("Tổng quan");
  summarySheet.columns = [
    { header: "Chỉ số", key: "label", width: 35 },
    { header: "Giá trị", key: "value", width: 20 }
  ];
  summarySheet.addRows([
    { label: "Tổng booking", value: report.summary.total_bookings },
    { label: "Hoàn thành", value: report.summary.completed },
    { label: "Hủy", value: report.summary.cancelled },
    { label: "Đang hiệu lực", value: report.summary.active },
    { label: "Tỷ lệ hủy (%)", value: report.summary.cancel_rate },
    { label: "Doanh thu", value: report.summary.total_revenue },
    { label: "Giá trị booking TB", value: report.summary.avg_booking_value }
  ]);
  summarySheet.getRow(1).font = { bold: true };

  // sheet 2
  const daySheet = wb.addWorksheet("Booking theo ngày");
  daySheet.columns = [
    { header: "Ngày", key: "date", width: 15 },
    { header: "Tổng booking", key: "total_bookings", width: 18 },
    { header: "Hoàn thành", key: "completed", width: 18 },
    { header: "Hủy", key: "cancelled", width: 15 },
    { header: "Doanh thu", key: "revenue", width: 20 }
  ];
  report.tables.booking_by_day.forEach(r => daySheet.addRow(r));
  daySheet.getRow(1).font = { bold: true };

  // sheet 3
  const roomSheet = wb.addWorksheet("Booking theo phòng");
  roomSheet.columns = [
    { header: "Phòng", key: "room_number", width: 15 },
    { header: "Tổng booking", key: "total_bookings", width: 18 },
    { header: "Hoàn thành", key: "completed_bookings", width: 18 },
    { header: "Hủy", key: "cancelled_bookings", width: 15 },
    { header: "Doanh thu", key: "revenue", width: 20 }
  ];
  report.tables.booking_by_room.forEach(r => roomSheet.addRow(r));
  roomSheet.getRow(1).font = { bold: true };

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  res.setHeader(
    "Content-Disposition",
    "attachment; filename=bao_cao_dat_phong.xlsx"
  );

  await wb.xlsx.write(res);
  res.end();
};

export const exportEquipmentReportExcel = async (req, res) => {
  try {
    const { from, to } = req.query;
    const report = await generateEquipmentReport(from, to);
    const wb = new ExcelJS.Workbook();

    const s1 = wb.addWorksheet("Tổng quan");
    if (report.summary) {
        Object.entries(report.summary).forEach(([k, v]) => {
            s1.addRow([k, v]);
        });
    }

    const s2 = wb.addWorksheet("Danh mục thiết bị");
    s2.columns = [
        { header: "Tên danh mục", key: "category_name", width: 30 },
        { header: "Tổng số", key: "total", width: 15 },
        { header: "Đang dùng", key: "in_use", width: 15 },
        { header: "Trong kho", key: "in_stock", width: 15 },
        { header: "Số máy hỏng", key: "broken", width: 15 }
    ];
    safeForEach(report.by_category, r => s2.addRow(r));
    s2.getRow(1).font = { bold: true };

    const s3 = wb.addWorksheet("Danh sách bảo trì");
    s3.columns = [
        { header: "ID thiết bị", key: "equipment_id", width: 25 },
        { header: "Loại", key: "category", width: 25 },
        { header: "Tình trạng", key: "condition", width: 15 },
        { header: "Ngày bắt đầu", key: "start_time", width: 20 }
    ];
    safeForEach(report.maintenance_report, r => s3.addRow(r));
    s3.getRow(1).font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=bao_cao_thiet_bi.xlsx");
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Excel Equipment Error:", err);
    res.status(500).json({ success: false, message: "Lỗi xuất file Thiết bị" });
  }
};

export const exportCustomerReportExcel = async (req, res) => {
    const { from, to } = req.query;
    const report = await generateCustomerReport(from, to);

    const workbook = new ExcelJS.Workbook();

    // summary sheet
    const summarySheet = workbook.addWorksheet("Summary");
    Object.entries(report.summary).forEach(([k, v]) => {
        summarySheet.addRow([k, v]);
    });

    // loyalty sheet
    const loyaltySheet = workbook.addWorksheet("By Loyalty");
    loyaltySheet.columns = [
        { header: "Loyalty", key: "loyalty" },
        { header: "Customers", key: "customers" },
        { header: "Revenue", key: "revenue" }
    ];
    loyaltySheet.addRows(report.by_loyalty);

    // top customers
    const topSheet = workbook.addWorksheet("Top Customers");
    topSheet.columns = [
        { header: "Name", key: "full_name" },
        { header: "Phone", key: "phone_number" },
        { header: "Bookings", key: "booking_count" },
        { header: "Total Spent", key: "total_spent" },
        { header: "Last Booking", key: "last_booking" }
    ];
    topSheet.addRows(report.top_customers);

    // cancellation
    const cancelSheet = workbook.addWorksheet("Cancellation");
    cancelSheet.columns = [
        { header: "Name", key: "full_name" },
        { header: "Total Booking", key: "total_booking" },
        { header: "Cancelled", key: "cancelled" },
        { header: "Cancel Rate (%)", key: "cancel_rate" }
    ];
    cancelSheet.addRows(report.cancellation_report);

    // age
    const ageSheet = workbook.addWorksheet("Age Group");
    ageSheet.columns = [
        { header: "Age Group", key: "age_group" },
        { header: "Customers", key: "customers" }
    ];
    ageSheet.addRows(report.by_age_group);

    // nationality
    const nationalitySheet = workbook.addWorksheet("Nationality");
    nationalitySheet.columns = [
        { header: "Nationality", key: "nationality" },
        { header: "Customers", key: "customers" }
    ];
    nationalitySheet.addRows(report.by_nationality);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=bao_cao_khach_hang.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
};

export const exportServiceReportExcel = async (req, res) => {
  const { from, to } = req.query;
  const workbook = new ExcelJS.Workbook();
  const report = await generateServiceReport(from, to);
  // sheet summary
  const summarySheet = workbook.addWorksheet("Tổng quan");

  summarySheet.addRows([
    ["PHÂN TÍCH CHUNG"],
    ["Tổng lượt sử dụng", report.summary.total_orders],
    ["Tổng số dịch vụ đã dùng", report.summary.total_services_used],
    ["Tổng doanh thu", report.summary.total_revenue],
    ["Giá trị TB / lượt", report.summary.avg_order_value],
    ["Giá trị TB / lượt", report.summary.avg_order_value],
    ["DOANH THU NỔI BẬT"],
    ["Danh mục doanh thu cao nhất", report.summary.top_revenue_category],
    ["Danh mục sử dụng nhiều nhất", report.summary.top_usage_category],
    ["Dịch vụ doanh thu cao nhất", report.summary.top_revenue_service],
    ["Dịch vụ được dùng nhiều nhất", report.summary.top_usage_service],
    ["Tỷ lệ doanh thu Top 3 dịch vụ (%)", report.summary.revenue_concentration]
  ]);

  summarySheet.getColumn(1).width = 30;
  summarySheet.getColumn(2).width = 30;

  summarySheet.getRow(1).font = { bold: true, size: 14 };

  // doanh thu theo dịch vụ lẻ
  const performanceSheet = workbook.addWorksheet("Hiệu quả dịch vụ");
  performanceSheet.columns = [
    { header: "Tên dịch vụ", key: "service_name", width: 30 },
    { header: "Danh mục", key: "category", width: 25 },
    { header: "Số lượt sử dụng", key: "quantity", width: 20 },
    { header: "Doanh thu (VNĐ)", key: "revenue", width: 20 },
    { header: "Doanh thu / lượt (VNĐ)", key: "revenue_per_use", width: 25 }
  ];

  report.tables.service_performance.forEach(row => {
    performanceSheet.addRow(row);
  });

  performanceSheet.getRow(1).font = { bold: true };

  // doanh thu theo danh mục
  const categorySheet = workbook.addWorksheet("Theo danh mục");

  categorySheet.columns = [
    { header: "Danh mục", key: "category", width: 30 },
    { header: "Số lượt sử dụng", key: "quantity", width: 20 },
    { header: "Doanh thu (VNĐ)", key: "revenue", width: 20 }
  ];

  report.tables.category_revenue.forEach(row => {
    categorySheet.addRow(row);
  });

  categorySheet.getRow(1).font = { bold: true };

  // doanh thu theo ngày
  const daySheet = workbook.addWorksheet("Theo ngày");

  daySheet.columns = [
    { header: "Ngày", key: "date", width: 20 },
    { header: "Số lượt sử dụng", key: "quantity", width: 20 },
    { header: "Doanh thu (VNĐ)", key: "revenue", width: 20 }
  ];

  report.tables.usage_by_day.forEach(row => {
    daySheet.addRow(row);
  });

  daySheet.getRow(1).font = { bold: true };

  // const roomSheet = workbook.addWorksheet("Theo phòng");

  // roomSheet.columns = [
  //   { header: "Phòng", key: "room_id", width: 30 },
  //   { header: "Số lượt sử dụng", key: "quantity", width: 20 },
  //   { header: "Doanh thu (VNĐ)", key: "revenue", width: 20 }
  // ];

  // report.tables.usage_by_room.forEach(row => {
  //   roomSheet.addRow(row);
  // });

  // roomSheet.getRow(1).font = { bold: true };

  res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=bao_cao_dich_vu.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
};
