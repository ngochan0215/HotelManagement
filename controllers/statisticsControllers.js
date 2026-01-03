import mongoose from "mongoose";
import { Receipt, Booking } from "../models/index.js";

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
