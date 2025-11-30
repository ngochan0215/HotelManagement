import React, { useEffect, useState } from "react";
import Sidebar from "../../../components/sidebar.jsx";
import { dashboardApi } from "../api/dashboardApi";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import "../components/dashboard.css";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [bookingStats, setBookingStats] = useState(null);

  useEffect(() => {
    dashboardApi.getOverview().then((res) => setOverview(res.data));
    dashboardApi.getBookingStats().then((res) => setBookingStats(res.data));
  }, []);

  if (!overview || !bookingStats) return <div className="p-6">Đang tải...</div>;

  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="dashboard-content p-6">
        <h1 className="text-2xl font-semibold mb-6">Bảng điều khiển</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white p-5 rounded-xl shadow">
            <h2 className="font-medium text-gray-600 mb-2">Doanh thu</h2>
            <p className="text-3xl font-bold text-gray-900">
              {overview.revenue.toLocaleString()} VND
            </p>
            <p className="text-green-600 mt-1">
              ↑ {overview.revenueChangePercent}% so với tuần trước
            </p>
          </div>

          <div className="bg-white p-5 rounded-xl shadow">
            <h2 className="font-medium text-gray-600 mb-2">Lý do hủy phòng</h2>

            <ul className="mt-4 space-y-2">
              {overview.cancelReasons.map((item, index) => (
                <li key={index} className="flex justify-between">
                  <span>{item.label}</span>
                  <span>{item.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow mb-6">
          <h2 className="font-medium text-gray-700 mb-4">Trạng thái phòng</h2>
          <div className="grid grid-cols-3 text-center">
            <div>
              <p className="text-3xl font-bold text-blue-500">
                {overview.roomStatus.empty}%
              </p>
              <p className="text-gray-600">Trống</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-orange-500">
                {overview.roomStatus.busy}%
              </p>
              <p className="text-gray-600">Có khách / Đặt trước</p>
            </div>
            <div>
              <p className="text-3xl font-bold text-cyan-500">
                {overview.roomStatus.repair}%
              </p>
              <p className="text-gray-600">Sửa chữa</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl shadow mb-6">
          <h2 className="font-medium text-gray-700 mb-4">
            Loại phòng được đặt nhiều nhất
          </h2>
          <ul className="space-y-2">
            {overview.topRoomTypes.map((room, index) => (
              <li key={index} className="flex justify-between">
                <span>{room.name}</span>
                <span>{room.price.toLocaleString()} VND</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white p-5 rounded-xl shadow">
          <h2 className="font-medium text-gray-700 mb-2">Đặt phòng</h2>
          <p className="text-2xl font-semibold">
            {bookingStats.total.toLocaleString()}
          </p>
          <p className="text-red-500">
            ↓ {bookingStats.percentChange}% so với tuần trước
          </p>

          <div className="h-64 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={bookingStats.chart}>
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="current"
                  stroke="#3b82f6"
                  strokeWidth={3}
                />
                <Line
                  type="monotone"
                  dataKey="lastWeek"
                  stroke="#cbd5e1"
                  strokeWidth={3}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
