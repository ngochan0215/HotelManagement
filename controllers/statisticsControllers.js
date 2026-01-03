import mongoose from "mongoose";
import { Receipt, Booking, ServiceUsage, CompensateTicket,
    EquipmentTicket, Room, RoomStatusLog, BookingDetail,
    BookingStatusLog
 } from "../models/index.js";

// các hàm helper
function getWeekRange(date) {
  const d = new Date(date);
  const day = d.getDay() || 7; // CN = 7
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
  const start = new Date(from);
  const end = new Date(to);

  // load rooms + category
  const rooms = await Room.find()
    .populate("category_id", "category_name")
    .lean();

  // Load logs trong khoảng thời gian
  const logs = await RoomStatusLog.find({
    start_time: { $lt: end },
    $or: [
      { end_time: { $gte: start } },
      { end_time: null }
    ]
  })
    .sort({ room_id: 1, start_time: 1 })
    .lean();

  // khởi tạo status cho từng phòng
  const roomStats = {};
  rooms.forEach(r => {
    roomStats[r._id.toString()] = {
      room_number: r.room_number,
      category: r.category_id?.category_name,
      usage_count: 0,
      occupied_hours: 0,
      reserved_hours: 0,
      booked_hours: 0,
      maintenance_hours: 0,
      cleaning_hours: 0
    };
  });

  // tính thời gian theo từng status
  for (const log of logs) {
    const roomId = log.room_id.toString();

    if (!roomStats[roomId]) continue;

    const logStart = new Date(Math.max(log.start_time, start));
    const logEnd = new Date( log.end_time ? Math.min(log.end_time, end) : end );

    const hours = Math.max((logEnd - logStart) / 36e5, 0);

    switch (log.status) {
        case "reserved":
            roomStats[roomId].resered_hours += hours;
            break;
        case "booked":
            roomStats[roomId].booked_hours += hours;
            break;
        case "occupied":
            roomStats[roomId].occupied_hours += hours;
            roomStats[roomId].usage_count += 1;
            break;
        case "maintenance":
            roomStats[roomId].maintenance_hours += hours;
            break;
        case "cleaning":
            roomStats[roomId].cleaning_hours += hours;
            break;
    }
  }

  // mục tổng quan 
  const totalRooms = rooms.length;
  const totalOccupiedHours = Object.values(roomStats)
    .reduce((s, r) => s + r.occupied_hours, 0);

  const maintenanceRooms = Object.values(roomStats)
    .filter(r => r.maintenance_hours > 0).length;

  const occupiedRooms = Object.values(roomStats)
    .filter(r => r.occupied_hours > 0).length;

  const cleaningRooms = Object.values(roomStats)
    .filter(r => r.cleaning_hours > 0).length;

  const reservedRooms = Object.values(roomStats)
    .filter(r => r.reserved_hours > 0).length;

  const bookedRooms = Object.values(roomStats)
    .filter(r => r.booked_hours > 0).length;

  // hiệu suất sử dụng
  const dailyMap = {};
  logs.forEach(log => {
    if (log.status !== "occupied") return;

    let d = new Date(log.start_time);
    while (d <= (log.end_time || end)) {
      const key = d.toISOString().split("T")[0];
      dailyMap[key] = (dailyMap[key] || new Set());
      dailyMap[key].add(log.room_id.toString());
      d.setDate(d.getDate() + 1);
    }
  });

  const dailyOccupancy = Object.entries(dailyMap).map(([date, rooms]) => ({
    date,
    occupied_rooms: rooms.size,
    occupancy_rate: Number(((rooms.size / totalRooms) * 100).toFixed(2))
  }));

  // 7. Charts
  const statusDistribution = [
    { label: "Đang sử dụng", value: occupiedRooms },
    { label: "Bảo trì", value: maintenanceRooms },
    { label: "Khác", value: totalRooms - occupiedRooms - maintenanceRooms }
  ];

  const topRooms = Object.values(roomStats)
    .sort((a, b) => b.occupied_hours - a.occupied_hours)
    .slice(0, 5)
    .map(r => ({
      room: r.room_number,
      hours: Number(r.occupied_hours.toFixed(2))
    }));

  // 8. Final report
  return {
    meta: {
      from,
      to,
      generated_at: new Date()
    },
    summary: {
      total_rooms: totalRooms,
      occupied_rooms: occupiedRooms,
      maintenance_rooms: maintenanceRooms,
      cleaning_rooms: cleaningRooms,
      reserved_rooms: reservedRooms,
      booked_rooms: bookedRooms,
      occupancy_rate: Number(((occupiedRooms / totalRooms) * 100).toFixed(2)),
      total_occupied_hours: Number(totalOccupiedHours.toFixed(2)),
      avg_usage_hours_per_room: Number(
        (totalOccupiedHours / totalRooms).toFixed(2)
      )
    },
    tables: {
      room_performance: Object.values(roomStats),
      daily_occupancy: dailyOccupancy
    },
    charts: {
      room_status_distribution: statusDistribution,
      occupancy_trend: dailyOccupancy.map(d => ({
        date: d.date,
        value: d.occupancy_rate
      })),
      top_used_rooms: topRooms
    }
  };
};

export const getRoomOperationReport = async (req, res) => {
  const { from, to } = req.query;
  const report = await generateRoomOperationReport(from, to);
  res.json(report);
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
