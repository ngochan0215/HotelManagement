import React, { useState } from "react";
import { FiX, FiDollarSign, FiAlertCircle } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi";

export default function CreateCompensationModal({ incident, onClose, onSuccess }) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const payerName = incident.causer_name || "Chưa xác định";
  const payerType = incident.caused_by === 'customer' ? 'Khách hàng'
                  : incident.caused_by === 'employee' ? 'Nhân viên'
                  : 'Không xác định';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      return alert("Vui lòng nhập số tiền bồi thường hợp lệ.");
    }

    setLoading(true);
    try {
      await incidentApi.createCompensationTicket({
        incident_id: incident._id,
        total_fee: Number(amount),
        description: note || `Bồi thường cho sự cố: ${incident.type}`,
      });

      alert("Đã tạo phiếu bồi thường thành công!");
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-red-700 flex items-center gap-2">
            <FiDollarSign /> Tạo Phiếu Đền Bù
          </h3>
          <button onClick={onClose}><FiX className="text-gray-500 hover:text-red-700" size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 text-sm">
            <div className="flex justify-between mb-1">
                <span className="text-gray-500">Đối tượng:</span>
                <span className="font-bold text-gray-800 uppercase">{payerType}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-gray-500">Họ tên:</span>
                <span className="font-bold text-indigo-600">{payerName}</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền bồi thường (VNĐ)</label>
            <div className="relative">
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10 focus:ring-2 focus:ring-red-200 outline-none font-bold text-lg text-red-600"
                  placeholder="0"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  autoFocus
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₫</span>
            </div>
            <p className="text-xs text-gray-400 mt-1 italic">* Số tiền này sẽ được tính vào hóa đơn hoặc trừ lương.</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Lý do / Ghi chú</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-200 outline-none h-20 text-sm"
              placeholder="Ví dụ: Làm vỡ TV Samsung 43 inch..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <div className="pt-2 flex gap-3">
             <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-gray-50 transition">
               Hủy
             </button>
             <button
               type="submit"
               disabled={loading}
               className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition"
             >
               {loading ? "Đang tạo..." : "Xác nhận Tạo"}
             </button>
          </div>

        </form>
      </div>
    </div>
  );
}