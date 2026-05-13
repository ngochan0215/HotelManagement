import PDFDocument from "pdfkit";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import { roomOperationReport, generateBookingReport,
  generateEquipmentReport, generateCustomerReport,
  generateServiceReport,
} from "../controllers/statisticsControllers.js";

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// // Đường dẫn đến font
// const ROBOTO_REGULAR = path.join(__dirname, "Roboto-Regular.ttf");
// const ROBOTO_BOLD = path.join(__dirname, "Roboto-Bold.ttf");

// // Helper function để format số tiền
// const formatCurrency = (amount) => {
//   if (!amount) return "0";
//   return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
// };

// // Helper function để format ngày
// const formatDate = (date) => {
//   if (!date) return "N/A";
//   return new Date(date).toLocaleDateString("vi-VN");
// };

// // Helper function để tạo header cho PDF
// const addHeader = (doc, title) => {
//   doc
//     .fillColor("#1e40af")
//     .fontSize(20)
//     .font(ROBOTO_BOLD)
//     .text("HOTEL MANAGEMENT SYSTEM", 50, 50, { align: "center" })
//     .fontSize(16)
//     .text(title, 50, 80, { align: "center" })
//     .moveDown(0.5);
// };

// // Helper function để thêm footer vào trang hiện tại
// const addFooter = (doc, pageNumber = null) => {
//   if (!doc.page) return;
  
//   const pageHeight = doc.page.height;
//   const pageWidth = doc.page.width;
//   const footerY = pageHeight - 40;
//   const createdDate = new Date().toLocaleString("vi-VN");
  
//   // Lấy số trang - ưu tiên tham số, sau đó từ bufferedPageRange
//   let currentPage = pageNumber;
//   if (currentPage === null || currentPage === undefined) {
//     try {
//       const range = doc.bufferedPageRange();
//       if (range && typeof range.count === 'number' && range.count > 0) {
//         currentPage = range.start + range.count;
//       } else {
//         currentPage = 1;
//       }
//     } catch (e) {
//       currentPage = 1;
//     }
//   }
  
//   // Lưu vị trí y hiện tại để không ảnh hưởng đến nội dung
//   const savedY = doc.y;
  
//   // Vẽ footer ở cuối trang hiện tại - đảm bảo không trigger new page
//   // Text "Báo cáo được tạo vào" ở chính giữa trang
//   doc
//     .font(ROBOTO_REGULAR)
//     .fontSize(8)
//     .fillColor("#666666")
//     .text(
//       `Báo cáo được tạo vào: ${createdDate}`,
//       pageWidth,
//       footerY,
//       { 
//         align: "center", 
//         lineBreak: false 
//       }
//     )
//     .text(
//       `Trang ${currentPage}`,
//       pageWidth - 50,
//       footerY,
//       { align: "right", lineBreak: false }
//     );
  
//   // Khôi phục vị trí y
//   doc.y = savedY;
// };

// // Helper function để tạo bảng với đánh số và căn lề tốt hơn
// const addTable = (doc, data, columns, startY = 150, showNumbering = false) => {
//   if (!data || data.length === 0) {
//     doc.font(ROBOTO_REGULAR).fontSize(10).fillColor("#666666").text("Không có dữ liệu", 50, startY);
//     return startY + 30;
//   }

//   let y = startY;
//   const rowHeight = 28;
//   const pageWidth = doc.page.width;
//   const margin = 50;
//   const availableWidth = pageWidth - (margin * 2); // 495.28 points cho A4
  
//   // Tạo bản sao của columns để không modify original
//   const tableColumns = [...columns];
//   let colWidths = tableColumns.map((col) => col.width || 100);
  
//   // Nếu có đánh số, thêm cột STT
//   if (showNumbering) {
//     colWidths.unshift(45);
//     tableColumns.unshift({ header: "STT", key: "_stt", width: 45, align: "center" });
//   }
  
//   // Tính tổng width và scale nếu cần
//   let totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
  
//   // Nếu bảng quá rộng, scale xuống
//   if (totalWidth > availableWidth) {
//     const scale = (availableWidth - 20) / totalWidth; // Trừ 20 cho padding
//     colWidths = colWidths.map(w => Math.floor(w * scale));
//     totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
//   }
  
//   // Căn giữa bảng
//   const startX = margin + (availableWidth - totalWidth) / 2;

//   // Header row
//   doc.font(ROBOTO_BOLD).fontSize(10);
//   let x = startX;
//   const tableStartY = y;
//   const tableEndX = startX + totalWidth;
//   tableColumns.forEach((col, i) => {
//     doc
//       .rect(x, y, colWidths[i], rowHeight)
//       .fill("#1e40af")
//       .stroke("#1e40af"); // Border cho header
//     doc
//       .fillColor("#ffffff")
//       .text(col.header, x + 8, y + 9, {
//         width: colWidths[i] - 16,
//         align: col.align || "left",
//       });
//     x += colWidths[i];
//   });
  
//   // Vẽ border ngoài cho header row
//   doc
//     .strokeColor("#1e40af")
//     .lineWidth(1)
//     .rect(startX, tableStartY, totalWidth, rowHeight)
//     .stroke();

//   // Data rows
//   doc.font(ROBOTO_REGULAR).fontSize(9);
//   y += rowHeight;
//   let currentTableStartY = y - rowHeight; // Bắt đầu từ header row
//   data.forEach((row, rowIndex) => {
//     x = startX;
//     tableColumns.forEach((col, colIndex) => {
//       let value = "";
//       if (col.key === "_stt") {
//         value = String(rowIndex + 1);
//       } else {
//         value = row[col.key] !== undefined ? String(row[col.key]) : "";
//       }
      
//       const bgColor = rowIndex % 2 === 0 ? "#f3f4f6" : "#ffffff";
      
//       doc
//         .rect(x, y, colWidths[colIndex], rowHeight)
//         .fill(bgColor)
//         .strokeColor("#d1d5db")
//         .lineWidth(0.5)
//         .stroke("#000000"); // Border cho mỗi ô
//       doc
//         .fillColor("#000000")
//         .text(value, x + 8, y + 9, {
//           width: colWidths[colIndex] - 16,
//           align: col.align || "left",
//         });
//       x += colWidths[colIndex];
//     });
//     y += rowHeight;

//     // Check if we need a new page
//     if (y > doc.page.height - 100) {
//       // Thêm footer vào trang hiện tại trước khi add page mới
//       addFooter(doc);
//       doc.addPage();
//       y = 50;
//       // Redraw header row on new page
//       doc.font(ROBOTO_BOLD).fontSize(10);
//       const newPageTableStartY = y;
//       x = startX;
//       tableColumns.forEach((col, i) => {
//         doc
//           .rect(x, y, colWidths[i], rowHeight)
//           .fill("#1e40af")
//           .stroke("#1e40af"); // Border cho header
//         doc
//           .fillColor("#ffffff")
//           .text(col.header, x + 8, y + 9, {
//             width: colWidths[i] - 16,
//             align: col.align || "left",
//           });
//         x += colWidths[i];
//       });
//       // Vẽ border ngoài cho header row trên trang mới
//       doc
//         .strokeColor("#1e40af")
//         .lineWidth(1)
//         .rect(startX, newPageTableStartY, totalWidth, rowHeight)
//         .stroke();
//       y += rowHeight;
//       doc.font(ROBOTO_REGULAR).fontSize(9).fillColor("#000000");
//     }
//   });
  
  // Vẽ border ngoài cho toàn bộ bảng (nếu có dữ liệu)
  // Chỉ vẽ border ngoài cho phần bảng trên trang hiện tại
//   if (data.length > 0 && y > currentTableStartY) {
//     doc
//       .strokeColor("#1e40af")
//       .lineWidth(1)
//       .rect(startX, tableStartY, totalWidth, y - tableStartY)
//       .stroke();
//   }

//   return y;
// };

// Báo cáo vận hành phòng
// export const exportRoomOperationPDF = async (req, res) => {
//   try {
//     const { from, to } = req.query;
//     const report = await roomOperationReport(from, to);

//     const doc = new PDFDocument({ margin: 50, size: "A4" });
    
//     // Register fonts
//     doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
//     doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

//     doc.on("pageAdded", () => {
//       addFooter(doc);
//     });
    
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=bao_cao_van_hanh_phong_${Date.now()}.pdf`
//     );

//     doc.pipe(res);

//     // Header
//     addHeader(doc, "BÁO CÁO VẬN HÀNH PHÒNG");
//     doc
//       .font(ROBOTO_REGULAR)
//       .fontSize(10)
//       .fillColor("#333333")
//       .text(
//         `Thời gian: ${formatDate(report.meta?.from)} - ${formatDate(report.meta?.to)}`,
//         50,
//         120,
//         { align: "center" }
//       )
//       .moveDown(1);

//     // Summary section với format đẹp
//     doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("1. TỔNG QUAN", 50, 160);
//     doc.fontSize(10).font(ROBOTO_REGULAR).fillColor("#000000");
    
//     const summaryData = [
//       { label: "Tổng số phòng", value: report.summary?.total_rooms || 0 },
//       { label: "Phòng đang sử dụng", value: report.summary?.occupied_rooms || 0 },
//       { label: "Phòng bảo trì", value: report.summary?.maintenance_rooms || 0 },
//       { label: "Phòng đang dọn dẹp", value: report.summary?.cleaning_rooms || 0 },
//       { label: "Tỷ lệ lấp phòng (%)", value: (report.summary?.occupancy_rate || 0).toFixed(2) },
//       { label: "Tổng giờ sử dụng phòng", value: (report.summary?.total_occupied_hours || 0).toFixed(2) },
//     ];

//     let yPos = 190;
//     summaryData.forEach((item) => {
//       // Bullet point
//       doc
//         .font(ROBOTO_BOLD)
//         .fillColor("#1e40af")
//         .text("•", 50, yPos)
//         .font(ROBOTO_REGULAR)
//         .fillColor("#333333")
//         .text(item.label + ":", 65, yPos)
//         .font(ROBOTO_BOLD)
//         .fillColor("#000000")
//         .text(String(item.value), 250, yPos, { align: "right" });
//       yPos += 22;
//     });

//     // Thêm footer vào trang đầu tiên
//     addFooter(doc, 1);

//     // Room performance table
//     doc.addPage();
//     doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. HIỆU SUẤT PHÒNG", 50, 50);
    
//     const roomData = (report.tables?.room_performance || []).map((r) => ({
//       room_number: r.room_number || "N/A",
//       category: r.category || "N/A",
//       usage_count: r.usage_count || 0,
//       occupied_hours: Number((r.occupied_hours || 0).toFixed(2)),
//       maintenance_hours: Number((r.maintenance_hours || 0).toFixed(2)),
//     }));

//     addTable(doc, roomData, [
//       { header: "Phòng", key: "room_number", width: 80, align: "center" },
//       { header: "Loại phòng", key: "category", width: 140 },
//       { header: "Số lần sử dụng", key: "usage_count", width: 110, align: "center" },
//       { header: "Giờ sử dụng", key: "occupied_hours", width: 110, align: "right" },
//       { header: "Giờ bảo trì", key: "maintenance_hours", width: 110, align: "right" },
//     ], 80, true);

//     // Thêm footer vào trang cuối
//     //addFooter(doc);
//     doc.end();
//   } catch (err) {
//     console.error("PDF Room Error:", err);
//     res.status(500).json({ success: false, message: "Lỗi xuất file PDF Phòng" });
//   }
// };

// Báo cáo đặt phòng
// export const exportBookingReportPDF = async (req, res) => {
//   try {
//     const { from, to } = req.query;
//     const report = await generateBookingReport(from, to);

//     const doc = new PDFDocument({ margin: 50, size: "A4" });
    
//     // Register fonts
//     doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
//     doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

//     doc.on("pageAdded", () => {
//       addFooter(doc);
//     });
    
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=bao_cao_dat_phong_${Date.now()}.pdf`
//     );

//     doc.pipe(res);

//     // Header
//     addHeader(doc, "BÁO CÁO ĐẶT PHÒNG");
//     doc
//       .font(ROBOTO_REGULAR)
//       .fontSize(10)
//       .fillColor("#333333")
//       .text(
//         `Thời gian: ${formatDate(from)} - ${formatDate(to)}`,
//         50,
//         120,
//         { align: "center" }
//       )
//       .moveDown(1);

//     // Summary
//     doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("1. TỔNG QUAN", 50, 160);
//     doc.fontSize(10).font(ROBOTO_REGULAR).fillColor("#000000");
    
//     const summaryData = [
//       { label: "Tổng booking", value: report.summary?.total_bookings || 0 },
//       { label: "Hoàn thành", value: report.summary?.completed || 0 },
//       { label: "Hủy", value: report.summary?.cancelled || 0 },
//       { label: "Đang hiệu lực", value: report.summary?.active || 0 },
//       { label: "Tỷ lệ hủy (%)", value: (report.summary?.cancel_rate || 0).toFixed(2) },
//       { label: "Doanh thu", value: formatCurrency(report.summary?.total_revenue || 0) },
//       { label: "Giá trị booking TB", value: formatCurrency(report.summary?.avg_booking_value || 0) },
//     ];

//     let yPos = 190;
//     summaryData.forEach((item) => {
//       doc
//         .font(ROBOTO_BOLD)
//         .fillColor("#1e40af")
//         .text("•", 50, yPos)
//         .font(ROBOTO_REGULAR)
//         .fillColor("#333333")
//         .text(item.label + ":", 65, yPos)
//         .font(ROBOTO_BOLD)
//         .fillColor("#000000")
//         .text(String(item.value), 250, yPos, { align: "right" });
//       yPos += 22;
//     });

//     // Thêm footer vào trang đầu tiên
//     addFooter(doc, 1);

//     // Booking by day
//     doc.addPage();
//     doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. BOOKING THEO NGÀY", 50, 50);
    
//     const dayData = (report.tables?.booking_by_day || []).map((d) => ({
//       date: formatDate(d.date),
//       total_bookings: d.total_bookings || 0,
//       completed: d.completed || 0,
//       cancelled: d.cancelled || 0,
//       revenue: formatCurrency(d.revenue || 0),
//     }));

//     addTable(doc, dayData, [
//       { header: "Ngày", key: "date", width: 110 },
//       { header: "Tổng booking", key: "total_bookings", width: 100, align: "center" },
//       { header: "Hoàn thành", key: "completed", width: 100, align: "center" },
//       { header: "Hủy", key: "cancelled", width: 80, align: "center" },
//       { header: "Doanh thu", key: "revenue", width: 130, align: "right" },
//     ], 80, true);

//     // Booking by room
//     doc.addPage();
//     doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("3. BOOKING THEO PHÒNG", 50, 50);
    
//     const roomData = (report.tables?.booking_by_room || []).map((r) => ({
//       room_number: r.room_number || "N/A",
//       total_bookings: r.total_bookings || 0,
//       completed_bookings: r.completed_bookings || 0,
//       cancelled_bookings: r.cancelled_bookings || 0,
//       revenue: formatCurrency(r.revenue || 0),
//     }));

//     addTable(doc, roomData, [
//       { header: "Phòng", key: "room_number", width: 80, align: "center" },
//       { header: "Tổng booking", key: "total_bookings", width: 100, align: "center" },
//       { header: "Hoàn thành", key: "completed_bookings", width: 110, align: "center" },
//       { header: "Hủy", key: "cancelled_bookings", width: 80, align: "center" },
//       { header: "Doanh thu", key: "revenue", width: 130, align: "right" },
//     ], 80, true);

//     // Thêm footer vào trang cuối
//     //addFooter(doc);
//     doc.end();
//   } catch (err) {
//     console.error("PDF Booking Error:", err);
//     res.status(500).json({ success: false, message: "Lỗi xuất file PDF Booking" });
//   }
// };

// Báo cáo thiết bị
// export const exportEquipmentReportPDF = async (req, res) => {
//   try {
//     const { from, to } = req.query;
//     const report = await generateEquipmentReport(from, to);

//     const doc = new PDFDocument({ margin: 50, size: "A4" });
    
//     // Register fonts
//     doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
//     doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

//     doc.on("pageAdded", () => {
//       addFooter(doc);
//     });
    
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=bao_cao_thiet_bi_${Date.now()}.pdf`
//     );

//     doc.pipe(res);

//     // Header
//     addHeader(doc, "BÁO CÁO THIẾT BỊ");
//     doc
//       .font(ROBOTO_REGULAR)
//       .fontSize(10)
//       .fillColor("#333333")
//       .text(
//         `Thời gian: ${formatDate(from)} - ${formatDate(to)}`,
//         50,
//         120,
//         { align: "center" }
//       )
//       .moveDown(1);

//     // Summary
//     doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("1. TỔNG QUAN", 50, 160);
//     doc.fontSize(10).font(ROBOTO_REGULAR).fillColor("#000000");
    
//     const summaryData = [
//       { label: "Tổng thiết bị", value: report.summary?.total_equipment || 0 },
//       { label: "Trong kho", value: report.summary?.in_stock || 0 },
//       { label: "Đang sử dụng", value: report.summary?.in_use || 0 },
//       { label: "Bảo trì", value: report.summary?.maintenance || 0 },
//       { label: "Mất", value: report.summary?.lost || 0 },
//       { label: "Tổng giá trị tài sản", value: formatCurrency(report.summary?.total_asset_value || 0) },
//     ];

//     let yPos = 190;
//     summaryData.forEach((item) => {
//       doc
//         .font(ROBOTO_BOLD)
//         .fillColor("#1e40af")
//         .text("•", 50, yPos)
//         .font(ROBOTO_REGULAR)
//         .fillColor("#333333")
//         .text(item.label + ":", 65, yPos)
//         .font(ROBOTO_BOLD)
//         .fillColor("#000000")
//         .text(String(item.value), 250, yPos, { align: "right" });
//       yPos += 22;
//     });

//     // Thêm footer vào trang đầu tiên
//     addFooter(doc, 1);

//     // By category
//     doc.addPage();
//     doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. THEO DANH MỤC", 50, 50);
    
//     const categoryData = (report.by_category || []).map((c) => ({
//       category_name: c.category_name || "N/A",
//       total: c.total || 0,
//       in_use: c.in_use || 0,
//       in_stock: c.in_stock || 0,
//       broken: c.broken || 0,
//     }));

//     addTable(doc, categoryData, [
//       { header: "Danh mục", key: "category_name", width: 180 },
//       { header: "Tổng số", key: "total", width: 90, align: "center" },
//       { header: "Đang dùng", key: "in_use", width: 90, align: "center" },
//       { header: "Trong kho", key: "in_stock", width: 90, align: "center" },
//       { header: "Hỏng", key: "broken", width: 80, align: "center" },
//     ], 80, true);

//     // Maintenance report
//     if (report.maintenance_report && report.maintenance_report.length > 0) {
//       doc.addPage();
//       doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("3. DANH SÁCH BẢO TRÌ", 50, 50);
      
//       const maintenanceData = report.maintenance_report.map((m) => ({
//         equipment_id: String(m.equipment_id || "N/A").slice(-8),
//         category: m.category || "N/A",
//         condition: m.condition || "N/A",
//         start_time: formatDate(m.start_time),
//       }));

//       addTable(doc, maintenanceData, [
//         { header: "ID Thiết bị", key: "equipment_id", width: 110, align: "center" },
//         { header: "Loại", key: "category", width: 170 },
//         { header: "Tình trạng", key: "condition", width: 110, align: "center" },
//         { header: "Ngày bắt đầu", key: "start_time", width: 120 },
//       ], 80, true);
//     }

//     // Thêm footer vào trang cuối
//     //addFooter(doc);
//     doc.end();
//   } catch (err) {
//     console.error("PDF Equipment Error:", err);
//     res.status(500).json({ success: false, message: "Lỗi xuất file PDF Thiết bị" });
//   }
// };

// Báo cáo khách hàng
// export const exportCustomerReportPDF = async (req, res) => {
//   try {
//     const { from, to } = req.query;
//     const report = await generateCustomerReport(from, to);

//     const doc = new PDFDocument({ margin: 50, size: "A4" });
    
//     // Register fonts
//     doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
//     doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

//     doc.on("pageAdded", () => {
//       addFooter(doc);
//     });
    
//     res.setHeader("Content-Type", "application/pdf");
//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=bao_cao_khach_hang_${Date.now()}.pdf`
//     );

//     doc.pipe(res);

//     // Header
//     addHeader(doc, "BÁO CÁO KHÁCH HÀNG");
//     doc
//       .font(ROBOTO_REGULAR)
//       .fontSize(10)
//       .fillColor("#333333")
//       .text(
//         `Thời gian: ${formatDate(from)} - ${formatDate(to)}`,
//         50,
//         120,
//         { align: "center" }
//       )
//       .moveDown(1);

//     // Summary
//     doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("1. TỔNG QUAN", 50, 160);
//     doc.fontSize(10).font(ROBOTO_REGULAR).fillColor("#000000");
    
//     const summaryData = [
//       { label: "Tổng khách hàng", value: report.summary?.total_customers || 0 },
//       { label: "Đang hoạt động", value: report.summary?.active || 0 },
//       { label: "Không hoạt động", value: report.summary?.inactive || 0 },
//       { label: "Bị cấm", value: report.summary?.banned || 0 },
//       { label: "Khách hàng mới", value: report.summary?.new_customers || 0 },
//       { label: "Tổng booking", value: report.summary?.total_booking || 0 },
//       { label: "Tổng doanh thu", value: formatCurrency(report.summary?.total_revenue || 0) },
//     ];

//     let yPos = 190;
//     summaryData.forEach((item) => {
//       doc
//         .font(ROBOTO_BOLD)
//         .fillColor("#1e40af")
//         .text("•", 50, yPos)
//         .font(ROBOTO_REGULAR)
//         .fillColor("#333333")
//         .text(item.label + ":", 65, yPos)
//         .font(ROBOTO_BOLD)
//         .fillColor("#000000")
//         .text(String(item.value), 250, yPos, { align: "right" });
//       yPos += 22;
//     });

//     // Thêm footer vào trang đầu tiên
//     addFooter(doc, 1);

//     // Top customers
//     if (report.top_customers && report.top_customers.length > 0) {
//       doc.addPage();
//       doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. TOP KHÁCH HÀNG", 50, 50);
      
//       const topCustomersData = report.top_customers.map((c) => ({
//         full_name: c.full_name || "N/A",
//         phone_number: c.phone_number || "N/A",
//         booking_count: c.booking_count || 0,
//         total_spent: formatCurrency(c.total_spent || 0),
//         last_booking: formatDate(c.last_booking),
//       }));

//       addTable(doc, topCustomersData, [
//         { header: "Tên", key: "full_name", width: 140 },
//         { header: "SĐT", key: "phone_number", width: 110 },
//         { header: "Số booking", key: "booking_count", width: 90, align: "center" },
//         { header: "Tổng chi tiêu", key: "total_spent", width: 130, align: "right" },
//         { header: "Booking cuối", key: "last_booking", width: 110 },
//       ], 80, true);
//     }

//     // By loyalty
//     if (report.by_loyalty && report.by_loyalty.length > 0) {
//       doc.addPage();
//       doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("3. THEO LOYALTY", 50, 50);
      
//       const loyaltyData = report.by_loyalty.map((l) => ({
//         loyalty: l.loyalty || "N/A",
//         customers: l.customers || 0,
//         revenue: formatCurrency(l.revenue || 0),
//       }));

//       addTable(doc, loyaltyData, [
//         { header: "Loyalty", key: "loyalty", width: 180 },
//         { header: "Số khách hàng", key: "customers", width: 130, align: "center" },
//         { header: "Doanh thu", key: "revenue", width: 160, align: "right" },
//       ], 80, true);
//     }

//     // By age group
//     if (report.by_age_group && report.by_age_group.length > 0) {
//       doc.addPage();
//       doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("4. THEO NHÓM TUỔI", 50, 50);
      
//       const ageData = report.by_age_group.map((a) => ({
//         age_group: a.age_group || "N/A",
//         customers: a.customers || 0,
//       }));

//       addTable(doc, ageData, [
//         { header: "Nhóm tuổi", key: "age_group", width: 200 },
//         { header: "Số khách hàng", key: "customers", width: 200, align: "center" },
//       ], 80, true);
//     }

//     // Thêm footer vào trang cuối
//     //addFooter(doc);
//     doc.end();
//   } catch (err) {
//     console.error("PDF Customer Error:", err);
//     res.status(500).json({ success: false, message: "Lỗi xuất file PDF Khách hàng" });
//   }
// };

// Báo cáo dịch vụ
export const exportServiceReportPDF = async (req, res) => {
  try {
    const { from, to } = req.query;
    const report = await generateServiceReport(from, to);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    
    // Register fonts
    doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
    doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

    doc.on("pageAdded", () => {
      addFooter(doc);
    });
    
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=bao_cao_dich_vu_${Date.now()}.pdf`
    );

    doc.pipe(res);

    // Header
    addHeader(doc, "BÁO CÁO DỊCH VỤ");
    doc
      .font(ROBOTO_REGULAR)
      .fontSize(10)
      .fillColor("#333333")
      .text(
        `Thời gian: ${formatDate(from)} - ${formatDate(to)}`,
        50,
        120,
        { align: "center" }
      )
      .moveDown(1);

    // Summary
    doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("1. TỔNG QUAN", 50, 160);
    doc.fontSize(10).font(ROBOTO_REGULAR).fillColor("#000000");
    
    const summaryData = [
      { label: "Tổng lượt sử dụng", value: report.summary?.total_orders || 0 },
      { label: "Tổng số dịch vụ đã dùng", value: report.summary?.total_services_used || 0 },
      { label: "Tổng doanh thu", value: formatCurrency(report.summary?.total_revenue || 0) },
      { label: "Giá trị TB / lượt", value: formatCurrency(report.summary?.avg_order_value || 0) },
      { label: "Danh mục doanh thu cao nhất", value: report.summary?.top_revenue_category || "N/A" },
      { label: "Dịch vụ doanh thu cao nhất", value: report.summary?.top_revenue_service || "N/A" },
      { label: "Tỷ lệ doanh thu Top 3 (%)", value: (report.summary?.revenue_concentration || 0).toFixed(2) },
    ];

    let yPos = 190;
    summaryData.forEach((item) => {
      doc
        .font(ROBOTO_BOLD)
        .fillColor("#1e40af")
        .text("•", 50, yPos)
        .font(ROBOTO_REGULAR)
        .fillColor("#333333")
        .text(item.label + ":", 65, yPos)
        .font(ROBOTO_BOLD)
        .fillColor("#000000")
        .text(String(item.value), 250, yPos, { align: "right" });
      yPos += 22;
    });

    // Thêm footer vào trang đầu tiên
    addFooter(doc, 1);

    // Service performance
    if (report.tables?.service_performance && report.tables.service_performance.length > 0) {
      doc.addPage();
      doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. HIỆU QUẢ DỊCH VỤ", 50, 50);
      
      const performanceData = report.tables.service_performance.map((s) => ({
        service_name: s.service_name || "N/A",
        category: s.category || "N/A",
        quantity: s.quantity || 0,
        revenue: formatCurrency(s.revenue || 0),
        revenue_per_use: formatCurrency(s.revenue_per_use || 0),
      }));

      addTable(doc, performanceData, [
        { header: "Tên dịch vụ", key: "service_name", width: 160 },
        { header: "Danh mục", key: "category", width: 130 },
        { header: "Số lượt", key: "quantity", width: 90, align: "center" },
        { header: "Doanh thu", key: "revenue", width: 130, align: "right" },
        { header: "Doanh thu/lượt", key: "revenue_per_use", width: 130, align: "right" },
      ], 80, true);
    }

    // By category
    if (report.tables?.category_revenue && report.tables.category_revenue.length > 0) {
      doc.addPage();
      doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("3. THEO DANH MỤC", 50, 50);
      
      const categoryData = report.tables.category_revenue.map((c) => ({
        category: c.category || "N/A",
        quantity: c.quantity || 0,
        revenue: formatCurrency(c.revenue || 0),
      }));

      addTable(doc, categoryData, [
        { header: "Danh mục", key: "category", width: 250 },
        { header: "Số lượt sử dụng", key: "quantity", width: 130, align: "center" },
        { header: "Doanh thu", key: "revenue", width: 160, align: "right" },
      ], 80, true);
    }

    // By day
    if (report.tables?.usage_by_day && report.tables.usage_by_day.length > 0) {
      doc.addPage();
      doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("4. THEO NGÀY", 50, 50);
      
      const dayData = report.tables.usage_by_day.map((d) => ({
        date: formatDate(d.date),
        quantity: d.quantity || 0,
        revenue: formatCurrency(d.revenue || 0),
      }));

      addTable(doc, dayData, [
        { header: "Ngày", key: "date", width: 150 },
        { header: "Số lượt sử dụng", key: "quantity", width: 150, align: "center" },
        { header: "Doanh thu", key: "revenue", width: 180, align: "right" },
      ], 80, true);
    }

    // Thêm footer vào trang cuối
    //addFooter(doc);
    doc.end();
  } catch (err) {
    console.error("PDF Service Error:", err);
    res.status(500).json({ success: false, message: "Lỗi xuất file PDF Dịch vụ" });
  }
};
