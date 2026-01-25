import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { 
  FiClock, FiCheckCircle, FiPlay, FiAlertCircle, 
  FiRefreshCw, FiEye, FiHome
} from "react-icons/fi";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import Toast from "../../../components/toast.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import { bookingApi } from "../../api/bookingApi.js";

export default function HousekeeperWorkPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null
  });
  const [filterStatus, setFilterStatus] = useState("");

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await bookingApi.getMyCleaningTasks();
      setTasks(res.tasks || []);
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
    fetchTasks();
  }, [filterStatus]);

  const handleStart = async (task) => {
    setConfirmState({
      open: true,
      title: "Bắt đầu công việc",
      message: `Bạn có chắc chắn muốn bắt đầu dọn dẹp phòng ${task.room_id?.room_number || 'N/A'}?`,
      onConfirm: async () => {
        try {
          await bookingApi.startCleaningTask(task._id);
          setToast({
            type: "success",
            message: "Đã bắt đầu công việc!"
          });
          setConfirmState({ ...confirmState, open: false });
          fetchTasks();
        } catch (error) {
          setToast({
            type: "error",
            message: error.response?.data?.message || "Lỗi khi bắt đầu công việc"
          });
        }
      }
    });
  };

  const handleComplete = async (task) => {
    setConfirmState({
      open: true,
      title: "Hoàn thành công việc",
      message: `Bạn có chắc chắn đã hoàn thành dọn dẹp phòng ${task.room_id?.room_number || 'N/A'}?`,
      onConfirm: async () => {
        try {
          await bookingApi.completeCleaningTask(task._id);
          setToast({
            type: "success",
            message: "Đã hoàn thành công việc! Đang chờ admin xác nhận."
          });
          setConfirmState({ ...confirmState, open: false });
          fetchTasks();
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
      pending: { 
        label: "Chờ bắt đầu", 
        color: "bg-gray-100 text-gray-800",
        icon: <FiClock className="w-4 h-4" />
      },
      in_progress: { 
        label: "Đang làm", 
        color: "bg-blue-100 text-blue-800",
        icon: <FiPlay className="w-4 h-4" />
      },
      completed: { 
        label: "Chờ xác nhận", 
        color: "bg-yellow-100 text-yellow-800",
        icon: <FiAlertCircle className="w-4 h-4" />
      },
      confirmed: { 
        label: "Đã xác nhận", 
        color: "bg-green-100 text-green-800",
        icon: <FiCheckCircle className="w-4 h-4" />
      }
    };
    const statusInfo = statusMap[status] || statusMap.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.icon}
        {statusInfo.label}
      </span>
    );
  };

  const filteredTasks = filterStatus 
    ? tasks.filter(t => t.status === filterStatus)
    : tasks;

  const pendingTasks = tasks.filter(t => t.status === "pending");
  const inProgressTasks = tasks.filter(t => t.status === "in_progress");
  const completedTasks = tasks.filter(t => t.status === "completed" || t.status === "confirmed");

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
              <p className="text-gray-600">Quản lý các công việc dọn dẹp phòng được gán</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-gray-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Chờ bắt đầu</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{pendingTasks.length}</p>
                  </div>
                  <FiClock className="w-8 h-8 text-gray-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Đang làm</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{inProgressTasks.length}</p>
                  </div>
                  <FiPlay className="w-8 h-8 text-blue-500" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm p-4 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Đã hoàn thành</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{completedTasks.length}</p>
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
                  <option value="in_progress">Đang làm</option>
                  <option value="completed">Chờ xác nhận</option>
                  <option value="confirmed">Đã xác nhận</option>
                </select>
                <button
                  onClick={fetchTasks}
                  className="ml-auto px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 flex items-center gap-2"
                >
                  <FiRefreshCw className="w-4 h-4" />
                  Làm mới
                </button>
              </div>
            </div>

            {/* Tasks List */}
            <div className="bg-white rounded-lg shadow-sm">
              {loading ? (
                <div className="p-12 text-center">
                  <FiRefreshCw className="w-8 h-8 text-gray-400 mx-auto animate-spin" />
                  <p className="mt-4 text-gray-600">Đang tải...</p>
                </div>
              ) : filteredTasks.length === 0 ? (
                <div className="p-12 text-center">
                  <FiAlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">Chưa có công việc nào</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {filteredTasks.map((task) => {
                    const roomDisplay = task.room_id ? `P.${task.room_id.room_number}` : "---";
                    const canStart = task.status === "pending";
                    const canComplete = task.status === "in_progress";

                    return (
                      <div key={task._id} className="p-6 hover:bg-gray-50 transition">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-bold border border-indigo-100">
                                <FiHome /> Dọn dẹp
                              </span>
                              {getStatusBadge(task.status, task.started_at, task.completed_at)}
                              <span className="text-xs text-gray-500 font-mono">
                                #{task._id.slice(-6).toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Phòng</p>
                                <p className="font-semibold text-gray-900">{roomDisplay}</p>
                                {task.room_id?.room_category_id && (
                                  <p className="text-xs text-gray-500 mt-1">
                                    {task.room_id.room_category_id.name || task.room_id.room_category_id}
                                  </p>
                                )}
                              </div>
                              <div>
                                <p className="text-xs text-gray-500 mb-1">Ngày tạo</p>
                                <p className="font-semibold text-gray-900">
                                  {format(parseISO(task.created_at), "dd/MM/yyyy")}
                                </p>
                              </div>
                              {task.started_at && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Bắt đầu lúc</p>
                                  <p className="font-semibold text-blue-600">
                                    {format(parseISO(task.started_at), "dd/MM/yyyy HH:mm")}
                                  </p>
                                </div>
                              )}
                              {task.completed_at && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Hoàn thành lúc</p>
                                  <p className="font-semibold text-green-600">
                                    {format(parseISO(task.completed_at), "dd/MM/yyyy HH:mm")}
                                  </p>
                                </div>
                              )}
                              {task.confirmed_at && (
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Xác nhận lúc</p>
                                  <p className="font-semibold text-indigo-600">
                                    {format(parseISO(task.confirmed_at), "dd/MM/yyyy HH:mm")}
                                  </p>
                                </div>
                              )}
                            </div>
                            
                            {task.note && (
                              <div className="mt-3">
                                <p className="text-xs text-gray-500 mb-1">Ghi chú</p>
                                <p className="text-sm text-gray-700">{task.note}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => {
                                setSelectedTask(task);
                                setShowDetailModal(true);
                              }}
                              className="px-3 py-2 text-sm text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                            >
                              <FiEye className="w-4 h-4" />
                              Chi tiết
                            </button>

                            {canStart && (
                              <button
                                onClick={() => handleStart(task)}
                                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
                              >
                                <FiPlay className="w-4 h-4" />
                                Bắt đầu
                              </button>
                            )}

                            {canComplete && (
                              <button
                                onClick={() => handleComplete(task)}
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
      {showDetailModal && selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedTask(null);
          }}
          onRefresh={fetchTasks}
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
function TaskDetailModal({ task, onClose, onRefresh }) {
  const roomDisplay = task.room_id ? `Phòng ${task.room_id.room_number}` : "---";
  const roomCategory = task.room_id?.room_category_id?.name || task.room_id?.room_category_id || "---";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gray-50 border-b border-gray-100 px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-bold border border-indigo-100">
              <FiHome /> Dọn dẹp
            </span>
            <h3 className="font-bold text-lg text-gray-800">Chi tiết công việc dọn dẹp</h3>
            <span className="text-xs text-gray-500 font-mono">#{task._id.slice(-6).toUpperCase()}</span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <span className="text-xl">×</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">Mã công việc</p>
                <p className="font-mono font-bold text-gray-900">#{task._id.slice(-6).toUpperCase()}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Trạng thái</p>
                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                  task.status === "pending" ? "bg-gray-100 text-gray-800" :
                  task.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                  task.status === "completed" ? "bg-yellow-100 text-yellow-800" :
                  "bg-green-100 text-green-800"
                }`}>
                  {task.status === "pending" ? "Chờ bắt đầu" :
                   task.status === "in_progress" ? "Đang làm" :
                   task.status === "completed" ? "Chờ xác nhận" :
                   "Đã xác nhận"}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Phòng</p>
                <p className="font-semibold text-gray-900">{roomDisplay}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Loại phòng</p>
                <p className="font-semibold text-gray-900">{roomCategory}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Ngày tạo</p>
                <p className="font-semibold text-gray-900">
                  {format(parseISO(task.created_at), "dd/MM/yyyy HH:mm")}
                </p>
              </div>
              {task.started_at && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Bắt đầu lúc</p>
                  <p className="font-semibold text-blue-600">
                    {format(parseISO(task.started_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              )}
              {task.completed_at && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Hoàn thành lúc</p>
                  <p className="font-semibold text-green-600">
                    {format(parseISO(task.completed_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              )}
              {task.confirmed_at && (
                <div>
                  <p className="text-xs text-gray-500 mb-1">Xác nhận lúc</p>
                  <p className="font-semibold text-indigo-600">
                    {format(parseISO(task.confirmed_at), "dd/MM/yyyy HH:mm")}
                  </p>
                </div>
              )}
            </div>

            {task.note && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Ghi chú</p>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-700">{task.note}</p>
                </div>
              </div>
            )}

            {task.booking_id && (
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Thông tin booking</p>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <p className="text-sm text-gray-700">
                    Mã booking: <span className="font-mono">#{task.booking_id._id?.slice(-6) || task.booking_id.slice(-6)}</span>
                  </p>
                </div>
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
