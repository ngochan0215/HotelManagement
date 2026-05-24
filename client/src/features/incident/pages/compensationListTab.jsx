import React, { useEffect, useState } from "react";
import { FiDollarSign, FiCheckCircle, FiLoader, FiAlertCircle, FiEye } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi.js";
import CompensationDetailModal from "../components/compensationDetailModal.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import Toast from "../../../components/toast.jsx";

export default function CompensationListTab() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });

  // ...
    const fetchTickets = async () => {
      setLoading(true);
      try {
        const res = await incidentApi.getAllCompensateTickets();
        // SỬA Ở ĐÂY: Lấy res.data vì backend trả về { total, data: [...] }
        // Kiểm tra kỹ xem res có phải mảng hay object chứa data
        const list = Array.isArray(res) ? res : (res.data || []);
        setTickets(list);
      } catch (err) {
        console.error("Lỗi fetch bồi thường:", err);
        setTickets([]); // Đảm bảo luôn là mảng để không crash
      } finally {
        setLoading(false);
      }
    };
  // ...

  useEffect(() => { fetchTickets(); }, []);

  const handleConfirmPaid = (ticketId) => {
    setConfirmState({
      open: true,
      title: "Xác nhận thanh toán",
      message: "Xác nhận khoản bồi thường này đã được thanh toán?",
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        try {
          await incidentApi.confirmCompensationPaid(ticketId);
          setToast({ type: "success", message: "Đã xác nhận thanh toán. Sự cố liên quan đã được đóng." });
          fetchTickets();
        } catch (err) {
          setToast({ type: "error", message: "Lỗi: " + (err.response?.data?.message || err.message) });
        }
      }
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-fade-in">
      <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
        <div>
          <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
             Hồ sơ đền bù thiết bị
          </h3>
          <p className="text-xs text-gray-400 mt-1">Theo dõi các khoản thu bồi thường do hư hỏng thiết bị.</p>
        </div>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 text-[11px] uppercase font-bold border-b border-gray-100 bg-white">
              <th className="py-4 px-6 w-32">Mã phiếu</th>
              <th className="py-4 px-6">Đối tượng chịu trách nhiệm</th>
              <th className="py-4 px-6">Thông tin sự cố</th>
              <th className="py-4 px-6 text-right">Tổng bồi thường</th>
              <th className="py-4 px-6 text-center">Trạng thái</th>
              <th className="py-4 px-6 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {loading ? (
              <tr>
                <td colSpan="6" className="py-20 text-center text-gray-400">
                  <FiLoader className="inline animate-spin mr-2" size={20}/> Đang tải dữ liệu...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan="6" className="py-20 text-center text-gray-400 italic">
                  <FiAlertCircle className="inline mb-1" /> Chưa có phiếu bồi thường nào.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr key={t._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="py-4 px-6 font-mono text-xs text-indigo-500 font-bold">
                    #{t._id.slice(-6).toUpperCase()}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-gray-800 capitalize">
                        {t.payer_type === 'customer' ? 'Khách hàng' :
                         t.payer_type === 'employee' ? 'Nhân viên' : 'Khách sạn'}
                      </span>
                      <span className="text-xs text-gray-400">{t.incident?.causer_name || "N/A"}</span>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-xs">
                    <div className="font-medium text-gray-600">Sự cố: {t.incident_id?.type}</div>
                    <div className="text-gray-400 italic truncate max-w-[150px]">
                      {t.incident_id?.description}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right font-bold text-red-600">
                    {t.total_fee?.toLocaleString()} <span className="text-[10px] text-gray-400">đ</span>
                  </td>
                  <td className="py-4 px-6 text-center">
                    <div className="flex flex-col items-center gap-1">
                    <span className={`px-3 py-1 rounded-full text-[11px] font-black uppercase ${
                      t.status === 'paid'
                        ? 'bg-emerald-100 text-emerald-700'
                        : t.status === 'cancelled'
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-orange-100 text-orange-700'
                    }`}>
                      {t.status === 'paid' ? "Đã thanh toán"
                        : t.status === 'cancelled' ? "Đã hủy"
                        : "Chờ thu tiền"}
                    </span>
                      {t.is_in_receipt && t.status === 'pending' && (
                        <span className="text-[10px] text-blue-600 font-semibold italic">
                          Đã gộp vào hóa đơn
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 px-6 text-right">
                    <div className="flex justify-end items-center gap-2">
                      <button
                        onClick={() => setSelectedTicketId(t._id)}
                        className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-700 transition shadow-sm"
                        title="Xem chi tiết"
                      >
                        <FiEye /> Chi tiết
                      </button>
                      {t.status === 'pending' && !t.is_in_receipt && (
                        <button
                          onClick={() => handleConfirmPaid(t._id)}
                          className="inline-flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-sm"
                        >
                          <FiCheckCircle /> Xác nhận thu
                        </button>
                      )}
                      {t.status === 'pending' && t.is_in_receipt && (
                        <span className="text-xs text-gray-500 italic">
                          Sẽ tự động thanh toán khi hóa đơn được thanh toán
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedTicketId && (
        <CompensationDetailModal
          ticketId={selectedTicketId}
          onClose={() => setSelectedTicketId(null)}
        />
      )}

      {confirmState.open && (
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          confirmText="Xác nhận"
          cancelText="Hủy"
          onConfirm={confirmState.onConfirm}
          onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
        />
      )}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
