import React, { useState, useEffect } from "react";
import { FiX, FiUser, FiHome, FiPackage, FiDollarSign } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import { format } from "date-fns";

export default function ServiceUsageDetailModal({ usageId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const renderUnit = (unit) => {
    const unitsMap = {
      hour: "giờ",
      day: "ngày",
      item: "cái",
      can: "lon",
      bottle: "chai",
      portion: "phần",
      ticket: "vé",
    };
    return unitsMap[unit] || unit;
  }

  const renderStatus = (status) => {
    const statusesMap = {
      checked_in: "Đã check-in",
      checked_out: "Đã check-out"
    };
    return statusesMap[status] || status || "Không xác định";
  }

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await serviceApi.getServiceUsageById(usageId);
        if (res.success) {
          setData(res.data);
          console.log("Chi tiết phiếu sử dụng dịch vụ:", res.data);
        } else {
          setError(res.message || "Không thể tải chi tiết");
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || "Lỗi khi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    if (usageId) {
      fetchDetail();
    }
  }, [usageId]);

  if (!usageId) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-orange-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Chi tiết Phiếu Sử dụng Dịch vụ</h2>
            <p className="text-sm text-gray-500">Mã phiếu: #{usageId.slice(-6).toUpperCase()}</p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-200 rounded-full transition-colors"
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Thông tin khách hàng và phòng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FiUser className="text-blue-600" />
                    <h3 className="font-bold text-gray-800">Khách hàng</h3>
                  </div>
                  <p className="text-gray-700 font-semibold">
                    {data.service_usage?.customer_id?.full_name || "N/A"}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    {data.service_usage?.customer_id?.phone || data.service_usage?.customer_id?.phone_number || "Chưa có SĐT"}
                  </p>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2 mb-2">
                    <FiHome className="text-green-600" />
                    <h3 className="font-bold text-gray-800">Phòng</h3>
                  </div>
                  {data.rooms && data.rooms.length > 0 ? (
                    <div className="space-y-1">
                      {data.rooms.map((room, idx) => (
                        <p key={idx} className="text-gray-700 font-semibold">
                          Phòng {room.room_number}
                          <span className="ml-2 text-xs text-gray-500">({renderStatus(room.status)})</span>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">Chưa có thông tin phòng</p>
                  )}
                </div>
              </div>

              {/* Thông tin nhân viên */}
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold">Nhân viên tạo:</span>{" "}
                  {data.service_usage?.employee_id?.full_name || "N/A"}
                </p>
                {data.service_usage?.use_from && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Từ ngày:</span>{" "}
                    {format(new Date(data.service_usage.use_from), "dd/MM/yyyy HH:mm")}
                  </p>
                )}
                {data.service_usage?.finish_at && (
                  <p className="text-sm text-gray-600 mt-1">
                    <span className="font-semibold">Đến ngày:</span>{" "}
                    {format(new Date(data.service_usage.finish_at), "dd/MM/yyyy HH:mm")}
                  </p>
                )}
              </div>

              {/* Danh sách dịch vụ */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <FiPackage className="text-orange-600" />
                  <h3 className="font-bold text-gray-800 text-lg">Danh sách Dịch vụ</h3>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 text-gray-600 font-semibold">
                      <tr>
                        <th className="px-4 py-3 text-left">Tên dịch vụ</th>
                        <th className="px-4 py-3 text-center">Số lượng</th>
                        <th className="px-4 py-3 text-center">Đơn giá</th>
                        <th className="px-4 py-3 text-right">Thành tiền</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {data.usage_details && data.usage_details.length > 0 ? (
                        data.usage_details.map((detail, idx) => (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">
                              {detail.service_id?.name || "N/A"}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {detail.quantity} {renderUnit(detail.unit) || "đơn vị"}
                            </td>
                            <td className="px-4 py-3 text-center text-gray-700">
                              {detail.current_price?.toLocaleString() || detail.service_id?.price?.toLocaleString() || "0"} đ
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-indigo-600">
                              {detail.total_fee?.toLocaleString() || "0"} đ
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 rounded text-xs ${
                                detail.status === "completed" 
                                  ? "bg-green-100 text-green-700" 
                                  : detail.status === "cancelled"
                                  ? "bg-red-100 text-red-700"
                                  : detail.status === "waiting_confirm"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}>
                                {detail.status === "completed" ? "Hoàn thành" :
                                 detail.status === "cancelled" ? "Đã hủy" :
                                 detail.status === "waiting_confirm" ? "Chờ xác nhận" :
                                 "Đang chờ"}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="text-center py-8 text-gray-400 italic">
                            Chưa có dịch vụ nào
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tổng tiền */}
              <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiDollarSign className="text-orange-600" size={20} />
                    <span className="font-bold text-gray-800 text-lg">Tổng tiền:</span>
                  </div>
                  <span className="font-bold text-orange-600 text-2xl">
                    {data.service_usage?.total_fee?.toLocaleString() || "0"} đ
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>

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
