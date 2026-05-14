import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { FiX, FiRefreshCw, FiArrowRight, FiArrowLeft, FiUser, FiCalendar, FiMapPin } from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi.js";

export default function InstallTicketDetailModal({ ticket, onClose }) {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fullTicket, setFullTicket] = useState(ticket);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await equipmentApi.getEquipmentInstallById(ticket._id);
        console.log("installl detail: ", res);
        if (res.success) {
          setFullTicket(res.install);
          setDetails(res.install.install_details || []);
        }
      } catch (error) {
        console.error("Error fetching details:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [ticket._id]);

  const roomDisplay = fullTicket.room_id ? `Phòng ${fullTicket.room_info?.room_number}` : "---";
  const typeText = fullTicket.type === 'install' ? 'Lắp đặt' : 'Tháo dỡ';
  const typeBadge = fullTicket.type === 'install' ? (
    <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-bold border border-indigo-100">
      <FiArrowRight /> Lắp đặt
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-100">
      <FiArrowLeft /> Tháo dỡ
    </span>
  );

  const getStatusBadge = (status, completed_at) => {
    const statusMap = {
      pending: { label: "Chờ xử lý", color: "bg-gray-100 text-gray-800" },
      waiting_confirm: { 
        label: completed_at ? "Chờ admin xác nhận" : "Đang xử lý", 
        color: completed_at 
          ? "bg-yellow-100 text-yellow-800" 
          : "bg-blue-100 text-blue-800" 
      },
      completed: { label: "Hoàn tất", color: "bg-green-100 text-green-800" },
    };
    const statusInfo = statusMap[status] || statusMap.pending;
    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {typeBadge}
            <h3 className="font-bold text-lg text-gray-800">Chi tiết phiếu {typeText}</h3>
            <span className="text-xs text-gray-500 font-mono">#{fullTicket._id.slice(-6).toUpperCase()}</span>
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
                    <FiMapPin className="w-4 h-4" />
                    Phòng
                  </div>
                  <p className="font-semibold text-gray-900">{roomDisplay}</p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                    <FiCalendar className="w-4 h-4" />
                    Ngày thực hiện
                  </div>
                  <p className="font-semibold text-gray-900">
                    {format(parseISO(fullTicket.install_date), "dd/MM/yyyy")}
                  </p>
                </div>

                {fullTicket.handled_by && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                      <FiUser className="w-4 h-4" />
                      Nhân viên được gán
                    </div>
                    <p className="font-semibold text-gray-900">
                      {fullTicket.handler_info.full_name || 'N/A'}
                    </p>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-gray-500 text-xs mb-1">Trạng thái</div>
                  {getStatusBadge(fullTicket.status, fullTicket.completed_at)}
                </div>

                {fullTicket.started_at && (
                  <div className="bg-blue-50 rounded-lg p-4">
                    <div className="text-blue-600 text-xs mb-1">Bắt đầu lúc</div>
                    <p className="font-semibold text-blue-900">
                      {format(parseISO(fullTicket.started_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                )}

                {fullTicket.completed_at && (
                  <div className="bg-green-50 rounded-lg p-4">
                    <div className="text-green-600 text-xs mb-1">Hoàn thành lúc</div>
                    <p className="font-semibold text-green-900">
                      {format(parseISO(fullTicket.completed_at), "dd/MM/yyyy HH:mm")}
                    </p>
                  </div>
                )}
              </div>

              {/* Danh sách thiết bị */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">
                  Danh sách thiết bị ({details.length})
                </h4>
                {details.length > 0 ? (
                  <div className="space-y-2">
                    {(() => {
                      // Nhóm thiết bị theo category
                      const groupedByCategory = {};
                      details.forEach((detail) => {
                        const category = detail.equipment_id?.category_id;
                        const categoryId = category?._id || category || 'unknown';
                        const categoryName = category?.name || "Thiết bị";
                        
                        if (!groupedByCategory[categoryId]) {
                          groupedByCategory[categoryId] = {
                            name: categoryName,
                            description: category?.description,
                            count: 0
                          };
                        }
                        groupedByCategory[categoryId].count += 1;
                      });

                      // Hiển thị danh sách đã nhóm
                      return Object.values(groupedByCategory).map((group, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">
                                {group.name} {group.count > 1 && <span className="text-indigo-600">(x{group.count})</span>}
                              </p>
                              {group.description && (
                                <p className="text-xs text-gray-500 mt-1">{group.description}</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
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
