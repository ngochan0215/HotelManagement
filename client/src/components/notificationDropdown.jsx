import React, { useState, useEffect, useRef } from "react";
import { Bell, X, Check, CheckCheck } from "lucide-react";
import { notificationApi } from "../features/api/notificationApi.js";
import { format } from "date-fns";

const TYPE_LABELS = {
  booking: "Đơn hàng",
  discount: "Khuyến mãi",
  system: "Hệ thống",
  other: "Khác",
};

const TYPE_COLORS = {
  booking: "bg-blue-100 text-blue-700 border-blue-200",
  discount: "bg-purple-100 text-purple-700 border-purple-200",
  system: "bg-orange-100 text-orange-700 border-orange-200",
  other: "bg-gray-100 text-gray-700 border-gray-200",
};

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Listen for real-time notifications via socket.io (optional)
  useEffect(() => {
    let socket = null;
    let mounted = true;
    
    const initSocket = async () => {
      try {
        // Try to import socket.io-client dynamically
        const socketModule = await import("socket.io-client").catch(() => null);
        if (!socketModule || !mounted) return;

        const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
        const token = localStorage.getItem("token");
        console.log("Token for socket auth:", token);
        if (!token) return;

        socket = socketModule.io(API_BASE_URL, {
          auth: { token },
          transports: ["websocket", "polling"],
        });

        socket.on("notification", (newNotification) => {
          if (mounted) {
            setNotifications((prev) => {
              // Kiểm tra xem thông báo đã tồn tại chưa để tránh duplicate
              const exists = prev.some(n => n._id === newNotification.id);
              if (exists) return prev;
              return [{ ...newNotification, _id: newNotification.id }, ...prev];
            });
          }
        });

        socket.on("connect", () => {
          console.log("[Notification] Socket connected");
        });

        socket.on("disconnect", () => {
          console.log("[Notification] Socket disconnected");
        });

        socket.on("connect_error", (error) => {
          console.error("[Notification] Socket connection error:", error);
        });
      } catch (error) {
        console.error("Error initializing socket:", error);
      }
    };

    initSocket();

    return () => {
      mounted = false;
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await notificationApi.getAllNotifications();
      setNotifications(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif._id === id ? { ...notif, status: "read" } : notif
        )
      );
    } catch (error) {
      console.error("Error marking as read:", error);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    try {
      await notificationApi.deleteNotification(id);
      setNotifications((prev) => prev.filter((notif) => notif._id !== id));
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleMarkAllAsRead = async (e) => {
    e.stopPropagation();
    try {
      await notificationApi.markAsReadAll();
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, status: "read" }))
      );
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const unreadCount = notifications.filter((n) => n.status === "unread").length;

  // Nhóm thông báo theo type
  const groupedNotifications = notifications.reduce((acc, notif) => {
    const type = notif.type || "other";
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(notif);
    return acc;
  }, {});

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-bold text-gray-800">Thông báo</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                  title="Đánh dấu tất cả đã đọc"
                >
                  <CheckCheck size={14} />
                  Đọc tất cả
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center">
                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <p className="mt-2 text-sm text-gray-500">Đang tải...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                <p className="text-sm">Chưa có thông báo</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {Object.entries(groupedNotifications).map(([type, items]) => (
                  <div key={type}>
                    {/* Type Header */}
                    <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold border ${TYPE_COLORS[type] || TYPE_COLORS.other}`}
                      >
                        {TYPE_LABELS[type] || "Khác"}
                      </span>
                      <span className="ml-2 text-xs text-gray-500">
                        ({items.length})
                      </span>
                    </div>

                    {/* Notifications in this type */}
                    {items.map((notif) => (
                      <div
                        key={notif._id}
                        className={`px-4 py-3 hover:bg-gray-50 transition-colors ${
                          notif.status === "unread" ? "bg-blue-50/30" : ""
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4
                                className={`text-sm font-semibold ${
                                  notif.status === "unread"
                                    ? "text-gray-900"
                                    : "text-gray-700"
                                }`}
                              >
                                {notif.title}
                              </h4>
                              {notif.status === "unread" && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></div>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                              {notif.content}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              {notif.created_at
                                ? format(
                                    new Date(notif.created_at),
                                    "dd/MM/yyyy HH:mm"
                                  )
                                : ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {notif.status === "unread" && (
                              <button
                                onClick={(e) => handleMarkAsRead(notif._id, e)}
                                className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                                title="Đánh dấu đã đọc"
                              >
                                <Check size={16} />
                              </button>
                            )}
                            <button
                              onClick={(e) => handleDelete(notif._id, e)}
                              className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                              title="Xóa"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-center">
              <p className="text-xs text-gray-500">
                Hiển thị {notifications.length} thông báo
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
