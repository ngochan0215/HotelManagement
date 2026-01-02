import React, { useEffect, useState } from "react";
import { FiDollarSign, FiCheckCircle, FiLoader, FiAlertCircle } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi";

export default function CompensationListTab() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const data = await incidentApi.getAllCompensateTickets(); // ⬅ data = res.data
      setTickets(data || []);
    } catch (err) {
      console.error("Lỗi fetch bồi thường:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleConfirmPaid = async (ticketId) => {
    if (!window.confirm("Xác nhận khoản bồi thường này đã được thanh toán?")) return;

    try {
      await incidentApi.confirmCompensationPaid(ticketId); // ⬅ gọi đúng mapping
      alert("Đã xác nhận thanh toán. Sự cố liên quan đã được đóng.");
      fetchTickets();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
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
                  </td>
                  <td className="py-4 px-6 text-right">
                    {t.status === 'pending' && (
                      <button
                        onClick={() => handleConfirmPaid(t._id)}
                        className="inline-flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-700 transition shadow-sm"
                      >
                        <FiCheckCircle /> Xác nhận thu
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
