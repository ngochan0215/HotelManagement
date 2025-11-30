import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FiGrid, FiUser, FiUsers, FiKey, FiSettings,
  FiBriefcase, FiCalendar, FiFileText, FiBox
} from "react-icons/fi";
import { FaBed } from "react-icons/fa";
const ACTIVE_BG = "bg-[#e6e8f6]";
const HOVER_BG = "hover:bg-[#d7daf2]";
const ACTIVE_TEXT = "text-[#4b55c6]";
const ICON_COLOR = "text-[#a2a8b3]";
const sidebarConfig = [
  { type: "main", title: "Bảng điều khiển", icon: FiGrid, path: "/dashboard" },

  {
    type: "group",
    title: "Quản lý",
    children: [
      { name: "Khách hàng", path: "/customers", icon: FiUser },
      { name: "Nhân viên", path: "/staff", icon: FiUsers },
      { name: "Tài khoản", path: "/accounts", icon: FiKey },
    ],
  },

  {
    type: "group",
    title: "Phòng & Loại phòng",
    children: [
      { name: "Phòng & Loại phòng", path: "/room-types", icon: FaBed },
      { name: "Thiết bị", path: "/equipment", icon: FiSettings },
      { name: "Thiết bị trong phòng", path: "/room-equipment", icon: FiSettings },
      { name: "Phiếu nhập thiết bị", path: "/equipment-import", icon: FiBriefcase },
      { name: "Dịch vụ & sản phẩm", path: "/services-products", icon: FiCalendar },
      { name: "Phiếu nhập sản phẩm", path: "/product-import", icon: FiBriefcase },
      { name: "Phiếu đặt phòng", path: "/booking-forms", icon: FiUser },
      { name: "Hoá đơn", path: "/invoices", icon: FiFileText },
    ],
  },

  {
    type: "group",
    title: "Báo cáo thống kê",
    children: [
      { name: "Doanh thu", path: "/reports/revenue", icon: FiFileText },
      { name: "Thiết bị", path: "/reports/equipment", icon: FiFileText },
      { name: "Đặt phòng", path: "/reports/bookings", icon: FiFileText },
      { name: "Huỷ phòng", path: "/reports/cancellations", icon: FiFileText },
      { name: "Đền bù", path: "/reports/compensation", icon: FiFileText },
      { name: "Kho", path: "/warehouse", icon: FiBox },
    ],
  },
];

const SidebarItem = ({ item, isMain }) => {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const Icon = item.icon;
  const base = `
    group flex items-center rounded-xl
    transition-all duration-150 text-sm
  `;
  const activeStyle = `${ACTIVE_BG} ${ACTIVE_TEXT} font-medium`;
  const normalStyle = `text-slate-600 ${ICON_COLOR} ${HOVER_BG}`;
  const padding = isMain
    ? "px-4 py-3"
    : "pl-4 pr-4 py-2";

  return (
    <Link
      to={item.path}
      className={`${base} ${padding} ${isActive ? activeStyle : normalStyle}`}
    >
      <Icon
        size={16}
        className={`
          mr-3 transition-all duration-150
          ${isActive ? ACTIVE_TEXT : ICON_COLOR}
          group-hover:text-[#4b55c6]
        `}
      />
      {item.name || item.title}
    </Link>
  );
};

export default function Sidebar() {
  return (
    <div className="sidebar w-[270px] min-h-screen bg-[#f7f7f9] border-r border-gray-200">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-gray-300">
        <div className="w-10 h-10 rounded-full bg-[#4b55c6] text-white flex items-center justify-center text-lg font-semibold">S</div>
        <span className="text-lg font-semibold text-[#4b55c6]">SE HOTEL</span>
      </div>
      <nav className="px-3 mt-4">
        {sidebarConfig.map((section, i) => {
          if (section.type === "main") {
            return (
              <div key={i} className="mb-4">
                <SidebarItem item={section} isMain={true} />
              </div>
            );
          }
          return (
            <div key={i} className="mt-6 mb-2">
              <h3 className="text-sm font-semibold text-slate-400 mb-2 px-4">
                {section.title}
              </h3>
              {section.children.map((child, j) => (
                <SidebarItem key={j} item={child} isMain={false} />
              ))}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
