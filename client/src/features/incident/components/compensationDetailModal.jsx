import React, { useState, useEffect } from "react";
import { FiX, FiRefreshCw, FiUser, FiMapPin, FiDollarSign, FiAlertCircle, FiCalendar, FiPackage, FiCheckCircle } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi.js";
import Toast from "../../../components/toast.jsx";

export default function CompensationDetailModal({ ticketId, onClose }) {
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        const res = await incidentApi.getCompensateTicketById(ticketId);
        if (res?.data) {
          setTicket(res.data);
        }
      } catch (error) {
        console.error("Error fetching compensation ticket:", error);
        setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
      } finally {
        setLoading(false);
      }
    };

    if (ticketId) {
      fetchTicket();
    }
  }, [ticketId]);

  const getStatusBadge = (status) => {
    const statusMap = {
      paid: { label: "Đã thanh toán", color: "bg-emerald-100 text-emerald-700" },
      pending: { label: "Chờ thu tiền", color: "bg-orange-100 text-orange-700" },
      cancelled: { label: "Đã hủy", color: "bg-gray-100 text-gray-400" },
    };
    const statusInfo = statusMap[status] || statusMap.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  const getPayerTypeLabel = (type) => {
    const typeMap = {
      customer: "Khách hàng",
      employee: "Nhân viên",
      hotel: "Khách sạn",
    };
    return typeMap[type] || type;
  };

  const getBrokenStateLabel = (state) => {
    const stateMap = {
      scratched: "Xước",
      cracked: "Nứt",
      broken: "Vỡ",
      lost: "Mất",
      unusable: "Không dùng được",
    };
    return stateMap[state] || state;
  };

  const getResolutionLabel = (resolution) => {
    return resolution === "repair" ? "Sửa chữa" : "Loại bỏ";
  };

  const getIncidentTypeLabel = (type) => {
    const typeMap = {
      equipment: "Thiết bị",
      technical: "Kỹ thuật",
      facility: "Cơ sở vật chất",
      service: "Dịch vụ",
      safety: "An toàn",
      other: "Khác",
    };
    return typeMap[type] || type;
  };

  const getSeverityLabel = (severity) => {
    const severityMap = {
      low: "Ảnh hưởng thấp",
      medium: "Ảnh hưởng cục bộ",
      high: "Ảnh hưởng diện rộng",
      critical: "Ngừng hoạt động",
    };
    return severityMap[severity] || severity;
  };

  if (loading) {
    return (
      <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden">
          <div className="p-8 text-center">
            <FiRefreshCw className="w-8 h-8 text-indigo-600 mx-auto animate-spin" />
            <p className="mt-4 text-gray-600">Đang tải chi tiết phiếu bồi thường...</p>
          </div>
        </div>
      </div>
      </>
    );
  }

  if (!ticket) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden">
          <div className="p-8 text-center">
            <FiAlertCircle className="w-8 h-8 text-red-500 mx-auto mb-4" />
            <p className="text-gray-600">Không tìm thấy phiếu bồi thường</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    );
  }

  const incident = ticket.incident_id;
  const compensationDetails = ticket.compensation_details || [];

  return (
    <>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
          <div>
            <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
              <FiDollarSign className="text-orange-600" />
              Chi tiết phiếu bồi thường
            </h3>
            <div className="text-xs text-gray-500 mt-1 font-mono">
              Mã phiếu: #{ticket._id?.slice(-6).toUpperCase()}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {/* Thông tin cơ bản */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
              <div className="flex items-center gap-2 text-blue-600 text-xs mb-1">
                <FiDollarSign className="w-4 h-4" />
                Tổng tiền bồi thường
              </div>
              <p className="font-bold text-2xl text-red-600">
                {ticket.total_fee?.toLocaleString()} đ
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <FiAlertCircle className="w-4 h-4" />
                Trạng thái
              </div>
              <div className="mt-1">
                {getStatusBadge(ticket.status)}
              </div>
            </div>
          </div>

          {/* Thông tin người chịu trách nhiệm */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
            <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
              <FiUser className="text-indigo-600" />
              Đối tượng chịu trách nhiệm
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-gray-500">Loại:</span>
                <p className="font-semibold text-gray-800 capitalize">
                  {getPayerTypeLabel(ticket.payer_type)}
                </p>
              </div>
              {ticket.incident?.causer_name && (
                <div>
                  <span className="text-xs text-gray-500">Người gây ra:</span>
                  <p className="font-semibold text-gray-800">
                    {ticket.incident.causer_name}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Thông tin sự cố */}
          {incident && (
            <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
              <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                <FiAlertCircle className="text-orange-600" />
                Thông tin sự cố liên quan
              </h4>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-xs text-gray-500">Loại sự cố:</span>
                  <p className="font-semibold text-gray-800">
                    {getIncidentTypeLabel(incident.type || "other")}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Mức ảnh hưởng:</span>
                  <p className="font-semibold text-gray-800">
                    {getSeverityLabel(incident.severity || "medium")}
                  </p>
                </div>
                {incident.room_id && (
                  <div>
                    <span className="text-xs text-gray-500">Phòng:</span>
                    <p className="font-semibold text-gray-800 flex items-center gap-1">
                      <FiMapPin className="text-indigo-600" size={14} />
                      Phòng {incident.room_id.room_number}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-xs text-gray-500">Mô tả:</span>
                  <p className="text-gray-700 italic bg-white p-2 rounded border border-orange-100">
                    "{incident.description || "N/A"}"
                  </p>
                </div>
                {incident.reporter_name && (
                  <div>
                    <span className="text-xs text-gray-500">Người báo cáo:</span>
                    <p className="font-semibold text-gray-800">
                      {incident.reporter_name}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chi tiết bồi thường thiết bị */}
          {compensationDetails.length > 0 && (
            <div className="bg-green-50 rounded-lg p-4 border border-green-100">
              <h4 className="font-bold text-sm text-gray-700 mb-3 flex items-center gap-2">
                <FiPackage className="text-green-600" />
                Chi tiết bồi thường thiết bị ({compensationDetails.length} thiết bị)
              </h4>
              <div className="space-y-3">
                {compensationDetails.map((detail, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg p-3 border border-green-200"
                  >
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-gray-500">Thiết bị:</span>
                        <p className="font-semibold text-gray-800">
                          {detail.equipment_info?.name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Tình trạng:</span>
                        <p className="font-semibold text-gray-800">
                          {getBrokenStateLabel(detail.broken_state)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Giải pháp:</span>
                        <p className="font-semibold text-gray-800">
                          {getResolutionLabel(detail.resolution)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Tiền phạt:</span>
                        <p className="font-bold text-red-600">
                          {detail.penalty_fee?.toLocaleString()} đ
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Ghi chú */}
          {ticket.note && (
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-100">
              <h4 className="font-bold text-sm text-gray-700 mb-2">Ghi chú</h4>
              <p className="text-sm text-gray-700 bg-white p-2 rounded border border-yellow-100">
                {ticket.note}
              </p>
            </div>
          )}

          {/* Thông tin thời gian */}
          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            {ticket.created_at && (
              <div className="flex items-center gap-2">
                <FiCalendar className="w-4 h-4" />
                <span>Tạo lúc: {new Date(ticket.created_at).toLocaleString("vi-VN")}</span>
              </div>
            )}
            {ticket.paid_at && (
              <div className="flex items-center gap-2">
                <FiCheckCircle className="w-4 h-4 text-green-600" />
                <span>Thanh toán lúc: {new Date(ticket.paid_at).toLocaleString("vi-VN")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300 transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
