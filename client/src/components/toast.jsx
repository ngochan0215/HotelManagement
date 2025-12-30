import React, { useEffect } from "react";
import { FiCheckCircle, FiAlertTriangle, FiX, FiInfo } from "react-icons/fi";

const Toast = ({ message, type = "success", onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { icon: <FiCheckCircle size={24} />, color: "text-emerald-500", border: "border-emerald-500", bg: "bg-emerald-50" },
    error: { icon: <FiAlertTriangle size={24} />, color: "text-red-500", border: "border-red-500", bg: "bg-red-50" },
    info: { icon: <FiInfo size={24} />, color: "text-blue-500", border: "border-blue-500", bg: "bg-blue-50" },
  };

  const style = config[type] || config.success;

  return (
    <div className={`fixed top-5 right-5 z-50 flex items-center gap-4 px-6 py-4 bg-white rounded-xl shadow-2xl border-l-4 ${style.border} animate-slide-in-right min-w-[300px]`}>
      <div className={`${style.color} ${style.bg} p-2 rounded-full`}>
        {style.icon}
      </div>
      <div className="flex-1">
        <h4 className={`font-bold text-sm ${style.color} uppercase`}>{type === 'error' ? 'Thất bại' : 'Thành công'}</h4>
        <p className="text-gray-600 text-sm font-medium">{message}</p>
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition">
        <FiX size={20} />
      </button>
    </div>
  );
};

export default Toast;