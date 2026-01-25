import React from 'react';
import { Link } from 'react-router-dom';
import NotificationDropdown from "./notificationDropdown.jsx";
import { useAuth } from "../features/auth/hooks/authContext.jsx";

export default function Topbar() {
  const { user } = useAuth();

  const roleMap = {
    manager: "Quản lý",
    receptionist: "Lễ tân",
    technician: "Kỹ thuật",
    housekeeper: "Buồng phòng",
    accountant: "Kế toán",
    customer_service: "CSKH",
    it: "IT",
    employee: "Nhân viên"
  };

  const displayName = user?.name || user?.email?.split('@')[0] || "Người dùng";
  const avatarUrl = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`;

  return (
    <div className="topbar h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between sticky top-0 z-40 shadow-sm">
      <div className="flex-1 flex justify-center">
        <div className="relative group">
            <input
              type="text"
              placeholder="Tìm kiếm..."
              className="w-[400px] px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm placeholder-gray-400
              focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all"
            />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <NotificationDropdown />

        <Link to="/profile" className="flex items-center gap-3 hover:bg-gray-50 p-1.5 rounded-xl transition-all group">
          <div className="text-right hidden md:block">
            <p className="text-sm font-bold text-gray-800 group-hover:text-indigo-600 transition-colors leading-tight">
                {displayName}
            </p>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                {roleMap[user?.role] || user?.role || "Nhân viên"}
            </p>
          </div>

          <div className="w-10 h-10 rounded-full border border-gray-200 p-0.5 group-hover:border-indigo-300 transition-colors overflow-hidden">
             <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                    e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}`;
                }}
             />
          </div>
        </Link>
      </div>
    </div>
  );
}