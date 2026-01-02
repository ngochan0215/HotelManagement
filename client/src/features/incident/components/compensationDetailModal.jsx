import React from "react";
import { FiX } from "react-icons/fi";

export default function CompensationDetailModal({ ticket, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50">
      <div className="bg-white rounded-2xl w-[520px] shadow-xl">
        <div className="flex justify-between p-4 border-b">
          <h3 className="font-bold text-lg">Chi tiết phiếu bồi thường</h3>
          <button onClick={onClose}><FiX/></button>
        </div>

        <div className="p-6 space-y-3">
          <div className="text-sm text-gray-500">Mã phiếu</div>
          <div className="font-mono">{ticket._id}</div>

          <div className="text-sm text-gray-500">Sự cố liên quan</div>
          <div>{ticket.incident_id?.description}</div>

          <div className="text-sm text-gray-500">Số tiền</div>
          <div className="font-bold text-red-600">
            {ticket.total_fee?.toLocaleString()} đ
          </div>
        </div>

        <div className="p-4 border-t text-right">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
