import mongoose from "mongoose";
import { Receipt, Booking, ServiceUsage, CompensateTicket,
    EquipmentTicket, Room, RoomLog, BookingDetail,
    BookingStatusLog, Equipment, EquipmentLog, EquipmentInstall,
    EquipmentCategory, EquipmentImport, InstallDetail,
    Customer, Service, ServiceCategory, UsageDetail
 } from "../models/index.js";

// các hàm helper
const parseRange = (from, to) => {
    const start = from ? new Date(from) : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = to ? new Date(to) : new Date();
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
};
function getWeekRange(date) {
    const d = new Date(date);
    const day = d.getDay() || 7;
    const start = new Date(d);
    start.setDate(d.getDate() - day + 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
}

function getMonthRange(date) {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getRange(period) {
  const now = new Date();
  let start, end = new Date(now);

  if (period === "week") {
    const day = now.getDay() || 7;
    start = new Date(now);
    start.setDate(now.getDate() - day + 1);
  } else if (period === "month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now.getFullYear(), 0, 1);
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

// DOANH THU
// hàm lấy doanh thu theo tuần
export const getWeeklyRevenue = async (req, res) => {
  try {
    const now = new Date();
    const { start: currentStart, end: currentEnd } = getWeekRange(now);

    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(now.getDate() - 7);
    const { start: lastStart, end: lastEnd } = getWeekRange(lastWeekDate);

    const aggregateByDay = async (start, end) => {
      return Booking.aggregate([
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

    res.json({
      revenue: Math.round(totalCurrent * 1000),
      revenueChangePercent: Number(revenueChangePercent),
      revenueChart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi lấy doanh thu tuần: " + err.message });
  }
};

// thống kê tiền vào/ra/lợi nhuận theo tuần/tháng/năm
export const financeOverview = async (req, res) => {
  try {
    const period = req.query.period || "month";
    const { start, end } = getRange(period);

    const [bookingIn, serviceIn, equipmentOut, expenseOut] = await Promise.all([
      Booking.aggregate([
        { $match: { status: "completed", created_at: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$total_fee" } } }
      ]),
      ServiceUsage.aggregate([
        { $match: { status: "completed", created_at: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$total_fee" } } }
      ]),
      EquipmentTicket.aggregate([
        { $match: { status: "completed", created_at: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$total_fee" } } }
      ]),
      Expense.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ])
    ]);

    const totalIn = (bookingIn[0]?.total || 0) + (serviceIn[0]?.total || 0);
    const totalOut = (expenseOut[0]?.total || 0) + (equipmentOut[0]?.total || 0);

    res.json({
      period,
      totalIn,
      totalOut,
      profit: totalIn - totalOut
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Finance overview error" });
  }
};

// thống kê doanh thu theo nguồn
export const revenueBySource = async (req, res) => {
  try {
    const period = req.query.period || "month";
    const { start, end } = getRange(period);

    const [room, service] = await Promise.all([
      Booking.aggregate([
        { $match: { status: "completed", created_at: { $gte: start, $lte: end } } },
        { $group: { _id: "Booking", total: { $sum: "$total_fee" } } }
      ]),
      ServiceUsage.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: "Service", total: { $sum: "$total_fee" } } }
      ])
    ]);

    res.json([
      { source: "Room", total: room[0]?.total || 0 },
      { source: "Service", total: service[0]?.total || 0 }
    ]);
  } catch (err) {
    res.status(500).json({ message: "Revenue by source error" });
  }
};


// PHÒNG
// báo cáo phòng
export const roomOperationReport = async (from, to) => {
    const { start, end } = parseRange(from, to);

    const rooms = await Room.find().populate("category_id", "category_name").lean();
    const logs = await RoomLog.find({
        start_time: { $lt: end },
        $or: [{ end_time: { $gte: start } }, { end_time: null }]
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
};

export const getRoomOperationReport = async (req, res) => {
    try {
        const { from, to } = req.query;
        const report = await roomOperationReport(from, to);
        res.json(report);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi báo cáo phòng: " + err.message });
    }
};

// ĐẶT PHÒNG
// lấy lượt đặt phòng theo tuần
export const getWeeklyBookings = async (req, res) => {
  try {
    const now = new Date();

    const { start: curStart, end: curEnd } = getWeekRange(now);
    const lastWeekDate = new Date(now);
    lastWeekDate.setDate(now.getDate() - 7);
    const { start: lastStart, end: lastEnd } = getWeekRange(lastWeekDate);

    const aggregateCount = async (start, end) => {
      return Booking.aggregate([
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

    const percentChange =
      totalLast === 0 ? 100 : (((totalCurrent - totalLast) / totalLast) * 100).toFixed(1);

    res.json({
      total: totalCurrent,
      percentChange: Number(percentChange),
      chart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi lấy booking theo tuần" });
  }
};
// lấy lượt đặt phòng theo tháng
export const getMonthlyBookings = async (req, res) => {
  try {
    const now = new Date();

    const { start: curStart, end: curEnd } = getMonthRange(now);

    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const { start: lastStart, end: lastEnd } = getMonthRange(lastMonthDate);

    const aggregateCount = async (start, end) => {
      return Booking.aggregate([
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

    const percentChange =
      totalLast === 0 ? 100 : (((totalCurrent - totalLast) / totalLast) * 100).toFixed(1);

    res.json({
      total: totalCurrent,
      percentChange: Number(percentChange),
      chart
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Lỗi lấy booking theo tháng" });
  }
};

export const generateBookingReport = async (from, to) => {
  const start = new Date(from);
  const end = new Date(to);

  const bookings = await Booking.find({
    created_at: { $gte: start, $lte: end }
  }).lean();

  const bookingIds = bookings.map(b => b._id);

  const bookingDetails = await BookingDetail.find({
    booking_id: { $in: bookingIds }
  })
    .populate("room_id", "room_number")
    .lean();

  const statusLogs = await BookingStatusLog.aggregate([
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

  /* ====== BOOKINGS ====== */
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

  /* ====== ROOMS ====== */
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

export const getBookingReport = async (req, res) => {
  const { from, to } = req.query;
  const report = await generateBookingReport(from, to);
  res.json(report);
};

// THIẾT BỊ
export const generateEquipmentReport = async (from, to) => {
    const { start, end } = parseRange(from, to);

    const [categories, equipments, latestLogs] = await Promise.all([
        EquipmentCategory.find().lean(),
        Equipment.find().lean(),
        EquipmentLog.aggregate([
            { $sort: { start_time: -1 } },
            { $group: { _id: "$equipment_id", status: { $first: "$status" }, condition: { $first: "$condition" } } }
        ])
    ]);

    const categoryMap = Object.fromEntries(categories.map(c => [c._id.toString(), c]));
    const equipmentState = Object.fromEntries(latestLogs.map(l => [l._id.toString(), l]));

    const summary = { total_equipment: equipments.length, in_stock: 0, in_use: 0, maintenance: 0, lost: 0, total_asset_value: 0 };
    const byCategory = {};

    equipments.forEach(e => {
        const cat = categoryMap[e.category_id.toString()];
        const state = equipmentState[e._id.toString()];
        summary.total_asset_value += (cat?.price || 0);

        if (!byCategory[e.category_id]) {
            byCategory[e.category_id] = { category_name: cat?.name || "N/A", total: 0, in_use: 0, in_stock: 0, broken: 0 };
        }
        const row = byCategory[e.category_id];
        row.total++;

        const status = state?.status || "in-stock";
        if (status === "in-use") { summary.in_use++; row.in_use++; }
        else if (status === "maintenance") { summary.maintenance++; }
        else { summary.in_stock++; row.in_stock++; }
        if (state?.condition === "broken") row.broken++;
    });

    const maintenanceLogs = await EquipmentLog.find({
        condition: { $in: ["maintenance", "broken"] },
        start_time: { $gte: start, $lte: end }
    }).populate({ path: "equipment_id", populate: { path: "category_id", select: "name" } }).lean();

    return {
        meta: { from: start, to: end },
        summary,
        by_category: Object.values(byCategory),
        maintenance_report: maintenanceLogs.map(l => ({
            equipment_id: l.equipment_id?._id || "N/A",
            category: l.equipment_id?.category_id?.name || "N/A",
            condition: l.condition,
            start_time: l.start_time
        }))
    };
};

export const getEquipmentsReport = async (req, res) => {
    try {
        const { from, to } = req.query;
        const report = await generateEquipmentReport(from, to);
        res.json(report);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Lỗi báo cáo thiết bị: " + err.message });
    }
};
// DỊCH VỤ
export const generateServiceReport = async (from, to) => {

    const start = new Date(from);
    const end = new Date(to);

    const usageTickets = await ServiceUsage.find({
        created_at: { $gte: start, $lte: end }
    }).lean();

    const ticketIds = usageTickets.map(t => t._id);

    if (ticketIds.length === 0) {
        return {
            meta: { from, to, generated_at: new Date() },
            summary: {},
            tables: {},
            charts: {}
        };
    }

    // chi tiết phiếu dùng dịch vụ
    const usageDetails = await UsageDetail.find({
        ticket_id: { $in: ticketIds }
    })
        .populate({
            path: "service_id",
            populate: { path: "category_id", select: "name" }
        }).lean();

    // summary
    const summary = {
        total_orders: usageTickets.length,
        total_services_used: 0,
        total_revenue: 0
    };

    // option group by
    const byService = {};
    const byCategory = {};
    const byDay = {};
    const byRoom = {};

    usageDetails.forEach(d => {
        const service = d.service_id;
        if (!service) return;

        const serviceId = service._id.toString();
        const serviceName = service.name;
        const categoryName = service.category_id?.name || "Khác";

        const quantity = Number(d.storage_quantity || 1);
        const price = Number(d.price || service.price || 0);
        const revenue = quantity * price;

        summary.total_services_used += quantity;
        summary.total_revenue += revenue;

        // by service
        if (!byService[serviceId]) {
            byService[serviceId] = {
                service_id: serviceId,
                service_name: serviceName,
                category: categoryName,
                quantity: 0,
                revenue: 0
            };
        }
        byService[serviceId].quantity += quantity;
        byService[serviceId].revenue += revenue;

        // by category
        if (!byCategory[categoryName]) {
            byCategory[categoryName] = {
                category: categoryName,
                quantity: 0,
                revenue: 0,
            };
        }
        byCategory[categoryName].quantity += quantity;
        byCategory[categoryName].revenue += revenue;

        /* ---- by day ---- */
        const ticket = usageTickets.find(t => t._id.toString() === d.ticket_id.toString());
        if (ticket) {
            const day = ticket.created_at.toISOString().split("T")[0];
            if (!byDay[day]) {
                byDay[day] = { date: day, quantity: 0, revenue: 0 };
            }
            byDay[day].quantity += quantity;
            byDay[day].revenue += revenue;
        }
    });

    const totalCategoryRevenue = Object.values(byCategory)
        .reduce((s, c) => s + c.revenue, 0);

    const revenueByCategoryRatio = Object.values(byCategory).map(c => ({
        label: c.category,
        value: Number(((c.revenue / totalCategoryRevenue) * 100).toFixed(2))
    }));

    // const usageByCategoryRatio = Object.values(byCategory).map(c => ({
    //     label: c.category,
    //     value: c.quantity
    // }));

    const topRevenueCategory = Object.values(byCategory)
        .sort((a, b) => b.revenue - a.revenue)[0];

    const topUsageCategory = Object.values(byCategory)
        .sort((a, b) => b.quantity - a.quantity)[0];

    const sortedServices = Object.values(byService)
        .sort((a, b) => b.revenue - a.revenue);

    const topRevenueService = sortedServices[0];
    const topUsageService = Object.values(byService)
        .sort((a, b) => b.quantity - a.quantity)[0];

    const top3Revenue = sortedServices
        .slice(0, 3)
        .reduce((s, x) => s + x.revenue, 0);

    const revenueConcentration = summary.total_revenue === 0
        ? 0
        : Number(((top3Revenue / summary.total_revenue) * 100).toFixed(2));

    const servicePerformance = Object.values(byService).map(s => ({
        service_name: s.service_name,
        category: s.category,
        quantity: s.quantity,
        revenue: s.revenue,
        revenue_per_use:
            s.quantity === 0 ? 0 : Number((s.revenue / s.quantity).toFixed(2))
    }));

    return {
        meta: {
            from,
            to,
            generated_at: new Date()
        },
        summary: {
            ...summary,
            avg_order_value:
                summary.total_orders === 0
                ? 0
                : Number((summary.total_revenue / summary.total_orders).toFixed(2)),

            top_revenue_category: topRevenueCategory?.category || null,
            top_usage_category: topUsageCategory?.category || null,
            top_revenue_service: topRevenueService?.service_name || null,
            top_usage_service: topUsageService?.service_name || null,
            revenue_concentration: revenueConcentration
        },
        tables: {
            service_revenue: Object.values(byService),
            category_revenue: Object.values(byCategory),
            usage_by_day: Object.values(byDay),
            usage_by_room: Object.values(byRoom),
            service_performance: servicePerformance
        },
        charts: {
            revenue_by_category_ratio: revenueByCategoryRatio,
            top_services: Object.values(byService)
                .sort((a, b) => b.revenue - a.revenue)
                .slice(0, 5)
                .map(s => ({
                    label: s.service_name,
                    value: s.revenue
                })),
            revenue_trend: Object.values(byDay).map(d => ({
                date: d.date,
                value: d.revenue
        })),
        category_distribution: Object.values(byCategory).map(c => ({
            label: c.category,
            value: c.revenue
        }))
        }
    };
};

export const getServicesReport = async (req, res) => {
  const { from, to } = req.query;
  const report = await generateServiceReport(from, to);
  res.json(report);
};

// KHÁCH HÀNG
export const generateCustomerReport = async (from, to) => {
    const start = new Date(from);
    const end = new Date(to);

    const customers = await Customer.find().lean();

    const bookings = await Booking.find({
        created_at: { $gte: start, $lte: end }
    }).lean();

    const bookingIds = bookings.map(b => b._id);

    const statusLogs = await BookingStatusLog.aggregate([
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

    const summary = {
        total_customers: customers.length,
        active: 0,
        inactive: 0,
        banned: 0,
        new_customers: 0,
        total_booking: bookings.length,
        total_revenue: 0
    };

    customers.forEach(c => {
        if (c.status === "active") summary.active++;
        else if (c.status === "inactive") summary.inactive++;
        else if (c.status === "banned") summary.banned++;

        if (c.created_at >= start && c.created_at <= end) {
            summary.new_customers++;
        }
    });

    // map booking to customer
    const customerStats = {};

    bookings.forEach(b => {
        const cid = b.customer_id.toString();
        if (!customerStats[cid]) {
            customerStats[cid] = {
                total_booking: 0,
                completed: 0,
                cancelled: 0,
                revenue: 0,
                last_booking: b.created_at
            };
        }

        const status = statusMap[b._id.toString()] || "pending";

        customerStats[cid].total_booking++;
        if (b.created_at > customerStats[cid].last_booking)
            customerStats[cid].last_booking = b.created_at;

        if (status === "completed") {
            customerStats[cid].completed++;
            customerStats[cid].revenue += b.total_fee || 0;
            summary.total_revenue += b.total_fee || 0;
        }

        if (status === "cancelled") {
            customerStats[cid].cancelled++;
        }
    });
    
    // group by loyalty
    const byLoyalty = {};
    customers.forEach(c => {
        if (!byLoyalty[c.loyalty]) {
            byLoyalty[c.loyalty] = {
                loyalty: c.loyalty,
                customers: 0,
                revenue: 0
            };
        }

        byLoyalty[c.loyalty].customers++;
        byLoyalty[c.loyalty].revenue += customerStats[c._id]?.revenue || 0;
    });

    // group by frequency
    const byFrequency = {
        one_time: 0,
        returning: 0,
        loyal: 0
    };

    customers.forEach(c => {
        if (c.booking_count === 1) byFrequency.one_time++;
        else if (c.booking_count >= 2 && c.booking_count <= 3) byFrequency.returning++;
        else if (c.booking_count >= 4) byFrequency.loyal++;
    });

    // top customers
    const topCustomers = customers
        .map(c => ({
            customer_id: c._id,
            full_name: c.full_name,
            phone_number: c.phone_number,
            booking_count: c.booking_count,
            total_spent: customerStats[c._id]?.revenue || 0,
            last_booking: customerStats[c._id]?.last_booking || null
        }))
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 10);
    
    // track cancellation
    const cancellationReport = customers
        .map(c => {
            const stat = customerStats[c._id];
            if (!stat || stat.total_booking === 0) return null;

            return {
                customer_id: c._id,
                full_name: c.full_name,
                total_booking: stat.total_booking,
                cancelled: stat.cancelled,
                cancel_rate: Number(
                    ((stat.cancelled / stat.total_booking) * 100).toFixed(2)
                )
            };
        })
        .filter(Boolean);

    // group by age and nationality
    const byNationality = {};
    customers.forEach(c => {
        byNationality[c.nationality] = (byNationality[c.nationality] || 0) + 1;
    });

    const byAgeGroup = {
        "<18": 0,
        "18-25": 0,
        "26-35": 0,
        "36-50": 0,
        ">50": 0
    };

    const now = new Date();

    customers.forEach(c => {
        const age = Math.floor(
            (now - new Date(c.date_birth)) / (365 * 24 * 60 * 60 * 1000)
        );

        if (age < 18) byAgeGroup["<18"]++;
        else if (age <= 25) byAgeGroup["18-25"]++;
        else if (age <= 35) byAgeGroup["26-35"]++;
        else if (age <= 50) byAgeGroup["36-50"]++;
        else byAgeGroup[">50"]++;
    });

    return {
        meta: { from, to, generated_at: new Date() },
        summary,
        by_loyalty: Object.values(byLoyalty),
        by_frequency: byFrequency,
        top_customers: topCustomers,
        cancellation_report: cancellationReport,
        by_nationality: Object.entries(byNationality).map(([k, v]) => ({
            nationality: k,
            customers: v
        })),
        by_age_group: Object.entries(byAgeGroup).map(([k, v]) => ({
            age_group: k,
            customers: v
        }))
    };
};

export const getCustomersReport = async (req, res) => {
  const { from, to } = req.query;
  const report = await generateCustomerReport(from, to);
  res.json(report);
};

// SỰ CỐ