import React, { useEffect, useState } from "react";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/Topbar.jsx";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import "../components/dashboard.css";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [bookingStats, setBookingStats] = useState(null);

  useEffect(() => {
    const mockOverview = {
      revenue: 7852000,
      revenueChangePercent: 2.1,
      revenueChart: [
        { day: "01", current: 110, lastWeek: 130 },
        { day: "02", current: 120, lastWeek: 145 },
        { day: "03", current: 105, lastWeek: 125 },
        { day: "04", current: 135, lastWeek: 160 },
        { day: "05", current: 115, lastWeek: 140 },
        { day: "06", current: 145, lastWeek: 170 },
        { day: "07", current: 165, lastWeek: 140 },
      ],
      cancelReasons: [
        { label: "Đổi lịch trình", value: 40 },
        { label: "Bận nhầm", value: 32 },
        { label: "Lý do khác", value: 28 },
      ],
      roomStatus: { empty: 15, busy: 79, repair: 6 },
      topRoomTypes: [
        { name: "Phòng VIP Hướng Biển", price: 1200000 },
        { name: "Phòng Deluxe Đôi", price: 950000 },
        { name: "Phòng Standard", price: 650000 },
        { name: "Phòng Suite Cao Cấp", price: 1800000 },
      ],
    };

    const mockBookingStats = {
      total: 2568,
      percentChange: 2.1,
      chart: [
        { day: "01", current: 120, lastWeek: 130 },
        { day: "02", current: 140, lastWeek: 150 },
        { day: "03", current: 125, lastWeek: 145 },
        { day: "04", current: 155, lastWeek: 170 },
        { day: "05", current: 135, lastWeek: 155 },
        { day: "06", current: 170, lastWeek: 180 },
      ],
    };

    setOverview(mockOverview);
    setBookingStats(mockBookingStats);
  }, []);

  if (!overview || !bookingStats)
    return <div className="p-6">Đang tải...</div>;

  const cancelColor = ["#6366F1", "#A5B4FC", "#E0E7FF"];
  const roomStatusData = [
    { label: "Có khách", value: 79, color: "#6366F1" },
    { label: "Trống", value: 15, color: "#A5B4FC" },
    { label: "Sửa chữa", value: 6, color: "#E0E7FF" },
  ];

  return (
    <div className="dashboard-layout flex bg-gray-100 min-h-screen">
      <Sidebar />

      <div className="dashboard-content flex-1 bg-[#fefefe]">
        <Topbar />

        <div className="p-6 space-y-6">
          <h1 className="text-2xl font-semibold mb-4">Bảng điều khiển</h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white p-6 rounded-xl shadow-md lg:col-span-2">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h2 className="font-semibold text-gray-700">Doanh thu</h2>
                  <p className="text-4xl font-bold text-gray-900">
                    {overview.revenue.toLocaleString()} VND
                  </p>
                  <p className="text-green-600 mt-1">
                    ↑ {overview.revenueChangePercent}% so với tuần trước
                  </p>
                </div>
                <button className="text-sm text-blue-600 hover:underline">
                  Xem báo cáo
                </button>
              </div>

              <div className="h-48 mt-4">
                {overview.revenueChart && overview.revenueChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={overview.revenueChart}>
                      <XAxis dataKey="day" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="current" fill="#6366F1" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="lastWeek" fill="#CBD5E1" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-gray-400">
                    Không có dữ liệu biểu đồ doanh thu
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-700">Lý do hủy phòng</h2>
                <button className="text-sm text-blue-600 hover:underline">
                  Xem báo cáo
                </button>
              </div>

              <div className="flex items-center justify-between">
                <PieChart width={200} height={200}>
                  <Pie
                    data={overview.cancelReasons}
                    dataKey="value"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                  >
                    {overview.cancelReasons.map((_, i) => (
                      <Cell key={i} fill={cancelColor[i]} />
                    ))}
                  </Pie>
                </PieChart>

                <div className="space-y-2 text-sm">
                  {overview.cancelReasons.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full"
                        style={{ background: cancelColor[i] }}
                      ></span>
                      <span>
                        {item.label}: {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

                     <div className="bg-white p-6 rounded-xl shadow-md flex flex-col items-center">
                       <h3 className="font-medium text-gray-700 mb-4 text-lg">Trạng thái phòng</h3>
                       <PieChart width={200} height={200}>
                         <Pie
                           data={roomStatusData}
                           dataKey="value"
                           nameKey="label"
                           innerRadius={60}
                           outerRadius={80}
                           paddingAngle={2}
                           isAnimationActive={false}
                         >
                           {roomStatusData.map((entry, index) => (
                             <Cell key={`cell-${index}`} fill={entry.color} />
                           ))}
                         </Pie>
                       </PieChart>
                       <div className="flex justify-center gap-6 mt-6 text-sm flex-wrap w-full">
                         {roomStatusData.map((item, i) => (
                           <span key={i} className="flex items-center gap-1">
                             <span
                               className="w-3 h-3 rounded-full"
                               style={{ background: item.color }}
                             ></span>
                             {item.label} {item.value}%
                           </span>
                         ))}
                       </div>
                     </div>

            <div className="bg-white p-5 rounded-xl shadow-md">
              <h3 className="font-medium text-gray-700 mb-4">
                Loại phòng được đặt nhiều nhất
              </h3>
              <ul className="space-y-3 text-gray-700">
                {overview.topRoomTypes.map((room, i) => (
                  <li key={i} className="flex justify-between border-b pb-2">
                    <span>{room.name}</span>
                    <span>{room.price.toLocaleString()} VND</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-700">Đặt phòng</h2>
                <button className="text-sm text-blue-600 hover:underline">
                  Xem báo cáo
                </button>
              </div>

              <p className="text-4xl font-bold">
                {bookingStats.total.toLocaleString()}
              </p>
              <p className="text-red-500 mb-4">
                ↓ {bookingStats.percentChange}% so với tuần trước
              </p>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bookingStats.chart}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="current"
                      stroke="#6366F1"
                      strokeWidth={3}
                    />
                    <Line
                      type="monotone"
                      dataKey="lastWeek"
                      stroke="#CBD5E1"
                      strokeWidth={3}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}