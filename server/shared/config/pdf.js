import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ROBOTO_REGULAR = path.join(__dirname, "Roboto-Regular.ttf");
export const ROBOTO_BOLD = path.join(__dirname, "Roboto-Bold.ttf");

// Helper function để format số tiền
export const formatCurrency = (amount) => {
  if (!amount) return "0";
  return new Intl.NumberFormat("vi-VN").format(amount) + " đ";
};

// Helper function để format ngày
export const formatDate = (date) => {
  if (!date) return "N/A";
  return new Date(date).toLocaleDateString("vi-VN");
};

// Helper function để tạo header cho PDF
export const addHeader = (doc, title) => {
  doc
    .fillColor("#1e40af")
    .fontSize(20)
    .font(ROBOTO_BOLD)
    .text("HOTEL MANAGEMENT SYSTEM", 50, 50, { align: "center" })
    .fontSize(16)
    .text(title, 50, 80, { align: "center" })
    .moveDown(0.5);
};

// Helper function để thêm footer vào trang hiện tại
export const addFooter = (doc, pageNumber = null) => {
  if (!doc.page) return;
  
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width;
  const footerY = pageHeight - 40;
  const createdDate = new Date().toLocaleString("vi-VN");
  
  // Lấy số trang - ưu tiên tham số, sau đó từ bufferedPageRange
  let currentPage = pageNumber;
  if (currentPage === null || currentPage === undefined) {
    try {
      const range = doc.bufferedPageRange();
      if (range && typeof range.count === 'number' && range.count > 0) {
        currentPage = range.start + range.count;
      } else {
        currentPage = 1;
      }
    } catch (e) {
      currentPage = 1;
    }
  }
  
  const savedY = doc.y;
  doc
    .font(ROBOTO_REGULAR)
    .fontSize(8)
    .fillColor("#666666")
    .text(
      `Báo cáo được tạo vào: ${createdDate}`,
      pageWidth,
      footerY,
      { 
        align: "center", 
        lineBreak: false 
      }
    )
    .text(
      `Trang ${currentPage}`,
      pageWidth - 50,
      footerY,
      { align: "right", lineBreak: false }
    );
  
  doc.y = savedY;
};

// Helper function để tạo bảng với đánh số và căn lề tốt hơn
export const addTable = (doc, data, columns, startY = 150, showNumbering = false) => {
  if (!data || data.length === 0) {
    doc.font(ROBOTO_REGULAR).fontSize(10).fillColor("#666666").text("Không có dữ liệu", 50, startY);
    return startY + 30;
  }

  let y = startY;
  const rowHeight = 28;
  const pageWidth = doc.page.width;
  const margin = 50;
  const availableWidth = pageWidth - (margin * 2); // 495.28 points cho A4
  
  // Tạo bản sao của columns để không modify original
  const tableColumns = [...columns];
  let colWidths = tableColumns.map((col) => col.width || 100);
  
  // Nếu có đánh số, thêm cột STT
  if (showNumbering) {
    colWidths.unshift(45);
    tableColumns.unshift({ header: "STT", key: "_stt", width: 45, align: "center" });
  }
  
  // Tính tổng width và scale nếu cần
  let totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
  
  // Nếu bảng quá rộng, scale xuống
  if (totalWidth > availableWidth) {
    const scale = (availableWidth - 20) / totalWidth; // Trừ 20 cho padding
    colWidths = colWidths.map(w => Math.floor(w * scale));
    totalWidth = colWidths.reduce((sum, w) => sum + w, 0);
  }
  
  // Căn giữa bảng
  const startX = margin + (availableWidth - totalWidth) / 2;

  // Header row
  doc.font(ROBOTO_BOLD).fontSize(10);
  let x = startX;
  const tableStartY = y;
  const tableEndX = startX + totalWidth;
  tableColumns.forEach((col, i) => {
    doc
      .rect(x, y, colWidths[i], rowHeight)
      .fill("#1e40af")
      .stroke("#1e40af"); // Border cho header
    doc
      .fillColor("#ffffff")
      .text(col.header, x + 8, y + 9, {
        width: colWidths[i] - 16,
        align: col.align || "left",
      });
    x += colWidths[i];
  });
  
  // Vẽ border ngoài cho header row
  doc
    .strokeColor("#1e40af")
    .lineWidth(1)
    .rect(startX, tableStartY, totalWidth, rowHeight)
    .stroke();

  // Data rows
  doc.font(ROBOTO_REGULAR).fontSize(9);
  y += rowHeight;
  let currentTableStartY = y - rowHeight; // Bắt đầu từ header row
  data.forEach((row, rowIndex) => {
    x = startX;
    tableColumns.forEach((col, colIndex) => {
      let value = "";
      if (col.key === "_stt") {
        value = String(rowIndex + 1);
      } else {
        value = row[col.key] !== undefined ? String(row[col.key]) : "";
      }
      
      const bgColor = rowIndex % 2 === 0 ? "#f3f4f6" : "#ffffff";
      
      doc
        .rect(x, y, colWidths[colIndex], rowHeight)
        .fill(bgColor)
        .strokeColor("#d1d5db")
        .lineWidth(0.5)
        .stroke("#000000"); // Border cho mỗi ô
      doc
        .fillColor("#000000")
        .text(value, x + 8, y + 9, {
          width: colWidths[colIndex] - 16,
          align: col.align || "left",
        });
      x += colWidths[colIndex];
    });
    y += rowHeight;

    // Check if we need a new page
    if (y > doc.page.height - 100) {
      // Thêm footer vào trang hiện tại trước khi add page mới
      addFooter(doc);
      doc.addPage();
      y = 50;
      // Redraw header row on new page
      doc.font(ROBOTO_BOLD).fontSize(10);
      const newPageTableStartY = y;
      x = startX;
      tableColumns.forEach((col, i) => {
        doc
          .rect(x, y, colWidths[i], rowHeight)
          .fill("#1e40af")
          .stroke("#1e40af"); // Border cho header
        doc
          .fillColor("#ffffff")
          .text(col.header, x + 8, y + 9, {
            width: colWidths[i] - 16,
            align: col.align || "left",
          });
        x += colWidths[i];
      });
      // Vẽ border ngoài cho header row trên trang mới
      doc
        .strokeColor("#1e40af")
        .lineWidth(1)
        .rect(startX, newPageTableStartY, totalWidth, rowHeight)
        .stroke();
      y += rowHeight;
      doc.font(ROBOTO_REGULAR).fontSize(9).fillColor("#000000");
    }
  });
  
  // Vẽ border ngoài cho toàn bộ bảng (nếu có dữ liệu)
  // Chỉ vẽ border ngoài cho phần bảng trên trang hiện tại
  if (data.length > 0 && y > currentTableStartY) {
    doc
      .strokeColor("#1e40af")
      .lineWidth(1)
      .rect(startX, tableStartY, totalWidth, y - tableStartY)
      .stroke();
  }

  return y;
};