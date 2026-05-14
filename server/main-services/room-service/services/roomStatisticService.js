import ExcelJS from "exceljs";
import PDFDocument from "pdfkit";

import { BOOKING_EVENTS } from "../../../shared/events/bookingEvents.js";

import { safeForEach, parseRange, getWeekRange, getMonthRange, getRange } 
    from "../../../shared/config/excel.js";
import { ROBOTO_BOLD, ROBOTO_REGULAR } from "../../../shared/config/pdf.js";
import { formatCurrency, formatDate, addFooter, addHeader, addTable } 
    from "../../../shared/config/pdf.js";

export class RoomStatisticService {
    constructor({ Room, RoomCategory, RoomLog, DefaultEquipment, eventBus }) {
        this.Room = Room;
        this.RoomCategory = RoomCategory;
        this.RoomLog = RoomLog;
        this.DefaultEquipment = DefaultEquipment;
        this.eventBus = eventBus;
    }

    // return summary count of rooms in each status and total
    getRoomStatusSummary = async () => {
        try {
            const result = await this.Room.aggregate([
                {
                    $group: {
                    _id: "$room_status",
                    count: { $sum: 1 },
                    },
                },
            ]);
        
            const summary = {
                new: 0,
                available: 0,
                booked: 0,
                occupied: 0,
                cleaning: 0,
                maintenance: 0,
                reserved: 0,
                total: 0,
            };
        
            result.forEach(item => {
                summary[item._id] = item.count;
                summary.total += item.count;
            });
        
            return summary;
        
        } catch (error) {
            console.log("Error in getRoomStatusSummary:", error);
            throw error;
        }
    };

    getTopBookedRoomCategories = async (query = {}) => {
        try {
            const reply = await this.eventBus.safeRequest(
                BOOKING_EVENTS.GET_TOP_BOOKED_ROOM_CATEGORIES,
                query
            );
            if (!reply.success) throw new Error(reply.message);

            const bookingStats = reply.result;
            if (!bookingStats?.length) return { result: [] };

            const roomIds = bookingStats.map(b => b.room_id);
            const rooms = await this.Room.find(
                { _id: { $in: roomIds } },
                { category_id: 1 }
            ).lean();

            const categoryTotals = new Map();
            for (const { room_id, totalBooked } of bookingStats) {
                const room = rooms.find(r => r._id.toString() === room_id.toString());
                if (!room) continue;

                const key = room.category_id.toString();
                categoryTotals.set(key, (categoryTotals.get(key) || 0) + totalBooked);
            }

            const categoryIds = [...categoryTotals.keys()];
            const categories = await this.RoomCategory.find(
                { _id: { $in: categoryIds } },
                { category_name: 1, price: 1 }
            ).lean();

            const result = categories
                .map(c => ({
                    category_id: c._id,
                    name: c.category_name,
                    price: c.price,
                    totalBooked: categoryTotals.get(c._id.toString()),
                }))
                .sort((a, b) => b.totalBooked - a.totalBooked);

            return result;

        } catch (error) {
            console.log(error);
            throw error;
        }
    };
    
    // getTopBookedRoomCategories = async (query = {}) => {
    //     try {
    //         const limit = parseInt(query.limit, 10) || 5;
        
    //         const result = await this.BookingDetail.aggregate([
    //         // join sang Room
    //         {
    //             $lookup: {
    //             from: "rooms",
    //             localField: "room_id",
    //             foreignField: "_id",
    //             as: "room",
    //             },
    //         },
    //         { $unwind: "$room" },
        
    //         // group theo category
    //         {
    //             $group: {
    //             _id: "$room.category_id",
    //             totalBooked: { $sum: 1 },
    //             },
    //         },
        
    //         // sort giảm dần
    //         { $sort: { totalBooked: -1 } },
        
    //         // limit
    //         { $limit: limit },
        
    //         // join sang RoomCategory
    //         {
    //             $lookup: {
    //             from: "roomcategories",
    //             localField: "_id",
    //             foreignField: "_id",
    //             as: "category",
    //             },
    //         },
    //         { $unwind: "$category" },
        
    //         // kết quả trả về cúi cùm
    //         {
    //             $project: {
    //             _id: 0,
    //             category_id: "$_id",
    //             name: "$category.category_name",
    //             price: "$category.price",
    //             totalBooked: 1,
    //             },
    //         },
    //         ]);
        
    //         return { result };
        
    //     } catch (error) {
    //         console.log(error);
    //         throw error;
    //     }
    // };
    
    getLatestStatusOfAllRooms = async () => {
        return await this.RoomLog.aggregate([
            {
            $sort: {
                room_id: 1,
                start_time: -1,
            },
            },
        
            // gom theo phòng, lấy bản ghi đầu tiên
            {
            $group: {
                _id: "$room_id",
                latestStatus: { $first: "$$ROOT" },
            },
            },
        
            // trả về document gốc
            {
            $replaceRoot: { newRoot: "$latestStatus" },
            },
        
            // populate phòng
            {
            $lookup: {
                from: "rooms",
                localField: "room_id",
                foreignField: "_id",
                as: "room",
            },
            },
            {
            $unwind: {
                path: "$room",
                preserveNullAndEmptyArrays: true,
            },
            },
        ]);
    };

    getCalendarRooms = async (query = {}) => {
        try {
            const { date, floor, category_id } = query;
            if (!date) throw new Error("Thiếu ngày xem lịch");

            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const toIdStr = (id) => (id?._id || id)?.toString();

            // rooms
            const roomFilter = {};
            if (floor) roomFilter.floor = Number(floor);
            if (category_id) roomFilter.category_id = category_id;

            const rooms = await this.Room.find(roomFilter)
                .select("room_number category_id floor")
                .populate("category_id", "category_name")
                .lean();

            const roomIds = rooms.map(r => r._id);

            // fetch room logs
            const statusLogs = await this.RoomLog.find({
                room_id: { $in: roomIds },
                start_time: { $lte: endOfDay },
                $or: [
                    { end_time: { $gte: startOfDay } },
                    { end_time: null }
                ],
                status: { $ne: "available" }
            })
                .populate("room_id", "room_number")
                .sort({ start_time: 1 })
                .lean();

            // fetch booking data from booking-service
            const reply = await this.eventBus.safeRequest(
                BOOKING_EVENTS.GET_CALENDAR_DATA,
                { 
                    roomIds, 
                    startOfDay, 
                    endOfDay 
                }
            );

            if (!reply.success) {
                throw new Error(`Không thể lấy dữ liệu booking: ${reply.message}`);
            }

            const { bookingDetails, bookings } = reply;

            // build lookup maps
            const bookingMap = Object.fromEntries(
                bookings.map(b => [b._id.toString(), b])
            );

            const bookingDetailMap = {};
            bookingDetails.forEach(detail => {
                const roomIdStr = toIdStr(detail.room_id);
                if (!bookingDetailMap[roomIdStr]) bookingDetailMap[roomIdStr] = [];
                bookingDetailMap[roomIdStr].push(detail);
            });

            // match booking to log 
            const findBookingForLog = (log) => {
                if (log.booking_id) {
                    return bookingMap[toIdStr(log.booking_id)] || null;
                }

                // cleaning/maintenance — find most recent completed booking for this room
                const details = bookingDetailMap[toIdStr(log.room_id)] || [];
                let closestBooking = null;
                let smallestGap = Infinity;

                for (const detail of details) {
                    const booking = bookingMap[toIdStr(detail.booking_id)];
                    if (!booking) continue;
                    if (["cancelled", "expired"].includes(booking.status)) continue;

                    const checkout = new Date(detail.actual_checkout || detail.expected_checkout);
                    if (!checkout) continue;

                    if (checkout <= log.start_time) {
                        const gap = log.start_time.getTime() - checkout.getTime();
                        if (gap < 24 * 60 * 60 * 1000 && gap < smallestGap) {
                            smallestGap = gap;
                            closestBooking = booking;
                        }
                    }
                }

                return closestBooking;
            };

            // build events
            const STATUS_META = {
                reserved:    "Chờ cọc",
                booked:      "Đã cọc",
                occupied:    "Đang ở",
                cleaning:    "Dọn dẹp",
                maintenance: "Bảo trì",
            };

            const events = statusLogs.map(log => {
                const booking = findBookingForLog(log);

                return {
                    _id: log._id,
                    room_id: toIdStr(log.room_id),
                    room_number: log.room_id?.room_number,
                    start: log.start_time,
                    end: log.end_time || booking?.expected_checkout || endOfDay,
                    status: log.status,
                    title: STATUS_META[log.status] || log.status,
                    note: log.note || "",
                    booking: booking ? {
                        booking_id:     booking._id,
                        booking_code:   booking._id.toString().slice(-6).toUpperCase(),
                        booking_status: booking.status,
                        customer_id:    booking.customer_id,
                        customer_name:  booking.customer_info?.full_name || "Khách vãng lai",
                        customer_phone: booking.customer_info?.phone_number || "",
                        customer_cccd:  booking.customer_info?.CCCD || ""
                    } : null
                };
            });

            return { rooms, events };

        } catch (error) {
            console.error("getCalendarRooms error:", error);
            throw error;
        }
    }

    generateRoomReport = async (from, to) => {
        try {
            const { start, end } = parseRange(from, to);

            const rooms = await this.Room.find().populate("category_id", "category_name").lean();
            const logs = await this.RoomLog.find({
                start_time: { $lt: end },
                $or: [
                    { 
                        end_time: { $gte: start } 
                    }, 
                    { 
                        end_time: null 
                    }
                ]
            }).sort({ room_id: 1, start_time: 1 }).lean();

            const roomStats = {};

            rooms.forEach(r => {
                roomStats[r._id.toString()] = {
                    room_number: r.room_number,
                    category: r.category_id?.category_name || "N/A",
                    usage_count: 0,
                    occupied_hours: 0,
                    reserved_hours: 0,
                    booked_hours: 0,
                    maintenance_hours: 0,
                    cleaning_hours: 0
                };
            });

            for (const log of logs) {
                const roomId = log.room_id.toString();
                if (!roomStats[roomId]) continue;

                const logStart = new Date(Math.max(new Date(log.start_time), start));
                const logEnd = new Date(log.end_time ? Math.min(new Date(log.end_time), end) : end);
                const hours = Math.max((logEnd - logStart) / 36e5, 0);

                switch (log.status) {
                    case "reserved": roomStats[roomId].reserved_hours += hours; break;
                    case "booked": roomStats[roomId].booked_hours += hours; break;
                    case "occupied":
                        roomStats[roomId].occupied_hours += hours;
                        roomStats[roomId].usage_count += 1;
                        break;
                    case "maintenance": roomStats[roomId].maintenance_hours += hours; break;
                    case "cleaning": roomStats[roomId].cleaning_hours += hours; break;
                }
            }

            const roomPerformance = Object.values(roomStats);
            const occupiedRooms = roomPerformance.filter(r => r.occupied_hours > 0).length;

            return {
                meta: { from: start, to: end, generated_at: new Date() },
                summary: {
                    total_rooms: rooms.length,
                    occupied_rooms: occupiedRooms,
                    maintenance_rooms: roomPerformance.filter(r => r.maintenance_hours > 0).length,
                    cleaning_rooms: roomPerformance.filter(r => r.cleaning_hours > 0).length,
                    occupancy_rate: rooms.length ? Number(((occupiedRooms / rooms.length) * 100).toFixed(2)) : 0,
                    total_occupied_hours: Number(roomPerformance.reduce((s, r) => s + r.occupied_hours, 0).toFixed(2))
                },
                tables: { room_performance: roomPerformance },
                charts: {
                    room_status_distribution: [
                        { label: "Đang dùng", value: occupiedRooms },
                        { label: "Bảo trì", value: roomPerformance.filter(r => r.maintenance_hours > 0).length },
                        { label: "Trống/Khác", value: rooms.length - occupiedRooms }
                    ],
                    top_used_rooms: roomPerformance.sort((a,b) => b.occupied_hours - a.occupied_hours).slice(0, 5).map(r => ({ room: r.room_number, hours: Number(r.occupied_hours.toFixed(1)) }))
                }
            };
        } catch (error) {
            console.log("Error in generating room report service: ", error.message);
            throw error;
        }
    };

    exportRoomReportExcel = async (from, to) => {
        try {
            const report = await this.generateRoomReport(from, to);
        
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
        
            return workbook;

        } catch (err) {
            console.error("Excel Room Error:", err);
            throw err;
        }
    };

    exportRoomReportPDF = async (from, to) => {
        try {
            const report = await this.generateRoomReport(from, to);
            const doc = new PDFDocument({ margin: 50, size: "A4" });
            
            // Register fonts
            doc.registerFont("Roboto-Regular", ROBOTO_REGULAR);
            doc.registerFont("Roboto-Bold", ROBOTO_BOLD);

            doc.on("pageAdded", () => {
                addFooter(doc);
            });

            // Header
            addHeader(doc, "BÁO CÁO VẬN HÀNH PHÒNG");
            doc
                .font(ROBOTO_REGULAR)
                .fontSize(10)
                .fillColor("#333333")
                .text(
                    `Thời gian: ${formatDate(report.meta?.from)} - ${formatDate(report.meta?.to)}`,
                    50,
                    120,
                    { align: "center" }
                )
                .moveDown(1);

            // Summary section với format đẹp
            doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("1. TỔNG QUAN", 50, 160);
            doc.fontSize(10).font(ROBOTO_REGULAR).fillColor("#000000");
            
            const summaryData = [
                { label: "Tổng số phòng", value: report.summary?.total_rooms || 0 },
                { label: "Phòng đang sử dụng", value: report.summary?.occupied_rooms || 0 },
                { label: "Phòng bảo trì", value: report.summary?.maintenance_rooms || 0 },
                { label: "Phòng đang dọn dẹp", value: report.summary?.cleaning_rooms || 0 },
                { label: "Tỷ lệ lấp phòng (%)", value: (report.summary?.occupancy_rate || 0).toFixed(2) },
                { label: "Tổng giờ sử dụng phòng", value: (report.summary?.total_occupied_hours || 0).toFixed(2) },
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

            // Room performance table
            doc.addPage();
            doc.fontSize(12).font(ROBOTO_BOLD).fillColor("#1e40af").text("2. HIỆU SUẤT PHÒNG", 50, 50);
            
            const roomData = (report.tables?.room_performance || []).map((r) => ({
                room_number: r.room_number || "N/A",
                category: r.category || "N/A",
                usage_count: r.usage_count || 0,
                occupied_hours: Number((r.occupied_hours || 0).toFixed(2)),
                maintenance_hours: Number((r.maintenance_hours || 0).toFixed(2)),
            }));

            addTable(doc, roomData, [
                { header: "Phòng", key: "room_number", width: 80, align: "center" },
                { header: "Loại phòng", key: "category", width: 140 },
                { header: "Số lần sử dụng", key: "usage_count", width: 110, align: "center" },
                { header: "Giờ sử dụng", key: "occupied_hours", width: 110, align: "right" },
                { header: "Giờ bảo trì", key: "maintenance_hours", width: 110, align: "right" },
            ], 80, true);

            doc.end();
            return doc;

        } catch (err) {
            console.error("PDF Room Error:", err);
            throw err;
        }
    };
}