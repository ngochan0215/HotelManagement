import ExcelJS from "exceljs";
import { roomOperationReport, generateBookingReport } from "../controllers/statisticsControllers.js";

// export const exportToExcel = async (res, rows, filename) => {
//   const workbook = new ExcelJS.Workbook();
//   const sheet = workbook.addWorksheet("Report");

//   sheet.columns = Object.keys(rows[0]).map(key => ({
//     header: key,
//     key
//   }));

//   sheet.addRows(rows);

//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   );
//   res.setHeader(
//     "Content-Disposition",
//     `attachment; filename=${filename}`
//   );

//   await workbook.xlsx.write(res);
//   res.end();
// };

// export const exportHeatmapExcel = async (res, data) => {
//   const workbook = new ExcelJS.Workbook();
//   const sheet = workbook.addWorksheet("Utilization Heatmap");

//   sheet.columns = [
//     { header: "Room", key: "Room", width: 12 },
//     ...DAYS.map(d => ({ header: d, key: d, width: 10 }))
//   ];

//   data.forEach(row => {
//     const excelRow = sheet.addRow(row);

//     DAYS.forEach((d, idx) => {
//       const cell = excelRow.getCell(idx + 2);
//       const v = cell.value;

//       let color = "FFFFFF"; // trắng
//       if (v >= 80) color = "FF4CAF50"; // xanh đậm
//       else if (v >= 50) color = "FFFFC107"; // vàng
//       else if (v > 0) color = "FFFF9800"; // cam
//       else color = "FFF44336"; // đỏ

//       cell.fill = {
//         type: "pattern",
//         pattern: "solid",
//         fgColor: { argb: color }
//       };
//     });
//   });

//   res.setHeader(
//     "Content-Type",
//     "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
//   );
//   res.setHeader(
//     "Content-Disposition",
//     "attachment; filename=room-utilization-heatmap.xlsx"
//   );

//   await workbook.xlsx.write(res);
//   res.end();
// };

export const exportRoomOperationExcel = async (req, res) => {
  try {
    const { from, to } = req.query;

    const report = await roomOperationReport(from, to);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = "Hotel Management System";
    workbook.created = new Date();

    /* =======================
       SHEET 1: TỔNG QUAN
    ======================= */
    const summarySheet = workbook.addWorksheet("Tổng quan");

    summarySheet.columns = [
      { header: "Chỉ số", key: "label", width: 35 },
      { header: "Giá trị", key: "value", width: 20 }
    ];

    summarySheet.addRows([
      { label: "Tổng số phòng", value: report.summary.total_rooms },
      { label: "Phòng đang sử dụng", value: report.summary.occupied_rooms },
      { label: "Phòng bảo trì", value: report.summary.maintenance_rooms },
      { label: "Phòng đang dọn dẹp", value: report.summary.cleaning_rooms },
      { label: "Phòng đang chờ cọc", value: report.summary.reserved_rooms },
      { label: "Phòng đang được đặt", value: report.summary.booked_rooms },

      { label: "Tỷ lệ lấp phòng (%)", value: report.summary.occupancy_rate },
      { label: "Tổng giờ sử dụng phòng", value: report.summary.total_occupied_hours },
      { label: "Giờ sử dụng TB / phòng", value: report.summary.avg_usage_hours_per_room }
    ]);

    summarySheet.getRow(1).font = { bold: true };

    /* =======================
       SHEET 2: HIỆU SUẤT PHÒNG
    ======================= */
    const roomSheet = workbook.addWorksheet("Hiệu suất phòng");

    roomSheet.columns = [
      { header: "Phòng", key: "room_number", width: 15 },
      { header: "Loại phòng", key: "category", width: 25 },
      { header: "Số lần sử dụng", key: "usage_count", width: 18 },
      { header: "Giờ sử dụng", key: "occupied_hours", width: 18 },
      { header: "Giờ bảo trì", key: "maintenance_hours", width: 18 },
      { header: "Giờ dọn phòng", key: "cleaning_hours", width: 18 }
    ];

    report.tables.room_performance.forEach(r => {
      roomSheet.addRow({
        room_number: r.room_number,
        category: r.category,
        usage_count: r.usage_count,
        occupied_hours: Number(r.occupied_hours.toFixed(2)),
        maintenance_hours: Number(r.maintenance_hours.toFixed(2)),
        cleaning_hours: Number(r.cleaning_hours.toFixed(2))
      });
    });

    roomSheet.getRow(1).font = { bold: true };

    /* =======================
       SHEET 3: CÔNG SUẤT THEO NGÀY
    ======================= */
    const dailySheet = workbook.addWorksheet("Công suất theo ngày");

    dailySheet.columns = [
      { header: "Ngày", key: "date", width: 15 },
      { header: "Số phòng sử dụng", key: "occupied_rooms", width: 22 },
      { header: "Tỷ lệ lấp phòng (%)", key: "occupancy_rate", width: 22 }
    ];

    report.tables.daily_occupancy.forEach(d => {
      dailySheet.addRow(d);
    });

    dailySheet.getRow(1).font = { bold: true };

    /* =======================
       RESPONSE
    ======================= */
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=bao_cao_van_hanh_phong.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Xuất báo cáo Excel thất bại"
    });
  }
};

export const exportBookingReportExcel = async (req, res) => {
  const { from, to } = req.query;
  const report = await generateBookingReport(from, to);

  const wb = new ExcelJS.Workbook();

  /* ===== SHEET 1: SUMMARY ===== */
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

  /* ===== SHEET 2: BOOKING THEO NGÀY ===== */
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

  /* ===== SHEET 3: BOOKING THEO PHÒNG ===== */
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