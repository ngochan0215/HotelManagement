import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiGrid, FiUser, FiUsers, FiSettings,
  FiCalendar, FiFileText, FiBox, FiTag, FiAlertTriangle, FiLogOut, FiCamera, FiDollarSign, FiBriefcase, FiMessageSquare
} from "react-icons/fi";
import { FaBed } from "react-icons/fa";
import { useAuth } from "../features/auth/hooks/authContext.jsx";
import { chatApi } from "../features/chat/api/chatApi.js";

const ACTIVE_BG = "bg-indigo-600";
const ACTIVE_TEXT = "text-white";
const NORMAL_TEXT = "text-gray-400";
const HOVER_BG = "hover:bg-gray-800 hover:text-white";

const sidebarConfig = [
  { type: "main", title: "Bảng điều khiển", icon: FiGrid, path: "/dashboard", allowed: [] }, // Ai cũng xem được
  {
    type: "main",
    title: "Lịch phòng",
    icon: FiCalendar,
    path: "/room-calendar",
    allowed: ["receptionist"]
  },
  {
    type: "main",
    title: "Thu nhập",
    icon: FiDollarSign,
    path: "/earnings",
    allowed: [], // Tất cả nhân viên đều xem được
    excludeManager: true // Manager không được xem
  },
  {
    type: "main",
    title: "Lịch làm việc",
    icon: FiCalendar,
    path: "/schedules",
    allowed: ["receptionist", "technician", "customer_service", "housekeeper", "accountant", "it"],
  },
  {
    type: "main",
    title: "Công việc của tôi",
    icon: FiBriefcase,
    path: "/my-work",
    allowed: ["technician", "housekeeper"], // Nhân viên kỹ thuật và buồng phòng
    excludeManager: true
  },
  {
    type: "main",
    title: "Quản lý Công việc",
    icon: FiBriefcase,
    path: "/all-tasks",
    allowed: [],
  },
  {
    type: "main",
    title: "Tin nhắn khách hàng",
    icon: FiMessageSquare,
    path: "/support-messages",
    allowed: ["customer_service", "customer_support"],
  },
  {
    type: "group",
    title: "QUẢN LÝ",
    children: [
      { name: "Phòng & Loại phòng", path: "/room-types", icon: FaBed, allowed: [] },
      { name: "Quản lý đặt phòng", path: "/booking-management", icon: FiCalendar, allowed: ["receptionist"] },
      { name: "Khách hàng", path: "/customers", icon: FiUser, allowed: [ "customer_service"] },
      { name: "Nhân viên", path: "/employees", icon: FiUsers, allowed: [] }, // Rỗng nghĩa là chỉ Manager
      //{ name: "Quản lý công việc", path: "/all-tasks", icon: FiBriefcase, allowed: [] }, // Chỉ Manager
      { name: "Thiết bị", path: "/equipment", icon: FiSettings, allowed: [] },
      { name: "Dịch vụ & Sản phẩm", path: "/service", icon: FiBox, allowed: ["receptionist"] },
      { name: "Hóa đơn", path: "/invoices", icon: FiFileText, allowed: ["receptionist", "accountant"] },
      { name: "Khuyến mãi", path: "/promotions", icon: FiTag, allowed: [ "customer_service"] },
      { name: "Sự cố", path: "/incidents", icon: FiAlertTriangle, allowed: ["technician", "receptionist", "housekeeper"] },
      { name: "Báo cáo thống kê", path: "/reports", icon: FiFileText, allowed: ["accountant"] }, // Chỉ kế toán + Manager
    ],
  },
];

const SidebarItem = ({ item, isMain, badgeCount = 0 }) => {
  const location = useLocation();
  const isActive = location.pathname === item.path;
  const Icon = item.icon;

  return (
    <Link
      to={item.path}
      className={`
        group flex items-center rounded-lg transition-all duration-200 mb-1.5
        ${isMain ? "px-4 py-3 text-[15px]" : "px-4 py-2.5 text-[14px] ml-1"}
        ${isActive ? `${ACTIVE_BG} ${ACTIVE_TEXT} font-semibold shadow-md shadow-indigo-500/20` : `${NORMAL_TEXT} ${HOVER_BG}`}
      `}
    >
      <Icon
        size={isMain ? 20 : 18}
        className={`mr-3 transition-all duration-200
        ${isActive ? "text-white" : "text-gray-500 group-hover:text-white"}`}
      />
      <span>{item.name || item.title}</span>
      {badgeCount > 0 ? (
        <span className="ml-auto min-w-[22px] rounded-full bg-amber-400 px-2 py-0.5 text-center text-[11px] font-semibold text-stone-950">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      ) : null}
    </Link>
  );
};

export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const [supportInboxCount, setSupportInboxCount] = useState(0);

  const userPosition = localStorage.getItem("position") || "employee";
  const userRole = user?.role || localStorage.getItem("role");
  const canSeeSupportInbox = userRole === "manager" || userRole === "admin" || ["customer_service", "customer_support"].includes(userPosition);

  const handleLogout = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      logout();
      localStorage.removeItem("position");
      localStorage.removeItem("role");
      navigate("/login");
    }
  };

  const checkPermission = (item) => {
    const isManagerOrAdmin = userRole === "manager" || userRole === "admin";
    if (item.adminOnly && userRole !== "admin") return false;
    if (item.excludeManager && isManagerOrAdmin) return false;
    if (isManagerOrAdmin) return true;
    if (!item.allowed) return true;
    return item.allowed.includes(userPosition);
  };

  useEffect(() => {
    if (!canSeeSupportInbox) {
      setSupportInboxCount(0);
      return undefined;
    }

    let cancelled = false;
    const loadSupportCount = async () => {
      try {
        const data = await chatApi.getPendingSupportCount();
        if (!cancelled) setSupportInboxCount(data?.count ?? 0);
      } catch {
        if (!cancelled) setSupportInboxCount(0);
      }
    };

    loadSupportCount();
    const timer = window.setInterval(loadSupportCount, 45000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [canSeeSupportInbox, userRole, userPosition]);

  return (
    <div className="sidebar w-[270px] h-screen bg-[#111827] border-r border-gray-800 fixed left-0 top-0 flex flex-col z-50">

        <div className="bg-[#111827] flex items-center gap-3 px-6 py-6 border-b border-gray-800/50">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-indigo-500/50 shadow-md">S</div>
            <span className="text-xl font-bold text-white tracking-wide">SE HOTEL</span>
        </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6 scrollbar-hide">
        <div className="mb-8">
          {sidebarConfig
            .filter(item => item.type === "main" && checkPermission(item))
            .map((item, i) => (
              <SidebarItem
                key={i}
                item={item}
                isMain={true}
                badgeCount={item.path === "/support-messages" ? supportInboxCount : 0}
              />
            ))}
        </div>

        {sidebarConfig
          .filter(section => section.type === "group")
          .map((section, i) => {
            const visibleChildren = section.children.filter(child => checkPermission(child));
            if (visibleChildren.length === 0) return null;

            return (
                <div key={i} className="mb-6">
                <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mb-4 px-4">
                    {section.title}
                </h3>

                <div className="space-y-0.5">
                    {visibleChildren.map((child, j) => (
                    <SidebarItem key={j} item={child} isMain={false} />
                    ))}
                </div>
                </div>
            );
          })}
      </nav>
      <div className="px-3 py-4 border-t border-gray-800/50 bg-transparent">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 font-bold transition-all duration-300 group hover:bg-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-500/30 active:scale-95 bg-transparent">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors duration-300">
                <FiLogOut size={18} className="text-red-400 group-hover:text-white transition-colors" />
            </div>
            <span className="tracking-wide text-sm">Đăng xuất</span>
          </button>
       </div>
    </div>
  );
}
