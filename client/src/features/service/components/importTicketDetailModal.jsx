import React, { useState, useEffect } from "react";
import { FiX, FiUser, FiPackage, FiCalendar, FiHash } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import { format } from "date-fns";

const STATUS_CONFIG = {
  pending:          { label: "Chờ đến ngày nhập",        cls: "bg-blue-100 text-blue-700 border border-blue-200" },
  waiting_confirm:  { label: "Đã đến ngày - Chờ xác nhận", cls: "bg-yellow-100 text-yellow-800 border border-yellow-300 font-bold" },
  completed:        { label: "Hoàn thành",                cls: "bg-green-100 text-green-700 border border-green-200" },
  expired:          { label: "Đã hết hạn",                cls: "bg-red-100 text-red-700 border border-red-200" },
  cancelled:        { label: "Đã hủy",                    cls: "bg-red-100 text-red-700 border border-red-200" },
};

export default function ImportTicketDetailModal({ ticketId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!ticketId) return;
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await serviceApi.getGoodTicketById(ticketId);
        if (res.success) setData(res.data);
        else setError(res.message || "Không thể tải chi tiết phiếu nhập.");
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Lỗi khi tải dữ liệu.");
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [ticketId]);

  if (!ticketId) return null;

  const status = data ? (STATUS_CONFIG[data.status] || STATUS_CONFIG.pending) : null;
  const totalItems = data?.details?.reduce((s, d) => s + (d.import_quantity || 0), 0) ?? 0;
  const totalValue = data?.details?.reduce((s, d) => s + (d.import_quantity || 0) * (d.service_id?.price || 0), 0) ?? 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 py-4 border-b flex justify-between items-center bg-blue-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Chi tiết Phiếu Nhập Kho</h2>
            {data && (
              <p className="text-sm text-gray-500 mt-0.5">
                Mã phiếu: <span className="font-mono font-bold">#{ticketId.slice(-6).toUpperCase()}</span>
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-5">

              {/* Meta row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-start gap-3">
                  <FiCalendar className="text-blue-500 mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ngày nhập</p>
                    <p className="font-bold text-gray-800 mt-0.5">
                      {data.import_date
                        ? format(new Date(data.import_date), "dd/MM/yyyy")
                        : "---"}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-start gap-3">
                  <FiUser className="text-blue-500 mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Nhân viên tạo</p>
                    <p className="font-bold text-gray-800 mt-0.5">
                      {data.employee_id?.full_name || "---"}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-start gap-3">
                  <FiHash className="text-blue-500 mt-0.5 shrink-0" size={18} />
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Trạng thái</p>
                    <span className={`inline-block mt-1 px-2.5 py-1 rounded text-xs ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                </div>
              </div>

              {/* Detail table */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FiPackage className="text-blue-600" size={18} />
                  <h3 className="font-bold text-gray-800 text-base">Danh sách hàng nhập</h3>
                  <span className="ml-auto text-sm text-gray-500">{data.details?.length || 0} mặt hàng</span>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-3 text-left">Tên dịch vụ / hàng hóa</th>
                        <th className="px-4 py-3 text-center">Số lượng nhập</th>
                        <th className="px-4 py-3 text-right">Đơn giá</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.details?.length > 0 ? (
                        data.details.map((d, idx) => {
                          const price = d.service_id?.price || 0;
                          const qty = d.import_quantity || 0;
                          return (
                            <tr key={idx} className="hover:bg-gray-50 transition">
                              <td className="px-4 py-3 font-medium text-gray-800">
                                {d.service_id?.name || "---"}
                              </td>
                              <td className="px-4 py-3 text-center text-gray-700">
                                {qty.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-right text-gray-600">
                                {price.toLocaleString()} đ
                              </td>
                              <td className="px-4 py-3 text-right font-semibold text-blue-700">
                                {(qty * price).toLocaleString()} đ
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-10 text-gray-400 italic">
                            Không có mặt hàng nào trong phiếu này.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200 flex items-center justify-between gap-4">
                <div className="text-sm text-gray-600">
                  Tổng số lượng: <span className="font-bold text-gray-800">{totalItems.toLocaleString()} đơn vị</span>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Tổng giá trị nhập kho</p>
                  <p className="text-2xl font-bold text-blue-700">{totalValue.toLocaleString()} đ</p>
                </div>
              </div>

            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end rounded-b-xl">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
