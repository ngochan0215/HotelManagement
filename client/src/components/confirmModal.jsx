import React from 'react';
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiAlertCircle } from 'react-icons/fi';

const ConfirmModal = ({ open, title, message, onConfirm, onCancel, confirmText = "Xác nhận", cancelText = "Hủy", type = "danger" }) => {
  if (!open) return null;

  const styles = {
    danger:  { icon: <FiAlertTriangle size={24}/>, color: "text-red-500", bg: "bg-red-100", btn: "bg-red-600 hover:bg-red-700" },
    warning: { icon: <FiAlertCircle size={24}/>,   color: "text-orange-500", bg: "bg-orange-100", btn: "bg-orange-500 hover:bg-orange-600" },
    success: { icon: <FiCheckCircle size={24}/>,   color: "text-emerald-500", bg: "bg-emerald-100", btn: "bg-emerald-600 hover:bg-emerald-700" },
    info:    { icon: <FiInfo size={24}/>,          color: "text-blue-500", bg: "bg-blue-100", btn: "bg-blue-600 hover:bg-blue-700" }
  };

  const style = styles[type] || styles.danger;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden transform transition-all scale-100">
        <div className="p-6 text-center">
          <div className={`mx-auto flex items-center justify-center w-12 h-12 rounded-full ${style.bg} ${style.color} mb-4`}>
            {style.icon}
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">{title}</h3>
          <p className="text-sm text-gray-500 mb-6">{message}</p>

          <div className="flex gap-3 justify-center">
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 text-white rounded-lg text-sm font-bold shadow-md transition ${style.btn}`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;