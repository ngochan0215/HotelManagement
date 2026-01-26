import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FiBell, FiCheck, FiTrash2, FiInfo, FiCalendar, FiTool,
  FiAlertTriangle, FiTag, FiClock, FiCheckCircle, FiFilter
} from "react-icons/fi";
import { notificationApi } from "../features/api/notificationApi.js";
import { formatDistanceToNow } from "date-fns";
import { vi } from "date-fns/locale";
import { useAuth } from "../features/auth/hooks/authContext.jsx";
import { io } from "socket.io-client";

const NOTIFICATION_CONFIG = {
  booking: { label: "Đặt phòng", icon: <FiCalendar />, color: "text-blue-600 bg-blue-50 border-blue-100" },
  equipment: { label: "Thiết bị", icon: <FiTool />, color: "text-purple-600 bg-purple-50 border-purple-100" },
  incident: { label: "Sự cố", icon: <FiAlertTriangle />, color: "text-red-600 bg-red-50 border-red-100" },
  discount: { label: "Khuyến mãi", icon: <FiTag />, color: "text-amber-600 bg-amber-50 border-amber-100" },
  system: { label: "Hệ thống", icon: <FiInfo />, color: "text-slate-600 bg-slate-50 border-slate-100" },
  other: { label: "Khác", icon: <FiBell />, color: "text-gray-600 bg-gray-50 border-gray-100" }
};

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");

  const dropdownRef = useRef(null);
  const popupRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    if (user) fetchNotifications();
  }, [user, isOpen]);

  useEffect(() => {
    if (!user) return;
    const SOCKET_URL =
      import.meta.env.VITE_API_BASE_URL?.replace("/api/v1", "") ||
      "http://localhost:3000";

    const token = localStorage.getItem("token");

    const newSocket = io(SOCKET_URL, {
      auth: { token: `Bearer ${token}` },
      transports: ["websocket", "polling"]
    });

    newSocket.on("notification", (newNotif) => {
      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id || n._id === newNotif.id))
          return prev;

        return [
          {
            ...newNotif,
            _id: newNotif._id || newNotif.id,
            status: "unread",
            created_at: new Date().toISOString()
          },
          ...prev
        ];
      });
    });

    return () => newSocket.disconnect();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        popupRef.current &&
        !popupRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () =>
      document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationApi.getAllNotifications();
      const list = Array.isArray(data) ? data : data.notifications || [];
      const sortedList = list.sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      setNotifications(sortedList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) =>
          n._id === id ? { ...n, status: "read" } : n
        )
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAsReadAll();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, status: "read" }))
      );
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteNotification(id);
      setNotifications((prev) =>
        prev.filter((n) => n._id !== id)
      );
    } catch (error) {
      console.error(error);
    }
  };

  const unreadCount = notifications.filter(
    (n) => n.status === "unread"
  ).length;

  const filteredList = notifications.filter((n) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return n.status === "unread";
    return n.type === activeFilter;
  });

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-50 rounded-xl transition-all active:scale-95"
      >
        <FiBell size={22} />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={popupRef}
            className="fixed right-6 top-[70px] w-[400px] bg-white rounded-2xl shadow-2xl
                       border border-slate-100 z-[9999] overflow-hidden flex flex-col
                       origin-top-right transition-all animate-fade-in-up"
          >
            <div className="pt-4 px-5 pb-2 bg-white">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-black text-slate-800 text-lg">
                  Thông báo
                </h3>
                <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                  {notifications.length} tin
                </span>
              </div>

              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                <FilterChip
                  label="Tất cả"
                  active={activeFilter === "all"}
                  onClick={() => setActiveFilter("all")}
                />
                <FilterChip
                  label="Chưa đọc"
                  active={activeFilter === "unread"}
                  onClick={() => setActiveFilter("unread")}
                  count={unreadCount}
                  isUnread
                />

                {Object.entries(NOTIFICATION_CONFIG).map(
                  ([key, config]) => (
                    <FilterChip
                      key={key}
                      label={config.label}
                      active={activeFilter === key}
                      onClick={() => setActiveFilter(key)}
                    />
                  )
                )}
              </div>
            </div>

            <div className="max-h-[450px] overflow-y-auto no-scrollbar bg-slate-50/30 border-t border-slate-100">
              {loading ? (
                <div className="p-10 text-center text-slate-400 text-xs font-bold">
                  Đang tải dữ liệu...
                </div>
              ) : filteredList.length === 0 ? (
                <div className="p-12 flex flex-col items-center gap-3 opacity-40">
                  <FiFilter size={40} className="text-slate-400" />
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest">
                    Không có thông báo
                  </span>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {filteredList.map((notif) => {
                    const config =
                      NOTIFICATION_CONFIG[notif.type] ||
                      NOTIFICATION_CONFIG.other;
                    const isUnread =
                      notif.status === "unread";

                    return (
                      <div
                        key={notif._id}
                        onClick={(e) =>
                          handleMarkAsRead(
                            notif._id,
                            e
                          )
                        }
                        className={`p-4 hover:bg-white transition-all cursor-pointer group relative ${
                          isUnread
                            ? "bg-indigo-50/20"
                            : "bg-transparent"
                        }`}
                      >
                        {isUnread && (
                          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-indigo-500"></div>
                        )}

                        <div className="flex gap-3">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg border shadow-sm shrink-0 ${config.color}`}
                          >
                            {config.icon}
                          </div>
                          <div className="flex-1 pr-6">
                            <div className="flex justify-between items-start mb-0.5">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider bg-white px-1.5 rounded border border-slate-100">
                                {config.label}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                <FiClock size={10} />
                                {notif.created_at
                                  ? formatDistanceToNow(
                                      new Date(
                                        notif.created_at
                                      ),
                                      {
                                        addSuffix: true,
                                        locale: vi
                                      }
                                    )
                                  : "Vừa xong"}
                              </span>
                            </div>

                            <h4
                              className={`text-sm font-bold leading-tight mb-1 ${
                                isUnread
                                  ? "text-slate-900"
                                  : "text-slate-600"
                              }`}
                            >
                              {notif.title}
                            </h4>

                            <p
                              className={`text-xs line-clamp-2 leading-relaxed ${
                                isUnread
                                  ? "text-slate-700"
                                  : "text-slate-400"
                              }`}
                            >
                              {notif.content}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={(e) =>
                            handleDelete(
                              notif._id,
                              e
                            )
                          }
                          className="absolute top-3 right-3 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <FiTrash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {notifications.length > 0 && (
              <div className="p-3 bg-white border-t border-slate-100 text-center">
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 hover:underline transition-all flex items-center justify-center gap-1 w-full"
                >
                  <FiCheckCircle size={14} /> Đánh
                  dấu tất cả là đã đọc
                </button>
              </div>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}

const FilterChip = ({
  label,
  active,
  onClick,
  count,
  isUnread
}) => (
  <button
    onClick={onClick}
    className={`whitespace-nowrap px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-sm flex items-center gap-1.5
        ${
          active
            ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200"
            : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
        }`}
  >
    {label}
    {count > 0 && (
      <span
        className={`px-1.5 py-0.5 rounded-md text-[9px] leading-none ${
          active
            ? "bg-white/20 text-white"
            : "bg-red-100 text-red-600"
        }`}
      >
        {count > 9 ? "9+" : count}
      </span>
    )}
  </button>
);
