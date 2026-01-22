import React, { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from "recharts";
import {
    FiDownload, FiCalendar, FiDollarSign, FiUsers, FiBox, FiActivity, FiLayers, FiGrid
} from "react-icons/fi";

import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";

import { statisticApi } from "../../api/statisticApi.js";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#FF6B6B"];

export default function StatisticPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    to: format(new Date(), "yyyy-MM-dd"),
  });

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [dashboardData, setDashboardData] = useState({ revenue: null, bookings: null });

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [revRes, bookRes] = await Promise.all([
          statisticApi.getWeeklyRevenue(),
          statisticApi.getWeeklyBookings()
        ]);
        setDashboardData({ revenue: revRes, bookings: bookRes });
      } catch (error) {
        console.error("Dashboard error:", error);
      }
    };
    fetchDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === "overview") return;

    const fetchData = async () => {
      setLoading(true);
      try {
        let res;
        const params = { from: dateRange.from, to: dateRange.to };

        switch (activeTab) {
          case "room": res = await statisticApi.getRoomReport(params); break;
          case "booking": res = await statisticApi.getBookingReport(params); break;
          case "service": res = await statisticApi.getServiceReport(params); break;
          case "customer": res = await statisticApi.getCustomerReport(params); break;
          case "equipment": res = await statisticApi.getEquipmentReport(params); break;
          default: break;
        }
        setData(res);
      } catch (error) {
        console.error("Report error:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [activeTab, dateRange]);

  const handleExport = async () => {
    try {
      const params = { from: dateRange.from, to: dateRange.to };
      let typeMap = {
        room: 'room-operation',
        booking: 'booking',
        customer: 'customers',
        equipment: 'equipments',
        service: 'services'
      };

      const blob = await statisticApi.exportReportExcel(typeMap[activeTab], params);
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BaoCao_${activeTab}_${params.from}_${params.to}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      alert("Lỗi xuất file Excel");
    }
  };

  const TabButton = ({ id, label, icon: Icon }) => (
    <button
      onClick={() => { setActiveTab(id); setData(null); }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap ${
        activeTab === id
          ? "bg-white text-indigo-600 shadow-sm"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-300/50"
      }`}
    >
      <Icon size={16} /> {label}
    </button>
  );

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-[1600px] mx-auto space-y-6">
          <div className="flex flex-col xl:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                     Báo Cáo Thống Kê
                </h1>
                <p className="text-gray-500 text-sm mt-1">Theo dõi hiệu suất kinh doanh, vận hành và tài sản.</p>
            </div>
            <div className="bg-gray-200 p-1 rounded-xl flex gap-1 overflow-x-auto max-w-full no-scrollbar">
                <TabButton id="overview" label="Tổng quan" icon={FiActivity} />
                <TabButton id="booking" label="Đặt phòng" icon={FiCalendar} />
                <TabButton id="room" label="Phòng" icon={FiBox} />
                <TabButton id="service" label="Dịch vụ" icon={FiLayers} />
                <TabButton id="customer" label="Khách hàng" icon={FiUsers} />
                <TabButton id="equipment" label="Thiết bị" icon={FiGrid} />
            </div>
          </div>
          {activeTab !== "overview" && (
             <div className="flex justify-end animate-fade-in">
                <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
                    <span className="text-xs font-semibold text-gray-500 pl-2 uppercase">Giai đoạn:</span>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
                        <FiCalendar className="text-indigo-500" />
                        <input
                            type="date"
                            value={dateRange.from}
                            onChange={(e) => setDateRange({...dateRange, from: e.target.value})}
                            className="bg-transparent outline-none text-sm text-gray-700 font-medium w-32 cursor-pointer"
                        />
                        <span className="text-gray-400 font-bold">➝</span>
                        <input
                            type="date"
                            value={dateRange.to}
                            onChange={(e) => setDateRange({...dateRange, to: e.target.value})}
                            className="bg-transparent outline-none text-sm text-gray-700 font-medium w-32 cursor-pointer"
                        />
                    </div>
                    <div className="w-[1px] h-6 bg-gray-200 mx-1"></div>
                    <button
                        onClick={handleExport}
                        className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition shadow-sm"
                    >
                        <FiDownload /> Xuất Excel
                    </button>
                </div>
             </div>
          )}

          <div className="min-h-[500px]">
            {activeTab === "overview" ? (
                <OverviewTab data={dashboardData} />
            ) : (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-96 text-gray-400">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
                            Đang xử lý dữ liệu báo cáo...
                        </div>
                    ) : (
                        <>
                            {activeTab === "booking" && <BookingReportView data={data} />}
                            {activeTab === "room" && <RoomReportView data={data} />}
                            {activeTab === "service" && <ServiceReportView data={data} />}
                            {activeTab === "customer" && <CustomerReportView data={data} />}
                            {activeTab === "equipment" && <EquipmentReportView data={data} />}
                        </>
                    )}
                </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}


const OverviewTab = ({ data }) => {
  const { revenue, bookings } = data;
  if (!revenue || !bookings) return <div className="p-10 text-center text-gray-500">Đang tải dashboard...</div>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-start mb-6">
             <div>
                <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Doanh thu tuần này</h3>
                <div className="mt-2 flex items-baseline gap-3">
                    <span className="text-3xl font-black text-gray-800 tracking-tight">
                    {revenue.revenue?.toLocaleString()} đ
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${revenue.revenueChangePercent >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {revenue.revenueChangePercent > 0 && '+'}{revenue.revenueChangePercent}%
                    </span>
                </div>
             </div>
             <div className="p-3 bg-indigo-50 rounded-xl text-indigo-600"><FiDollarSign size={24}/></div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenue.revenueChart}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{fill: '#9CA3AF', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                <YAxis tickFormatter={(val) => `${val}k`} tick={{fill: '#9CA3AF', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip formatter={(val) => `${val.toLocaleString()}k`} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} />
                <Legend iconType="circle" />
                <Line type="monotone" dataKey="current" name="Tuần này" stroke="#4F46E5" strokeWidth={3} dot={{r: 4, strokeWidth: 0, fill: '#4F46E5'}} activeDot={{r: 6}} />
                <Line type="monotone" dataKey="lastWeek" name="Tuần trước" stroke="#E5E7EB" strokeWidth={3} strokeDasharray="0 0" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">Booking tuần này</h3>
                    <div className="mt-2 flex items-baseline gap-3">
                        <span className="text-3xl font-black text-gray-800 tracking-tight">
                        {bookings.total} đơn
                        </span>
                        <span className={`text-xs font-bold px-2 py-1 rounded-md ${bookings.percentChange >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {bookings.percentChange > 0 && '+'}{bookings.percentChange}%
                        </span>
                    </div>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl text-purple-600"><FiCalendar size={24}/></div>
            </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bookings.chart} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{fill: '#9CA3AF', fontSize: 12}} axisLine={false} tickLine={false} dy={10} />
                <YAxis tick={{fill: '#9CA3AF', fontSize: 12}} axisLine={false} tickLine={false} />
                <Tooltip cursor={{fill: '#f9fafb'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}} />
                <Legend iconType="circle" />
                <Bar dataKey="current" name="Tuần này" fill="#8B5CF6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="lastWeek" name="Tuần trước" fill="#E5E7EB" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

const RoomReportView = ({ data }) => {
  if (!data) return null;
  const { summary, charts, tables } = data;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatBox label="Tỉ lệ lấp đầy" value={`${summary.occupancy_rate}%`} color="bg-blue-50 text-blue-700" />
        <StatBox label="Tổng giờ sử dụng" value={summary.total_occupied_hours} color="bg-green-50 text-green-700" />
        <StatBox label="Phòng bảo trì" value={summary.maintenance_rooms} color="bg-red-50 text-red-700" />
        <StatBox label="Phòng đang dọn" value={summary.cleaning_rooms} color="bg-orange-50 text-orange-700" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <ChartCard title="Phân bổ trạng thái phòng">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={charts.room_status_distribution} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="label">
                  {charts.room_status_distribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 5 phòng hoạt động nhiều nhất (Giờ)">
             <ResponsiveContainer>
              <BarChart data={charts.top_used_rooms} layout="vertical" margin={{left: 20}}>
                <XAxis type="number" hide />
                <YAxis dataKey="room" type="category" width={60} tick={{fontWeight: 'bold'}} />
                <Tooltip cursor={{fill: '#f5f5f5'}} />
                <Bar dataKey="hours" fill="#3B82F6" radius={[0, 6, 6, 0]} barSize={24} />
              </BarChart>
             </ResponsiveContainer>
        </ChartCard>
      </div>

      <div className="border border-gray-100 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-700 text-sm uppercase">Chi tiết hiệu suất từng phòng</h3>
          </div>
          <div className="overflow-x-auto max-h-96">
            <table className="w-full text-sm text-left">
                <thead className="bg-white text-xs uppercase text-gray-500 sticky top-0 z-10 border-b">
                <tr>
                    <th className="px-6 py-3">Phòng</th>
                    <th className="px-6 py-3">Loại</th>
                    <th className="px-6 py-3 text-right">Giờ khách ở</th>
                    <th className="px-6 py-3 text-right">Số lượt thuê</th>
                    <th className="px-6 py-3 text-right text-red-600">Giờ bảo trì</th>
                </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                {tables.room_performance.map((room) => (
                    <tr key={room.room_number} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-3 font-bold text-gray-700">{room.room_number}</td>
                    <td className="px-6 py-3 text-gray-500">{room.category}</td>
                    <td className="px-6 py-3 text-right font-medium text-blue-600">{room.occupied_hours.toFixed(1)}</td>
                    <td className="px-6 py-3 text-right">{room.usage_count}</td>
                    <td className="px-6 py-3 text-right text-red-500">{room.maintenance_hours > 0 ? room.maintenance_hours.toFixed(1) : '-'}</td>
                    </tr>
                ))}
                </tbody>
            </table>
          </div>
      </div>
    </div>
  );
};

const BookingReportView = ({ data }) => {
    if (!data) return null;
    const { summary, tables } = data;

    return (
      <div className="space-y-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatBox label="Tổng đơn đặt" value={summary.total_bookings} color="bg-gray-50 text-gray-800" />
          <StatBox label="Hoàn thành" value={summary.completed} color="bg-green-50 text-green-800" />
          <StatBox label="Đã hủy" value={summary.cancelled} color="bg-red-50 text-red-800" />
          <StatBox label="Tỉ lệ hủy" value={`${summary.cancel_rate}%`} color="bg-orange-50 text-orange-700" />
        </div>

        <ChartCard title="Xu hướng đặt phòng & Doanh thu theo ngày">
            <ResponsiveContainer>
              <LineChart data={tables.booking_by_day}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={(t) => format(new Date(t), "dd/MM")} />
                  <YAxis yAxisId="left" label={{ value: 'Số đơn', angle: -90, position: 'insideLeft' }} />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => v/1000 + 'k'} />
                  <Tooltip labelFormatter={(t) => format(new Date(t), "dd/MM/yyyy")} formatter={(val, name) => [name === 'revenue' ? val.toLocaleString()+' đ' : val, name === 'revenue' ? 'Doanh thu' : 'Số đơn']} />
                  <Legend />
                  <Line yAxisId="left" type="step" dataKey="total_bookings" name="booking" stroke="#8884d8" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" name="revenue" stroke="#82ca9d" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
        </ChartCard>
      </div>
    );
  }

const ServiceReportView = ({ data }) => {
    if(!data) return null;
    const { summary, charts } = data;

    return (
        <div className="space-y-8">
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatBox label="Doanh thu dịch vụ" value={summary.total_revenue.toLocaleString() + ' đ'} color="bg-yellow-50 text-yellow-700" />
                <StatBox label="Số lượng đã dùng" value={summary.total_services_used} color="bg-blue-50 text-blue-700" />
                <StatBox label="Top Dịch Vụ (Doanh thu)" value={summary.top_revenue_service || '---'} color="bg-indigo-50 text-indigo-700" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ChartCard title="Top 5 Dịch vụ doanh thu cao nhất">
                     <ResponsiveContainer>
                        <BarChart data={charts.top_services} layout="vertical" margin={{left: 40}}>
                            <XAxis type="number" hide />
                            <YAxis dataKey="label" type="category" width={120} tick={{fontSize: 12}} />
                            <Tooltip formatter={(val) => val.toLocaleString() + ' đ'} />
                            <Bar dataKey="value" fill="#F59E0B" radius={[0,4,4,0]} barSize={20} />
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Tỉ trọng doanh thu theo loại">
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={charts.revenue_by_category_ratio} dataKey="value" nameKey="label" cx="50%" cy="50%" outerRadius={100} label>
                                {charts.revenue_by_category_ratio?.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>
            </div>
        </div>
    )
}

const CustomerReportView = ({ data }) => {
    if(!data) return null;
    const { top_customers } = data;
    return (
        <div className="space-y-6">
            <h3 className="font-bold text-lg text-gray-800">Top 10 Khách hàng VIP</h3>
            <div className="overflow-x-auto border border-gray-100 rounded-xl">
                <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 uppercase text-xs text-gray-600">
                        <tr>
                            <th className="px-6 py-4">Khách hàng</th>
                            <th className="px-6 py-4">SĐT</th>
                            <th className="px-6 py-4 text-center">Lượt đặt</th>
                            <th className="px-6 py-4 text-right">Tổng chi tiêu</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {top_customers.map(c => (
                            <tr key={c.customer_id} className="hover:bg-gray-50">
                                <td className="px-6 py-4 font-medium text-gray-800">{c.full_name}</td>
                                <td className="px-6 py-4 text-gray-500">{c.phone_number}</td>
                                <td className="px-6 py-4 text-center">
                                    <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-bold">{c.booking_count}</span>
                                </td>
                                <td className="px-6 py-4 text-right font-bold text-green-600">{c.total_spent.toLocaleString()} đ</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

const EquipmentReportView = ({ data }) => {
    if(!data) return null;
    const { summary, maintenance_report } = data;
    return (
         <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatBox label="Tổng giá trị Tài sản" value={summary.total_asset_value.toLocaleString()} color="bg-indigo-50 text-indigo-800" />
                <StatBox label="Đang sử dụng" value={summary.in_use} color="bg-green-50 text-green-800" />
                <StatBox label="Trong kho" value={summary.in_stock} color="bg-gray-100 text-gray-800" />
                <StatBox label="Hỏng/Bảo trì" value={summary.maintenance + summary.lost} color="bg-red-50 text-red-800" />
            </div>

            <div className="mt-8">
                <h3 className="font-bold text-lg mb-4 text-gray-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Danh sách thiết bị đang gặp sự cố
                </h3>
                {maintenance_report.length > 0 ? (
                    <div className="overflow-x-auto border border-gray-100 rounded-xl">
                        <table className="w-full text-sm text-left">
                             <thead className="bg-red-50 text-red-700 uppercase text-xs">
                                <tr>
                                    <th className="px-6 py-3">Mã TB</th>
                                    <th className="px-6 py-3">Loại</th>
                                    <th className="px-6 py-3">Tình trạng</th>
                                    <th className="px-6 py-3">Ngày bắt đầu</th>
                                </tr>
                             </thead>
                             <tbody className="divide-y divide-red-100">
                                 {maintenance_report.map((item, idx) => (
                                     <tr key={idx} className="hover:bg-red-50/50">
                                         <td className="px-6 py-3 font-mono text-gray-600">#{item.equipment_id.toString().slice(-6).toUpperCase()}</td>
                                         <td className="px-6 py-3">{item.category}</td>
                                         <td className="px-6 py-3 font-bold text-red-600 uppercase text-xs">{item.condition}</td>
                                         <td className="px-6 py-3 text-gray-500">{format(new Date(item.start_time), "dd/MM/yyyy HH:mm")}</td>
                                     </tr>
                                 ))}
                             </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="p-8 text-center bg-green-50 rounded-xl border border-green-100 text-green-700">
                        Hệ thống hoạt động tốt, không có thiết bị nào đang bảo trì.
                    </div>
                )}
            </div>
         </div>
    )
}

const StatBox = ({ label, value, color }) => (
  <div className={`p-5 rounded-2xl border border-transparent shadow-sm transition hover:shadow-md ${color}`}>
    <p className="text-xs font-bold uppercase tracking-wide opacity-70 mb-1">{label}</p>
    <p className="text-2xl font-extrabold">{value}</p>
  </div>
);

const ChartCard = ({ title, children }) => (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-gray-600 font-bold mb-6 text-sm uppercase text-center">{title}</h3>
        <div className="h-72 w-full">
            {children}
        </div>
    </div>
);