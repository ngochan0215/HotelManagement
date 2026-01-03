import React, { useEffect, useState } from "react";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import { roomApi } from "../../api/roomApi.js";
import { bookingApi } from "../../api/bookingApi.js";
import { statisticsApi } from "../../api/statisticApi.js";

import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend
} from "recharts";
import "../components/dashboard.css";

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [bookingStats, setBookingStats] = useState(null);
  const [roomStatus, setRoomStatus] = useState(null);
  const [topRoomTypes, setTopRoomTypes] = useState([]);
  const [cancelReasons, setCancelReasons] = useState([]);

  useEffect(() => {
    const fetchRoomStatus = async () => {
      try {
        const data = await roomApi.getRoomStatusSummary();
        setRoomStatus(data);
      } catch (error) {
        alert("Lỗi: " + (error.response?.data?.message || error.message));
      }
    };

    const fetchTopRoomTypes = async () => {
      try {
        const data = await roomApi.getTopRoomTypes(5);
        setTopRoomTypes(data);
      } catch (error) {
        alert("Lỗi: " + (error.response?.data?.message || error.message));
      }
    };

    const fetchCancelReasons = async () => {
      try {
        const data = await bookingApi.getCancellationReasonStats();

        // tổng số lần hủy
        const total = data.reduce((sum, item) => sum + item.total, 0);

        // map về đúng format PieChart đang dùng
        const chartData = data.map(item => ({
          label: item.reason_label,
          value: Math.round((item.total / total) * 100),
        }));

        setCancelReasons(chartData);
      } catch (error) {
        alert("LỖI: " + (error.response?.data?.message || error.message));
      }
    }

    const fetchWeeklyRevenue = async () => {
      const data = await statisticsApi.getWeeklyRevenue();
      setOverview(data);
    };

    const fetchWeeklyBookings = async () => {
      const data = await statisticsApi.getWeeklyBookings();
      setBookingStats(data);
    };

    fetchWeeklyBookings();
    fetchWeeklyRevenue();
    fetchRoomStatus();
    fetchTopRoomTypes();
    fetchCancelReasons();

    // const mockOverview = {
    //   revenue: 7852000,
    //   revenueChangePercent: 2.1,
    //   revenueChart: [
    //     { day: "01", current: 110, lastWeek: 130 },
    //     { day: "02", current: 120, lastWeek: 145 },
    //     { day: "03", current: 105, lastWeek: 125 },
    //     { day: "04", current: 135, lastWeek: 160 },
    //     { day: "05", current: 115, lastWeek: 140 },
    //     { day: "06", current: 145, lastWeek: 170 },
    //     { day: "07", current: 165, lastWeek: 140 },
    //   ],
    //   // cancelReasons: [
    //   //   { label: "Đổi lịch trình", value: 40 },
    //   //   { label: "Bận nhầm", value: 32 },
    //   //   { label: "Lý do khác", value: 28 },
    //   // ],
    //   // topRoomTypes: [
    //   //   { name: "Phòng VIP Hướng Biển", price: 1200000 },
    //   //   { name: "Phòng Deluxe Đôi", price: 950000 },
    //   //   { name: "Phòng Standard", price: 650000 },
    //   //   { name: "Phòng Suite Cao Cấp", price: 1800000 },
    //   // ],
    // };

    // const mockBookingStats = {
    //   total: 2568,
    //   percentChange: 2.1,
    //   chart: [
    //     { day: "01", current: 120, lastWeek: 130 },
    //     { day: "02", current: 140, lastWeek: 150 },
    //     { day: "03", current: 125, lastWeek: 145 },
    //     { day: "04", current: 155, lastWeek: 170 },
    //     { day: "05", current: 135, lastWeek: 155 },
    //     { day: "06", current: 170, lastWeek: 180 },
    //   ],
    // };

    //setOverview(mockOverview);
    //setBookingStats(mockBookingStats);
  }, []);

  if (!overview || !bookingStats || !roomStatus || !cancelReasons) 
    return <div className="p-6">Đang tải...</div>;

  const cancelColors = ["#3B82F6", "#F59E0B", "#94A3B8"];
  const roomStatusData = [
    { label: "Có khách", value: roomStatus.occupied, color: "#4F46E5" },
    { label: "Trống", value: roomStatus.available, color: "#10B981" },
    { label: "Sửa chữa", value: roomStatus.maintenance, color: "#EF4444" },
    { label: "Đang dọn dẹp", value: roomStatus.cleaning, color: "#3593c2ff" },
    { label: "Đã đặt trước", value: roomStatus.booked, color: "#f9d478ff" },
  ];
  const overviewCancelReasons = cancelReasons;

  return (
    <div className="dashboard-layout flex bg-gray-50 min-h-screen font-sans">
      <Sidebar />

      <div className="dashboard-content flex-1">
        <Topbar />

        <div className="p-6 space-y-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-6 border-l-4 border-indigo-600 pl-3">
            Bảng điều khiển
          </h1>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 lg:col-span-2">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Tổng Doanh thu</h2>
                  <p className="text-3xl font-extrabold text-gray-900 mt-2">
                    {overview.revenue.toLocaleString()} VND
                  </p>
                  <div className="flex items-center mt-2">
                    <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center">
                      ↑ {overview.revenueChangePercent}%
                    </span>
                    <span className="text-gray-500 text-sm ml-2">so với tuần trước</span>
                  </div>
                </div>
                <button className="px-4 py-2 bg-indigo-50 text-indigo-600 text-sm font-medium rounded-lg hover:bg-indigo-100 transition">
                  Xem chi tiết
                </button>
              </div>

              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={overview.revenueChart} barGap={8}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fill: '#6B7280'}} />
                    <Tooltip
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                      cursor={{fill: '#F3F4F6'}}
                    />
                    <Bar dataKey="current" name="Tuần này" fill="#4F46E5" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="lastWeek" name="Tuần trước" fill="#E5E7EB" radius={[4, 4, 0, 0]} barSize={20} />
                    <Legend iconType="circle" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h2 className="font-bold text-gray-700">Lý do hủy phòng</h2>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center relative">
                <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                    <Pie
                        data={overviewCancelReasons}
                        dataKey="value"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                    >
                        {overviewCancelReasons.map((_, i) => (
                        <Cell key={i} fill={cancelColors[i % cancelColors.length]} strokeWidth={0} />
                        ))}
                    </Pie>
                    <Tooltip />
                    </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-3 mt-2">
                  {overviewCancelReasons.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: cancelColors[i % cancelColors.length] }}></span>
                        <span className="text-gray-600">{item.label}</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: item.color }}>
                        {item.value}%
                      </span>

                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-6 text-lg border-b pb-2">Trạng thái phòng hiện tại</h3>

                <div className="flex items-center justify-between">
                    <div className="relative w-32 h-32">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                data={roomStatusData}
                                dataKey="value"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={2}
                                >
                                {roomStatusData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0}/>
                                ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col">
                            <span className="text-xs text-gray-400">Tổng</span>
                            <span className="text-xl font-bold text-gray-800">{roomStatus?.total}</span>
                        </div>
                    </div>

                    <div className="flex-1 ml-6 space-y-3">
                         {roomStatusData.map((item, i) => (
                           <div key={i} className="flex justify-between items-center">
                             <div className="flex items-center gap-2">
                               <span className="w-2.5 h-2.5 rounded-sm" style={{ background: item.color }}></span>
                               <span className="text-sm text-gray-600">{item.label}</span>
                             </div>
                             <span className="text-sm font-bold" style={{ color: item.color }}>
                              {Math.round((item.value / roomStatus.total) * 100)}%
                            </span>
                           </div>
                         ))}
                    </div>
                </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-700 mb-4">
                Loại phòng "Hot" nhất
              </h3>
              <ul className="space-y-4">
                {/* {overview.topRoomTypes.map((room, i) => (
                  <li key={i} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                        <span className="text-gray-400 font-bold text-lg">#{i + 1}</span>
                        <span className="text-gray-700 font-medium text-sm">{room.name}</span>
                    </div>
                    <span className="text-indigo-600 font-bold text-sm">{room.price.toLocaleString()} đ</span>
                  </li>
                ))} */}

                {topRoomTypes.map((room, i) => (
                  <li
                    key={i}
                    className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400 font-bold text-lg">#{i + 1}</span>
                      <span className="text-gray-700 font-medium text-sm">
                        {room.name}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="block text-indigo-600 font-bold text-sm">
                        {room.price.toLocaleString()} đ
                      </span>
                      <span className="text-xs text-gray-400">
                        {room.totalBooked} lượt đặt
                      </span>
                    </div>
                  </li>
                ))}

                              </ul>
                            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h2 className="font-bold text-gray-700">Lượt đặt phòng</h2>
                <span className="text-xs font-medium px-2 py-1 bg-red-100 text-red-600 rounded">
                   ↓ {bookingStats.percentChange}%
                </span>
              </div>

              <p className="text-2xl font-extrabold text-gray-900 mb-6">
                {bookingStats.total.toLocaleString()} <span className="text-sm font-normal text-gray-400">lượt</span>
              </p>

              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bookingStats.chart}>
                    <XAxis dataKey="day" hide />
                    <Tooltip />
                    <Line type="monotone" dataKey="current" stroke="#4F46E5" strokeWidth={3} dot={{r: 4}} activeDot={{r: 6}} />
                    <Line type="monotone" dataKey="lastWeek" stroke="#CBD5E1" strokeWidth={2} strokeDasharray="5 5" dot={false} />
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