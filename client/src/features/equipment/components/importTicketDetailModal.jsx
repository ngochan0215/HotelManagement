import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { FiX, FiRefreshCw, FiUser, FiCalendar, FiDollarSign, FiPackage } from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi.js";

export default function ImportTicketDetailModal({ ticket, onClose }) {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fullTicket, setFullTicket] = useState(ticket);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await equipmentApi.getImportTicketById(ticket._id);
        if (res.success) {
          setFullTicket(res.ticket);
          setDetails(res.ticket_details || []);
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [ticket._id]);

  const getStatusBadge = (status) => {
    const statusMap = {
      pending: { label: "Chờ xử lý", color: "bg-gray-100 text-gray-800" },
      waiting_confirm: { label: "Chờ xác nhận", color: "bg-yellow-100 text-yellow-800" },
      completed: { label: "Hoàn tất", color: "bg-green-100 text-green-800" },
      expired: { label: "Đã hủy", color: "bg-red-100 text-red-800" },
    };
    const statusInfo = statusMap[status] || statusMap.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const totalAmount = details.reduce((sum, item) => {
    return sum + (item.import_price * item.import_quantity);
  }, 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-lg text-gray-800">Chi tiết phiếu nhập thiết bị</h3>
            <span className="text-xs text-gray-500 font-mono">#{fullTicket._id?.slice(-6).toUpperCase() || ticket._id?.slice(-6).toUpperCase()}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-8">
              <FiRefreshCw className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
              <p className="mt-2 text-gray-600">Đang tải chi tiết...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Thông tin cơ bản */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <FiCalendar className="w-4 h-4" />
                    Ngày nhập
                  </div>
                  <p className="font-semibold text-gray-900">
                    {fullTicket.import_date 
                      ? format(new Date(fullTicket.import_date), "dd/MM/yyyy")
                      : ticket.import_date 
                        ? format(new Date(ticket.import_date), "dd/MM/yyyy")
                        : 'N/A'}
                  </p>
                </div>

                {fullTicket.employee_id && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                      <FiUser className="w-4 h-4" />
                      Người tạo phiếu
                    </div>
                    <p className="font-semibold text-gray-900">
                      {fullTicket.employee_id.full_name || ticket.employee_id?.full_name || 'N/A'}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-gray-500 text-xs mb-1">Trạng thái</div>
                  {getStatusBadge(fullTicket.status || ticket.status)}
                </div>

                {fullTicket.total_fee !== undefined && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
                      <FiDollarSign className="w-4 h-4" />
                      Tổng tiền
                    </div>
                    <p className="font-semibold text-blue-900">
                      {fullTicket.total_fee.toLocaleString()} đ
                    </p>
                  </div>
                )}

                {fullTicket.confirmed_at && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-green-600 text-xs mb-1">Xác nhận lúc</div>
                    <p className="font-semibold text-green-900">
                      {format(new Date(fullTicket.confirmed_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                )}

                {fullTicket.confirmed_by && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-green-600 text-xs mb-1">Người xác nhận</div>
                    <p className="font-semibold text-green-900">
                      {fullTicket.confirmed_by.full_name || 'N/A'}
                    </p>
                  </div>
                )}
              </div>

              {/* Danh sách thiết bị nhập */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <FiPackage className="w-4 h-4" />
                  Danh sách thiết bị nhập ({details.length} loại)
                </h4>
                {details.length > 0 ? (
                  <div className="space-y-2">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600">Tên thiết bị</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Đơn vị</th>
                            <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600">Số lượng</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Giá nhập</th>
                            <th className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Thành tiền</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {details.map((item, index) => {
                            const itemTotal = item.import_price * item.import_quantity;
                            return (
                              <tr key={index} className="hover:bg-gray-50">
                                <td className="px-4 py-3 font-medium text-gray-900">
                                  {item.category_id?.name || 'N/A'}
                                </td>
                                <td className="px-4 py-3 text-center text-gray-600">
                                  {item.category_id?.unit === 'box' ? 'Bộ' : 'Cái'}
                                </td>
                                <td className="px-4 py-3 text-center font-semibold text-gray-700">
                                  {item.import_quantity}
                                </td>
                                <td className="px-4 py-3 text-right text-gray-700">
                                  {item.import_price.toLocaleString()} đ
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-indigo-600">
                                  {itemTotal.toLocaleString()} đ
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                          <tr>
                            <td colSpan="4" className="px-4 py-3 text-right font-bold text-gray-900">
                              Tổng cộng:
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-lg text-indigo-600">
                              {totalAmount.toLocaleString()} đ
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                    <p className="text-sm text-gray-500">Chưa có thiết bị nào</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
