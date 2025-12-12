import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FiGrid, FiUser, FiUsers, FiKey, FiSettings,
  FiCalendar, FiFileText, FiBox, FiTag, FiAlertTriangle
} from "react-icons/fi";
import { FaBed } from "react-icons/fa";

const ACTIVE_BG = "bg-indigo-600";
const ACTIVE_TEXT = "text-white";
const NORMAL_TEXT = "text-gray-400";
const HOVER_BG = "hover:bg-gray-800 hover:text-white";

const sidebarConfig = [
  { type: "main", title: "Bảng điều khiển", icon: FiGrid, path: "/dashboard" },
  { type: "main", title: "Lịch phòng", icon: FiCalendar, path: "/room-calendar" },

  {
    type: "group",
    title: "QUẢN LÝ",
    children: [
      { name: "Phòng & Loại phòng", path: "/room-types", icon: FaBed },
      { name: "Quản lý đặt phòng", path: "/booking-management", icon: FiCalendar },
      { name: "Check-in / Check-out", path: "/checkin-checkout", icon: FiKey },
      { name: "Khách hàng", path: "/customers", icon: FiUser },
      { name: "Nhân viên", path: "/staff", icon: FiUsers },
      { name: "Thiết bị", path: "/equipment", icon: FiSettings },
      { name: "Thiết bị trong phòng", path: "/room-equipment", icon: FiSettings },
      { name: "Dịch vụ & Sản phẩm", path: "/services-products", icon: FiBox },
      { name: "Hóa đơn", path: "/invoices", icon: FiFileText },
      { name: "Khuyến mãi", path: "/promotions", icon: FiTag },
      { name: "Sự cố", path: "/incidents", icon: FiAlertTriangle },
    ],
  },

  {
    type: "group",
    title: "BÁO CÁO THỐNG KÊ",
    children: [
      { name: "Doanh thu", path: "/reports/revenue", icon: FiFileText },
      { name: "Phòng trống", path: "/reports/available-rooms", icon: FiFileText },
      { name: "Lợi nhuận", path: "/reports/profit", icon: FiFileText },
      { name: "Chi phí vận hành", path: "/reports/operational-costs", icon: FiFileText },
      { name: "Tỉ lệ lấp phòng", path: "/reports/occupancy-rate", icon: FiFileText },
      { name: "Khách hàng", path: "/reports/customers", icon: FiFileText },
      { name: "Sử dụng dịch vụ", path: "/reports/service-usage", icon: FiFileText },
      { name: "Hiệu suất nhân viên", path: "/reports/staff-performance", icon: FiFileText },
      { name: "Sự cố", path: "/reports/incidents", icon: FiFileText },
    ],
  },
];

const SidebarItem = ({ item, isMain }) => {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      className={`
        group flex items-center rounded-lg transition-all duration-200 text-sm mb-1
        ${isMain ? "px-4 py-3" : "pl-4 pr-4 py-2"}
        ${isActive ? `${ACTIVE_BG} ${ACTIVE_TEXT} font-semibold shadow-lg shadow-indigo-500/20` : `${NORMAL_TEXT} ${HOVER_BG}`}
      `}
    >
      <Icon
        size={isMain ? 20 : 18}
        className={`mr-3 transition-all duration-200
        ${isActive ? "text-white" : "text-gray-500 group-hover:text-white"}`}
      />
      {item.name || item.title}
    </Link>
  );
};

export default function Sidebar() {
  return (
    <div className="sidebar w-[270px] min-h-screen bg-[#111827] border-r border-gray-800 fixed left-0 top-0 overflow-y-auto z-50">

      <div className="sticky top-0 bg-[#111827] z-10 flex items-center gap-3 px-6 py-5 border-b border-gray-800">
        <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-indigo-500/50 shadow-md">
          S
        </div>
        <span className="text-xl font-bold text-white tracking-wide">SE HOTEL</span>
      </div>

      <nav className="px-3 py-4">
        <div className="pb-4 border-b border-gray-800 mb-4">
          {sidebarConfig
            .filter(section => section.type === "main")
            .map((item, i) => (
              <SidebarItem key={i} item={item} isMain={true} />
            ))}
        </div>

        {sidebarConfig
          .filter(section => section.type === "group")
          .map((section, i) => (
            <div key={i} className="mb-6">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-4">
                {section.title}
              </h3>

              {section.children.map((child, j) => (
                <SidebarItem key={j} item={child} isMain={false} />
              ))}
            </div>
          ))}
      </nav>
    </div>
  );
}