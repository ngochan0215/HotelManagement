import { CANCELLATION_REASON_LABELS } from "../constants/cancellationReason.js";
import { ROBOTO_BOLD, ROBOTO_REGULAR } from "../../../shared/config/pdf.js";
import { formatCurrency, formatDate, addFooter, addHeader, addTable } 
    from "../../../shared/config/pdf.js";
import { safeForEach, parseRange, getWeekRange, getMonthRange, getRange } 
  from "../../../shared/config/excel.js";

import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

export class BookingStatisticService {
    constructor({ Booking, BookingDetail, BookingStatusLog, BookingCancellation }) {
        this.Booking = Booking;
        this.BookingDetail = BookingDetail;
        this.BookingStatusLog = BookingStatusLog;
        this.BookingCancellation = BookingCancellation;
    }

    getCancellationReasonStats = async (query = {}) => {
        try {
            const { fromDate, toDate, cancelledBy } = query;
            const match = {};

            if (fromDate && isNaN(new Date(fromDate))) {
                throw new Error("Thời gian bắt đầu không hợp lệ.");
            }
            if (toDate && isNaN(new Date(toDate))) {
                throw new Error("Thời gian kết thúc không hợp lệ.");
            }

            if (fromDate || toDate) {
                match.cancelled_at = {};
                if (fromDate) match.cancelled_at.$gte = new Date(fromDate);
                if (toDate) match.cancelled_at.$lte = new Date(toDate);
            }

            const ALLOWED_CANCELLED_BY = ["user", "system", "admin"];
                if (cancelledBy && !ALLOWED_CANCELLED_BY.includes(cancelledBy)) {
                    throw new Error("Người thao tác Hủy phòng không hợp lệ.");
            }

            if (cancelledBy) {
                match.cancelled_by = cancelledBy;
            }

            const stats = await this.BookingCancellation.aggregate([
                { $match: match },
                {
                    $group: {
                    _id: "$reason",
                    total: { $sum: 1 },
                    },
                },
            ]);

            const result = Object.keys(CANCELLATION_REASON_LABELS).map(code => {
                const found = stats.find(s => s._id === code);
                return {
                    reason_code: code,
                    reason_label: CANCELLATION_REASON_LABELS[code],
                    total: found ? found.total : 0,
                };
            });

            return result;

        } catch (error) {
            console.log("Error while getting booking's cancellation reason statistics: ", error.message);
            throw error;
        }
    };
    
    getWeeklyRevenue = async () => {
        try {
            const now = new Date();
            const { start: currentStart, end: currentEnd } = getWeekRange(now);
        
            const lastWeekDate = new Date(now);
            lastWeekDate.setDate(now.getDate() - 7);
            const { start: lastStart, end: lastEnd } = getWeekRange(lastWeekDate);
        
            const aggregateByDay = async (start, end) => {
                return this.Booking.aggregate([
                    {
                        $match: {
                            status: "completed",
                            created_at: { $gte: start, $lte: end }
                        }
                    },
                    {
                        $group: {
                            _id: {
                            day: { $dayOfMonth: "$created_at" }
                            },
                            total: { $sum: "$total_fee" }
                        }
                    }
                ]);
            };
        
            const [currentWeek, lastWeek] = await Promise.all([
                aggregateByDay(currentStart, currentEnd),
                aggregateByDay(lastStart, lastEnd)
            ]);
        
            // map nhanh cho lookup
            const mapByDay = (arr) =>
            arr.reduce((acc, cur) => {
                acc[cur._id.day] = cur.total;
                return acc;
            }, {});
        
            const currentMap = mapByDay(currentWeek);
            const lastMap = mapByDay(lastWeek);
        
            let revenueChart = [];
            let totalCurrent = 0;
            let totalLast = 0;
        
            for (let i = 0; i < 7; i++) {
                const d = new Date(currentStart);
                d.setDate(currentStart.getDate() + i);
                const dayNumber = d.getDate();
            
                const currentValue = Math.round((currentMap[dayNumber] || 0) / 1000);
                const lastValue = Math.round((lastMap[
                    new Date(lastStart.getFullYear(), lastStart.getMonth(), lastStart.getDate() + i).getDate()
                ] || 0) / 1000);
            
                totalCurrent += currentValue;
                totalLast += lastValue;
        
                revenueChart.push({
                    day: String(dayNumber).padStart(2, "0"),
                    current: currentValue,
                    lastWeek: lastValue
                });
            }
        
            const revenueChangePercent =
            totalLast === 0 ? 100 : (((totalCurrent - totalLast) / totalLast) * 100).toFixed(1);
        
            return {
                revenue: Math.round(totalCurrent * 1000),
                revenueChangePercent: Number(revenueChangePercent),
                revenueChart
            };

        } catch (err) {
            console.log("Error in getting weekly revenue: ", err.message);
            throw err;
        }
    };

    getWeeklyBookings = async () => {
        try {
            const now = new Date();
        
            const { start: curStart, end: curEnd } = getWeekRange(now);
            const lastWeekDate = new Date(now);
            lastWeekDate.setDate(now.getDate() - 7);
            const { start: lastStart, end: lastEnd } = getWeekRange(lastWeekDate);
        
            const aggregateCount = async (start, end) => {
                return this.Booking.aggregate([
                    {
                        $match: {
                            status: { $in: ["confirmed", "completed"] },
                            created_at: { $gte: start, $lte: end }
                        }
                    },
                    {
                        $group: {
                            _id: { day: { $dayOfMonth: "$created_at" } },
                            total: { $sum: 1 }
                        }
                    }
                ]);
            };
        
            const [current, last] = await Promise.all([
                aggregateCount(curStart, curEnd),
                aggregateCount(lastStart, lastEnd)
            ]);
        
            const toMap = (arr) =>
            arr.reduce((acc, i) => {
                acc[i._id.day] = i.total;
                return acc;
            }, {});
        
            const curMap = toMap(current);
            const lastMap = toMap(last);
        
            let chart = [];
            let totalCurrent = 0;
            let totalLast = 0;
        
            for (let i = 0; i < 7; i++) {
                const curDate = new Date(curStart);
                curDate.setDate(curStart.getDate() + i);
            
                const lastDate = new Date(lastStart);
                lastDate.setDate(lastStart.getDate() + i);
            
                const curVal = curMap[curDate.getDate()] || 0;
                const lastVal = lastMap[lastDate.getDate()] || 0;
            
                totalCurrent += curVal;
                totalLast += lastVal;
            
                chart.push({
                    day: String(curDate.getDate()).padStart(2, "0"),
                    current: curVal,
                    lastWeek: lastVal
                });
            }
        
            const percentChange = totalLast === 0 ? 100 : (((totalCurrent - totalLast) / totalLast) * 100).toFixed(1);
        
            return {
                total: totalCurrent,
                percentChange: Number(percentChange),
                chart
            };

        } catch (err) {
            console.log("Error in getting weekly bookings: ", err.message);
            throw err;
        }
    };

    getMonthlyBookings = async () => {
      try {
        const now = new Date();
    
        const { start: curStart, end: curEnd } = getMonthRange(now);
        const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const { start: lastStart, end: lastEnd } = getMonthRange(lastMonthDate);
    
        const aggregateCount = async (start, end) => {
          return this.Booking.aggregate([
            {
              $match: {
                status: { $in: ["confirmed", "completed"] },
                created_at: { $gte: start, $lte: end }
              }
            },
            {
              $group: {
                _id: { day: { $dayOfMonth: "$created_at" } },
                total: { $sum: 1 }
              }
            }
          ]);
        };
    
        const [current, last] = await Promise.all([
          aggregateCount(curStart, curEnd),
          aggregateCount(lastStart, lastEnd)
        ]);
    
        const curMap = Object.fromEntries(current.map(i => [i._id.day, i.total]));
        const lastMap = Object.fromEntries(last.map(i => [i._id.day, i.total]));
    
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    
        let chart = [];
        let totalCurrent = 0;
        let totalLast = 0;
    
        for (let day = 1; day <= daysInMonth; day++) {
          const curVal = curMap[day] || 0;
          const lastVal = lastMap[day] || 0;
    
          totalCurrent += curVal;
          totalLast += lastVal;
    
          chart.push({
            day: String(day).padStart(2, "0"),
            current: curVal,
            lastMonth: lastVal
          });
        }
    
        const percentChange = totalLast === 0 ? 100 : 
            (((totalCurrent - totalLast) / totalLast) * 100).toFixed(1);
    
        return {
          total: totalCurrent,
          percentChange: Number(percentChange),
          chart
        };

      } catch (err) {
        console.log("Error in getting monthly booking: ", err.message);
        throw err;
      }
    };
    
    generateBookingReport = async (from, to) => {
      const start = new Date(from);
      const end = new Date(to);
    
      const bookings = await this.Booking.find({
        created_at: { $gte: start, $lte: end }
      }).lean();
    
      const bookingIds = bookings.map(b => b._id);
    
      const bookingDetails = await this.BookingDetail.find({
        booking_id: { $in: bookingIds }
      })
        .populate("room_id", "room_number")
        .lean();
    
      const statusLogs = await this.BookingStatusLog.aggregate([
        { $match: { booking_id: { $in: bookingIds } } },
        { $sort: { start_time: -1 } },
        {
          $group: {
            _id: "$booking_id",
            status: { $first: "$status" }
          }
        }
      ]);
    
      const statusMap = {};
      statusLogs.forEach(s => {
        statusMap[s._id.toString()] = s.status;
      });
    
      const bookingMap = {};
      bookings.forEach(b => {
        bookingMap[b._id.toString()] = b;
      });
    
      const summary = {
        total_bookings: bookings.length,
        completed: 0,
        cancelled: 0,
        active: 0,
        total_revenue: 0
      };
    
      const byDay = {};
      const byRoom = {};
    
      bookings.forEach(b => {
        const status = statusMap[b._id.toString()] || "pending";
    
        if (status === "completed") {
          summary.completed++;
          summary.total_revenue += b.total_fee || 0;
        } else if (status === "cancelled") {
          summary.cancelled++;
        } else {
          summary.active++;
        }
    
        const day = b.created_at.toISOString().split("T")[0];
        if (!byDay[day]) {
          byDay[day] = {
            date: day,
            total_bookings: 0,
            completed: 0,
            cancelled: 0,
            revenue: 0
          };
        }
    
        byDay[day].total_bookings++;
        if (status === "completed") {
          byDay[day].completed++;
          byDay[day].revenue += b.total_fee || 0;
        }
        if (status === "cancelled") byDay[day].cancelled++;
      });
    
      bookingDetails.forEach(d => {
        const booking = bookingMap[d.booking_id.toString()];
        if (!booking) return;
    
        const status = statusMap[d.booking_id.toString()] || "pending";
        const roomKey = d.room_id?.room_number || "Unknown";
    
        if (!byRoom[roomKey]) {
          byRoom[roomKey] = {
            room_number: roomKey,
            total_bookings: 0,
            completed_bookings: 0,
            cancelled_bookings: 0,
            revenue: 0
          };
        }
    
        byRoom[roomKey].total_bookings++;
        if (status === "completed") {
          byRoom[roomKey].completed_bookings++;
          byRoom[roomKey].revenue += booking.total_fee || 0;
        }
        if (status === "cancelled")
          byRoom[roomKey].cancelled_bookings++;
      });
    
      const cancelRate =
        summary.total_bookings === 0
          ? 0
          : Number(((summary.cancelled / summary.total_bookings) * 100).toFixed(2));
    
      console.log("SUMMARY:", summary);
    
      return {
        meta: { from, to, generated_at: new Date() },
        summary: {
          ...summary,
          cancel_rate: cancelRate,
          avg_booking_value:
            summary.completed === 0
              ? 0
              : Number((summary.total_revenue / summary.completed).toFixed(2))
        },
        tables: {
          booking_by_day: Object.values(byDay),
          booking_by_room: Object.values(byRoom)
        }
      };
    };

    exportBookingReportExcel = async (from, to) => {
      try {
        const report = await this.generateBookingReport(from, to);
      
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

        return wb;
    
      } catch (error) {
        console.log("Error in creating booking report excel file: ", error.message);
        throw error;
      }
    };

    exportBookingReportPDF = async (from, to) => {
      try {
        const report = await this.generateBookingReport(from, to);

        const doc = new PDFDocument({ margin: 50, size: "A4" });
        
        // Register fonts
        doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
        doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

        doc.on("pageAdded", () => {
          addFooter(doc);
        });

        // Header
        addHeader(doc, "BÁO CÁO ĐẶT PHÒNG");
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
          { label: "Tổng booking", value: report.summary?.total_bookings || 0 },
          { label: "Hoàn thành", value: report.summary?.completed || 0 },
          { label: "Hủy", value: report.summary?.cancelled || 0 },
          { label: "Đang hiệu lực", value: report.summary?.active || 0 },
          { label: "Tỷ lệ hủy (%)", value: (report.summary?.cancel_rate || 0).toFixed(2) },
          { label: "Doanh thu", value: formatCurrency(report.summary?.total_revenue || 0) },
          { label: "Giá trị booking TB", value: formatCurrency(report.summary?.avg_booking_value || 0) },
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

        // Booking by day
        doc.addPage();
        doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. BOOKING THEO NGÀY", 50, 50);
        
        const dayData = (report.tables?.booking_by_day || []).map((d) => ({
          date: formatDate(d.date),
          total_bookings: d.total_bookings || 0,
          completed: d.completed || 0,
          cancelled: d.cancelled || 0,
          revenue: formatCurrency(d.revenue || 0),
        }));

        addTable(doc, dayData, [
          { header: "Ngày", key: "date", width: 110 },
          { header: "Tổng booking", key: "total_bookings", width: 100, align: "center" },
          { header: "Hoàn thành", key: "completed", width: 100, align: "center" },
          { header: "Hủy", key: "cancelled", width: 80, align: "center" },
          { header: "Doanh thu", key: "revenue", width: 130, align: "right" },
        ], 80, true);

        // Booking by room
        doc.addPage();
        doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("3. BOOKING THEO PHÒNG", 50, 50);
        
        const roomData = (report.tables?.booking_by_room || []).map((r) => ({
          room_number: r.room_number || "N/A",
          total_bookings: r.total_bookings || 0,
          completed_bookings: r.completed_bookings || 0,
          cancelled_bookings: r.cancelled_bookings || 0,
          revenue: formatCurrency(r.revenue || 0),
        }));

        addTable(doc, roomData, [
          { header: "Phòng", key: "room_number", width: 80, align: "center" },
          { header: "Tổng booking", key: "total_bookings", width: 100, align: "center" },
          { header: "Hoàn thành", key: "completed_bookings", width: 110, align: "center" },
          { header: "Hủy", key: "cancelled_bookings", width: 80, align: "center" },
          { header: "Doanh thu", key: "revenue", width: 130, align: "right" },
        ], 80, true);

        doc.end();
        return doc;

      } catch (err) {
        console.error("PDF Booking Error:", err);
        throw err;
      }
    };
}