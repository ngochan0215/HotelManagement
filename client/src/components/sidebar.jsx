import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  FiGrid, FiUser, FiUsers, FiSettings,
  FiCalendar, FiFileText, FiBox, FiTag, FiAlertTriangle, FiLogOut, FiCamera, FiDollarSign, FiBriefcase
} from "react-icons/fi";
import { FaBed } from "react-icons/fa";
import { useAuth } from "../features/auth/hooks/authContext.jsx";

const ACTIVE_BG = "bg-indigo-600";
const ACTIVE_TEXT = "text-white";
const NORMAL_TEXT = "text-gray-400";
const HOVER_BG = "hover:bg-gray-800 hover:text-white";

const sidebarConfig = [
  { type: "main", title: "Bảng điều khiển", icon: FiGrid, path: "/dashboard",allowed: [] }, // Ai cũng xem được
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
    title: "Công việc của tôi",
    icon: FiBriefcase,
    path: "/my-work",
    allowed: ["technician"] // Chỉ nhân viên kỹ thuật
  },
  {
    type: "group",
    title: "QUẢN LÝ",
    children: [
      { name: "Phòng & Loại phòng", path: "/room-types", icon: FaBed, allowed: [ "housekeeper"] },
      { name: "Quản lý đặt phòng", path: "/booking-management", icon: FiCalendar, allowed: ["receptionist"] },
      { name: "Khách hàng", path: "/customers", icon: FiUser, allowed: [ "customer_service"] },
      { name: "Nhân viên", path: "/employees", icon: FiUsers, allowed: [] }, // Rỗng nghĩa là chỉ Manager
      { name: "Thiết bị", path: "/equipment", icon: FiSettings, allowed: ["technician"] },
      { name: "Dịch vụ & Sản phẩm", path: "/service", icon: FiBox, allowed: ["receptionist", "housekeeper"] },
      { name: "Hóa đơn", path: "/invoices", icon: FiFileText, allowed: ["receptionist", "accountant"] },
      { name: "Khuyến mãi", path: "/promotions", icon: FiTag, allowed: [ "customer_service"] },
      { name: "Sự cố", path: "/incidents", icon: FiAlertTriangle, allowed: ["technician", "receptionist", "housekeeper"] },
      { name: "Báo cáo thống kê", path: "/reports", icon: FiFileText, allowed: ["accountant"] }, // Chỉ kế toán + Manager
      { name: "Quét QR căn cước", path: "/qr-scanner", icon: FiCamera, allowed: ["receptionist"] },
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
    </Link>
  );
};

export default function Sidebar() {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const userPosition = localStorage.getItem("position") || "employee";
  const userRole = user?.role || localStorage.getItem("role");

  const handleLogout = () => {
    if (window.confirm("Bạn có chắc chắn muốn đăng xuất?")) {
      logout();
      localStorage.removeItem("position");
      localStorage.removeItem("role");
      navigate("/login");
    }
  };

  const checkPermission = (item) => {
    // Nếu item có excludeManager, manager không được xem
    if (item.excludeManager && userRole === "manager") return false;
    
    if (userRole === "manager") return true;
    if (!item.allowed) return true;
    return item.allowed.includes(userPosition);
  };

  return (
    <div className="sidebar w-[270px] h-screen bg-[#111827] border-r border-gray-800 fixed left-0 top-0 flex flex-col z-50">

        <div className="bg-[#111827] flex items-center gap-3 px-6 py-6 border-b border-gray-800/50">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-indigo-500/50 shadow-md">S</div>
            <span className="text-xl font-bold text-white tracking-wide">SE HOTEL</span>
        </div>

      <nav className="flex-1 overflow-y-auto px-3 py-6 custom-scrollbar">
        <div className="mb-8">
          {sidebarConfig
            .filter(item => item.type === "main" && checkPermission(item))
            .map((item, i) => (
              <SidebarItem key={i} item={item} isMain={true} />
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