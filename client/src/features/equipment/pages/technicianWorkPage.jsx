import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { 
  FiClock, FiCheckCircle, FiPlay, FiAlertCircle, 
  FiArrowRight, FiArrowLeft, FiRefreshCw, FiEye
} from "react-icons/fi";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import Toast from "../../../components/toast.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import { equipmentApi } from "../../api/equipmentApi.js";

export default function TechnicianWorkPage() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null
  });
  const [filterStatus, setFilterStatus] = useState("");

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const params = filterStatus ? { status: filterStatus } : {};
      const res = await equipmentApi.getMyInstallTickets(params);
      console.log("RES: ", res);
      setTickets(res.installs || []);
    } catch (error) {
      setToast({
        type: "error",
        message: "Lỗi khi tải danh sách công việc: " + (error.response?.data?.message || error.message)
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, [filterStatus]);

  const handleStart = async (ticket) => {
    setConfirmState({
      open: true,
      title: "Bắt đầu công việc",
      message: `Bạn có chắc chắn muốn bắt đầu phiếu ${ticket.type === 'install' ? 'lắp đặt' : 'tháo dỡ'} #${ticket._id.slice(-6)}?`,
      onConfirm: async () => {
        try {
          await equipmentApi.startInstallTicket(ticket._id);
          setToast({
            type: "success",
            message: "Đã bắt đầu công việc!"
          });
          setConfirmState({ ...confirmState, open: false });
          fetchTickets();
        } catch (error) {
          setToast({
            type: "error",
            message: error.response?.data?.message || "Lỗi khi bắt đầu công việc"
          });
        }
      }
    });
  };

  const handleComplete = async (ticket) => {
    setConfirmState({
      open: true,
      title: "Hoàn thành công việc",
      message: `Bạn có chắc chắn đã hoàn thành phiếu ${ticket.type === 'install' ? 'lắp đặt' : 'tháo dỡ'} #${ticket._id.slice(-6)}?`,
      onConfirm: async () => {
        try {
          await equipmentApi.completeInstallTicket(ticket._id);
          setToast({
            type: "success",
            message: "Đã hoàn thành công việc! Đang chờ admin xác nhận."
          });
          setConfirmState({ ...confirmState, open: false });
          fetchTickets();
        } catch (error) {
          setToast({
            type: "error",
            message: error.response?.data?.message || "Lỗi khi hoàn thành công việc"
          });
        }
      }
    });
  };

  const getStatusBadge = (status, started_at, completed_at) => {
    const statusMap = {
      assigned: { 
        label: "Chờ bắt đầu", 
        color: "bg-gray-100 text-gray-800",
        icon: <FiClock className="w-4 h-4" />
      },
      waiting_confirm: { 
        label: started_at && !completed_at ? "Đang làm" : "Chờ Quản lý xác nhận", 
        color: started_at && !completed_at ? "bg-blue-100 text-blue-800" : "bg-yellow-100 text-yellow-800",
        icon: started_at && !completed_at ? <FiPlay className="w-4 h-4" /> : <FiAlertCircle className="w-4 h-4" />
      },
      completed: { 
        label: "Hoàn tất", 
        color: "bg-green-100 text-green-800",
        icon: <FiCheckCircle className="w-4 h-4" />
      },
      expired: {
        label: "Hết hạn", 
        color: "bg-green-100 text-green-800",
        icon: <FiAlertCircle className="w-4 h-4" />
      }
    };
    console.log("STATUS: ", status);
    const statusInfo = statusMap[status] || statusMap.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.icon}
        {statusInfo.label}
      </span>
    );
  };

  const getTypeBadge = (type) => {
    return type === 'install' ? (
      <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-bold border border-indigo-100">
        <FiArrowRight /> Lắp đặt
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-100">
        <FiArrowLeft /> Tháo dỡ
      </span>
    );
  };

  const filteredTickets = filterStatus 
    ? tickets.filter(t => t.status === filterStatus)
    : tickets;

  const pendingTickets = tickets.filter(t => t.status === "pending" || (t.status === "waiting_confirm" && !t.started_at));
  const inProgressTickets = tickets.filter(t => t.status === "waiting_confirm" && t.started_at && !t.completed_at);
  const completedTickets = tickets.filter(t => t.completed_at);

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Công việc của tôi</h1>
              <p className="text-gray-600">Quản lý các phiếu lắp đặt/tháo dỡ thiết bị được gán</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Chờ bắt đầu</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{pendingTickets.length}</p>
                  </div>
                  <FiClock className="w-8 h-8 text-gray-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Đang làm</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{inProgressTickets.length}</p>
                  </div>
                  <FiPlay className="w-8 h-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Đã hoàn thành</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{completedTickets.length}</p>
                  </div>
                  <FiCheckCircle className="w-8 h-8 text-green-500" />
                </div>
              </div>
            </div>

            {/* Filter */}
            <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700">Lọc theo trạng thái:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Tất cả</option>
                  <option value="pending">Chờ bắt đầu</option>
                  <option value="waiting_confirm">Đang làm / Chờ xác nhận</option>
                  <option value="completed">Hoàn tất</option>
                </select>
                <button
                  onClick={fetchTickets}
                  className="ml-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  Làm mới
                </button>
              </div>
            </div>

            {/* Tickets List */}
            <div className="bg-white rounded-lg shadow-sm">
              {loading ? (
                <div className="p-12 text-center">
                  <FiRefreshCw className="w-8 h-8 text-gray-400 mx-auto animate-spin" />
                  <p className="mt-4 text-gray-600">Đang tải...</p>
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="p-12 text-center">
                  <FiAlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Chưa có công việc nào</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredTickets.map((ticket) => {
                    const roomDisplay = ticket.room_id ? `P.${ticket.room_id.room_number}` : "---";
                    const canStart = ticket.status === "assigned" || (ticket.status === "waiting_confirm" && !ticket.started_at);
                    const canComplete = ticket.status === "waiting_confirm" && ticket.started_at && !ticket.completed_at;

                    return (
                      <div key={ticket._id} className="p-6 hover:bg-gray-50 transition">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              {getTypeBadge(ticket.type)}
                              {getStatusBadge(ticket.status, ticket.started_at, ticket.completed_at)}
                              <span className="text-xs text-gray-500 font-mono">
                                #{ticket._id.slice(-6).toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Phòng</p>
                                <p className="font-semibold text-gray-900">{roomDisplay}</p>
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Ngày thực hiện</p>
                                <p className="font-semibold text-gray-900">
                                  {format(parseISO(ticket.install_date), "dd/MM/yyyy")}
                                </p>
                              </div>
                              {ticket.started_at && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Bắt đầu lúc</p>
                                  <p className="font-semibold text-gray-900">
                                    {format(parseISO(ticket.started_at), "dd/MM/yyyy HH:mm")}
                                  </p>
                                </div>
                              )}
                              {ticket.completed_at && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Hoàn thành lúc</p>
                                  <p className="font-semibold text-green-600">
                                    {format(parseISO(ticket.completed_at), "dd/MM/yyyy HH:mm")}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => {
                                setSelectedTicket(ticket);
                                setShowDetailModal(true);
                              }}
                              className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                            >
                              <FiEye className="w-4 h-4" />
                              Chi tiết
                            </button>

                            {canStart && (
                              <button
                                onClick={() => handleStart(ticket)}
                                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                              >
                                <FiPlay className="w-4 h-4" />
                                Bắt đầu
                              </button>
                            )}

                            {canComplete && (
                              <button
                                onClick={() => handleComplete(ticket)}
                                className="px-4 py-2 text-sm text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2 font-medium"
                              >
                                <FiCheckCircle className="w-4 h-4" />
                                Hoàn thành
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTicket(null);
          }}
          onRefresh={fetchTickets}
        />
      )}

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ ...confirmState, open: false })}
      />
    </div>
  );
}

// Detail Modal Component
function TicketDetailModal({ ticket, onClose, onRefresh }) {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fullTicket, setFullTicket] = useState(ticket);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await equipmentApi.getEquipmentInstallById(ticket._id);
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

  const roomDisplay = ticket.room_id ? `Phòng ${ticket.room_id.room_number}` : "---";
  const typeText = ticket.type === 'install' ? 'Lắp đặt' : 'Tháo dỡ';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-lg text-gray-800">Chi tiết phiếu {typeText}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <span className="text-xl">×</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Mã phiếu</p>
                <p className="font-mono font-bold text-gray-900">#{ticket._id.slice(-6).toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Loại</p>
                <p className="font-semibold text-gray-900">{typeText}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phòng</p>
                <p className="font-semibold text-gray-900">{roomDisplay}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Ngày thực hiện</p>
                <p className="font-semibold text-gray-900">
                  {format(parseISO(ticket.install_date), "dd/MM/yyyy")}
                </p>
              </div>
              {ticket.started_at && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Bắt đầu lúc</p>
                  <p className="font-semibold text-blue-600">
                    {format(parseISO(ticket.started_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              )}
              {ticket.completed_at && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Hoàn thành lúc</p>
                  <p className="font-semibold text-green-600">
                    {format(parseISO(ticket.completed_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <FiRefreshCw className="w-6 h-6 text-gray-400 mx-auto animate-spin" />
                <p className="mt-2 text-gray-600">Đang tải chi tiết...</p>
              </div>
            ) : details.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-3">Danh sách thiết bị ({details.length})</p>
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
                      <div key={index} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                        <div className="flex items-center justify-between">
                          <div>
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
              </div>
            ) : (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Danh sách thiết bị</p>
                <p className="text-sm text-gray-500">Chưa có thiết bị nào</p>
              </div>
            )}
          </div>
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
