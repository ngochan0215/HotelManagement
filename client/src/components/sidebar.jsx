import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FiGrid, FiUser, FiUsers, FiKey, FiSettings,
  FiCalendar, FiFileText, FiBox, FiTag, FiAlertTriangle
} from "react-icons/fi";
import { FaBed } from "react-icons/fa";

const ACTIVE_BG = "bg-[#e6e8f6]";
const HOVER_BG = "hover:bg-[#d7daf2]";
const ACTIVE_TEXT = "text-[#4b55c6]";
const ICON_COLOR = "text-[#a2a8b3]";

const sidebarConfig = [
  { type: "main", title: "Bảng điều khiển", icon: FiGrid, path: "/dashboard" },
  { type: "main", title: "Lịch phòng", icon: FiCalendar, path: "/room-calendar" },

  {
    type: "group",
    title: "Quản lý",
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
    title: "Báo cáo thống kê",
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
        group flex items-center rounded-xl transition-all duration-150 text-sm
        ${isMain ? "px-4 py-3" : "pl-4 pr-4 py-2"}
        ${isActive ? `${ACTIVE_BG} ${ACTIVE_TEXT} font-medium` : `text-slate-600 ${ICON_COLOR} ${HOVER_BG}`}
      `}
    >
      <Icon
        size={16}
        className={`mr-3 transition-all duration-150
        ${isActive ? ACTIVE_TEXT : ICON_COLOR}
        group-hover:text-[#4b55c6]`}
      />
      {item.name || item.title}
    </Link>
  );
};

export default function Sidebar() {
  return (
    <div className="sidebar w-[270px] min-h-screen bg-[#f7f7f9] border-r border-gray-200">

      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-6">
        <div className="w-10 h-10 rounded-full bg-[#4b55c6] text-white flex items-center justify-center text-lg font-semibold">
          S
        </div>
        <span className="text-lg font-semibold text-[#4b55c6]">SE HOTEL</span>
      </div>

      {/* Navigation */}
      <nav className="px-3 mt-4">

        {/* Menu chính */}
        <div className="pb-3 border-b border-gray-200">
          {sidebarConfig
            .filter(section => section.type === "main")
            .map((item, i) => (
              <SidebarItem key={i} item={item} isMain={true} />
            ))}
        </div>

        {/* Nhóm Quản lý + Báo cáo */}
        {sidebarConfig
          .filter(section => section.type === "group")
          .map((section, i) => (
            <div key={i} className="mt-6 mb-2">
              <h3 className="text-sm font-semibold text-slate-400 mb-2 px-4">
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
