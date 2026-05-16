import React, { useState, useEffect, useMemo } from 'react';
import {
  FiRefreshCw, FiEye, FiCheckCircle, FiSearch, FiChevronDown,
  FiCalendar, FiClipboard, FiChevronLeft, FiChevronRight,
  FiMapPin, FiInfo, FiUser, FiClock, FiTool, FiAlertTriangle, FiPackage, FiTruck, FiCheckSquare, FiUserPlus, FiCheck
} from 'react-icons/fi';
import { bookingApi } from '../../api/bookingApi.js';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import AssignHousekeeperModal from "../components/assignHousekeeperModal.jsx";

const STATUS_OPTIONS_BY_TYPE = {
  all: [
    { value: 'all', label: 'TẤT CẢ TRẠNG THÁI' },
    { value: 'pending', label: 'CHỜ XỬ LÝ' },
    { value: 'in_progress', label: 'ĐANG THỰC HIỆN' },
    { value: 'completed', label: 'HOÀN THÀNH' },
    { value: 'new', label: 'MỚI TẠO (Sự cố)' },
    { value: 'resolved', label: 'ĐÃ XỬ LÝ (Sự cố)' }
  ],
  cleaning: [
    { value: 'all', label: 'TẤT CẢ' },
    { value: 'pending', label: 'CHỜ NHÂN VIÊN' },
    { value: 'in_progress', label: 'ĐANG DỌN DẸP' },
    { value: 'completed', label: 'ĐÃ DỌN XONG' },
    { value: 'confirmed', label: 'ĐÃ HOÀN TẤT' }
  ],
  install: [
    { value: 'all', label: 'TẤT CẢ' },
    { value: 'pending', label: 'CHỜ PHÂN CÔNG' },
    { value: 'assigned', label: 'ĐÃ PHÂN CÔNG' },
    { value: 'waiting_confirm', label: 'CHỜ NGHIỆM THU' },
    { value: 'completed', label: 'HOÀN THÀNH' },
    { value: 'expired', label: 'QUÁ HẠN' }
  ],
  incident: [
    { value: 'all', label: 'TẤT CẢ' },
    { value: 'new', label: 'MỚI TẠO' },
    { value: 'in_progress', label: 'ĐANG KHẮC PHỤC' },
    { value: 'resolved', label: 'ĐÃ XỬ LÝ XONG' },
    { value: 'closed', label: 'ĐÓNG HỒ SƠ' }
  ]
};

// --- MAPPING HIỂN THỊ ---
const TASK_TYPES = {
  cleaning: { label: 'Vệ sinh phòng', color: 'text-blue-600 bg-blue-50 border-blue-100', icon: <FiRefreshCw/> },
  install: { label: 'Kỹ thuật / Lắp đặt', color: 'text-purple-600 bg-purple-50 border-purple-100', icon: <FiTool/> },
  incident: { label: 'Xử lý sự cố', color: 'text-red-600 bg-red-50 border-red-100', icon: <FiAlertTriangle/> },
  equipment_import: { label: 'Nhập thiết bị', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: <FiTruck/> },
  product_import: { label: 'Nhập sản phẩm', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: <FiPackage/> }
};

const STATUS_MAP = {
  pending: { label: 'Chờ xử lý', color: 'bg-amber-100 text-amber-700' },
  in_progress: { label: 'Đang thực hiện', color: 'bg-indigo-100 text-indigo-700' },
  completed: { label: 'Hoàn thành', color: 'bg-emerald-100 text-emerald-700' },
  confirmed: { label: 'Đã xác nhận', color: 'bg-teal-100 text-teal-700' },

  assigned: { label: 'Đã phân công', color: 'bg-blue-100 text-blue-700' },
  waiting_confirm: { label: 'Chờ duyệt', color: 'bg-orange-100 text-orange-700' },
  expired: { label: 'Hết hạn', color: 'bg-red-100 text-red-700' },

  new: { label: 'Mới tạo', color: 'bg-rose-100 text-rose-700' },
  resolved: { label: 'Đã xử lý', color: 'bg-emerald-100 text-emerald-700' },
  closed: { label: 'Đã đóng', color: 'bg-gray-100 text-gray-700' },

  cancelled: { label: 'Đã hủy', color: 'bg-gray-200 text-gray-600' }
};

export default function AllTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [cleaningData, setCleaningData] = useState(null);

  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Kiểm tra role của user
  const isManager = useMemo(() => {
    const role = (user?.role || user?.system_role || localStorage.getItem("role") || "").toLowerCase();
    return role === "manager" || role === "admin";
  }, [user]);

  useEffect(() => {
    setFilterStatus('all');
  }, [filterType]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType !== 'all') params.type = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;

      const res = await bookingApi.getAllTasks(params);
      if (res.success) {
        setTasks(res.tasks || []);
      }
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    setCurrentPage(1);
  }, [filterType, filterStatus]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm]);

  const handleViewDetail = (task) => {
    setSelectedTask(task);
    setShowDetailModal(true);
  };

  const hasCleaningAssignee = (task) => {
    const handledBy = task?.handled_by;
    if (!handledBy) return false;
    if (typeof handledBy === "object") return !!handledBy._id;
    return true; // string/ObjectId
  };

  const handleAssignCleaning = async (task) => {
    try {
      // Lấy thông tin room_log_id từ task hoặc API
      let room_log_id = task.room_log_id?._id || task.room_log_id;
      
      if (!room_log_id) {
        // Nếu chưa có, gọi API để lấy
        const res = await bookingApi.getCleaningTaskByRoom({
          room_id: task.room_id?._id || task.room_id,
          booking_id: task.booking_id?._id || task.booking_id
        });
        room_log_id = res.room_log_id || null;
      }

      setCleaningData({
        room_id: task.room_id?._id || task.room_id,
        room_number: task.room_id?.room_number,
        booking_id: task.booking_id?._id || task.booking_id,
        room_log_id: room_log_id,
        task_id: task._id
      });
      setShowAssignModal(true);
    } catch (error) {
      console.error("Error preparing assign modal:", error);
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  const getHandlerName = (task) => {
    if (task.task_type === 'incident') return task.assignee_info?.assignee_id?.full_name;
    if (task.task_type.includes('import')) return task.employee_id?.full_name;
    return task.handled_by?.full_name;
  };

  const getLocation = (task) => {
    if (task.room_id) return `P.${task.room_id.room_number}`;
    return "Kho / Hệ thống";
  };

  const getContentSummary = (task) => {
    if (task.task_type === 'cleaning') {
        if (task.booking_info?.customer_name) {
            return `Dọn phòng cho khách ${task.booking_info.customer_name}`;
        }
        return task.note || "Vệ sinh phòng";
    }
    if (task.task_type === 'incident') return task.description;
    if (task.task_type === 'install') return task.type === 'install' ? 'Lắp đặt thiết bị' : 'Tháo dỡ thiết bị';
    if (task.task_type.includes('import')) return `Nhập ${task.import_details?.length || 0} mặt hàng`;
    return "---";
  };

  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    const lowerTerm = searchTerm.toLowerCase();
    return tasks.filter(task => {
      const location = getLocation(task).toLowerCase();
      const handler = (getHandlerName(task) || "").toLowerCase();
      const content = getContentSummary(task).toLowerCase();
      return location.includes(lowerTerm) || handler.includes(lowerTerm) || content.includes(lowerTerm);
    });
  }, [tasks, searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTasks = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  const renderPaginationButtons = () => {
    if (totalPages <= 1) return null;
    const range = [];
    const delta = 1;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
            range.push(i);
        } else if (range[range.length - 1] !== '...') {
            range.push('...');
        }
    }

    return (
      <div className="flex gap-1.5">
        <button onClick={() => handlePageChange(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-30"><FiChevronLeft /></button>
        {range.map((page, idx) => (
            page === '...'
            ? <span key={idx} className="px-2 text-slate-400 self-center">...</span>
            : <button key={idx} onClick={() => handlePageChange(page)} className={`w-8 h-8 rounded-lg text-xs font-bold ${currentPage === page ? "bg-indigo-600 text-white" : "border hover:bg-slate-50"}`}>{page}</button>
        ))}
        <button onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} className="p-2 rounded-lg border hover:bg-slate-50 disabled:opacity-30"><FiChevronRight /></button>
      </div>
    );
  };

  const currentStatusOptions = STATUS_OPTIONS_BY_TYPE[filterType] || STATUS_OPTIONS_BY_TYPE.all;

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-sm text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px] flex flex-col overflow-hidden">
        <Topbar />

        <main className="flex-1 overflow-y-auto p-8 no-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">

            <div className="flex flex-col md:flex-row justify-between items-end gap-4">
              <div>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight uppercase italic">Quản trị công việc</h1>
                <p className="text-slate-500 font-medium tracking-wide">Giám sát tiến độ: Vệ sinh, Kỹ thuật & Sự cố</p>
              </div>
              <button onClick={fetchTasks} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 active:scale-95">
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                <span>Cập nhật</span>
              </button>
            </div>

            <div className="bg-white p-3 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col xl:flex-row items-center gap-4">
              <div className="flex bg-slate-100 p-1 rounded-2xl w-full xl:w-auto overflow-x-auto no-scrollbar gap-1">
                {[
                    {id: 'all', label: 'Tất cả'},
                    {id: 'cleaning', label: 'Vệ sinh'},
                    {id: 'install', label: 'Kỹ thuật'},
                    {id: 'incident', label: 'Sự cố'}
                ].map(type => (
                  <button key={type.id} onClick={() => setFilterType(type.id)}
                    className={`px-5 py-2.5 rounded-xl text-[11px] font-black transition-all whitespace-nowrap ${filterType === type.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 uppercase'}`}>
                    {type.label.toUpperCase()}
                  </button>
                ))}
              </div>

              <div className="flex-1 flex gap-3 w-full">
                <div className="relative flex-1 group">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input type="text" placeholder="Tìm theo phòng, nhân viên..." className="w-full pl-11 pr-4 py-3 bg-slate-50 border-transparent rounded-2xl text-sm font-semibold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>

                <div className="relative min-w-[200px]">
                    <select
                        value={filterStatus}
                        onChange={(e) => setFilterStatus(e.target.value)}
                        className="appearance-none w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer shadow-sm uppercase"
                    >
                        {currentStatusOptions.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
              <div className="flex-1 overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100 text-left">
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại việc</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vị trí</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nội dung</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phụ trách</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái</th>
                        <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {loading ? (
                          <tr><td colSpan="6" className="py-20 text-center text-slate-400 font-bold">Đang tải dữ liệu...</td></tr>
                      ) : currentTasks.length === 0 ? (
                          <tr><td colSpan="6" className="py-20 text-center text-slate-400 font-bold opacity-50">Không có dữ liệu</td></tr>
                      ) : currentTasks.map((task) => {
                          const typeInfo = TASK_TYPES[task.task_type] || TASK_TYPES.cleaning;
                          const statusInfo = STATUS_MAP[task.status] || { label: task.status, color: 'bg-gray-100 text-gray-600' };

                          return (
                            <tr key={task._id} className="hover:bg-slate-50 transition-colors group">
                              <td className="px-8 py-5">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-tighter ${typeInfo.color}`}>
                                  {typeInfo.icon} {typeInfo.label}
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                  <span className="font-black text-slate-800 text-sm">{getLocation(task)}</span>
                              </td>
                              <td className="px-8 py-5 max-w-[200px]">
                                <p className="text-xs font-medium text-slate-600 truncate">{getContentSummary(task)}</p>
                              </td>
                              <td className="px-8 py-5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-600 uppercase text-xs">{getHandlerName(task) || 'Chưa gán'}</span>
                                  <span className="text-[10px] text-slate-400 font-medium">Nhân viên</span>
                                </div>
                              </td>
                              <td className="px-8 py-5">
                                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wide ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </span>
                              </td>
                              <td className="px-8 py-5 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  {task.task_type === 'cleaning' && isManager && (
                                    <>
                                      {/* Nút gán nhân viên dọn dẹp - hiển thị khi chưa có handled_by hoặc status là pending */}
                                      {!hasCleaningAssignee(task) && (
                                        <button
                                          onClick={() => handleAssignCleaning(task)}
                                          className="p-2 bg-yellow-50 rounded-xl text-yellow-600 hover:bg-yellow-100 transition-all shadow-sm active:scale-90"
                                          title="Gán nhân viên dọn dẹp"
                                        >
                                          <FiUserPlus size={16} />
                                        </button>
                                      )}
                                      {/* Nút xác nhận hoàn thành - hiển thị khi status là completed */}
                                      {task.status === 'completed' && (
                                        <button
                                          onClick={async () => {
                                            if (!window.confirm('Xác nhận hoàn tất dọn dẹp cho phòng này?')) return;
                                            try {
                                              await bookingApi.confirmCleaning(task._id);
                                              alert('Xác nhận hoàn thành dọn dẹp thành công!');
                                              fetchTasks();
                                            } catch (error) {
                                              alert('Lỗi: ' + (error.response?.data?.message || error.message));
                                            }
                                          }}
                                          className="p-2 bg-green-50 rounded-xl text-green-600 hover:bg-green-100 transition-all shadow-sm active:scale-90"
                                          title="Xác nhận hoàn thành dọn dẹp"
                                        >
                                          <FiCheck size={16} />
                                        </button>
                                      )}
                                    </>
                                  )}
                                  <button onClick={() => handleViewDetail(task)} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90">
                                    <FiEye size={18} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                      })}
                    </tbody>
                </table>
              </div>

              {!loading && filteredTasks.length > 0 && (
                <div className="flex items-center justify-between border-t border-slate-100 px-8 py-6 bg-white">
                  <div className="text-sm font-medium text-slate-500 italic">
                    Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredTasks.length)}</b> trên tổng số <b>{filteredTasks.length}</b> nhiệm vụ
                  </div>
                  {renderPaginationButtons()}
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {showDetailModal && selectedTask && (
        <TaskDetailModal 
          task={selectedTask} 
          onClose={() => { setShowDetailModal(false); setSelectedTask(null); }} 
          onRefresh={fetchTasks}
          isManager={isManager}
          onAssignCleaning={handleAssignCleaning}
        />
      )}

      {showAssignModal && cleaningData && (
        <AssignHousekeeperModal
          cleaningData={cleaningData}
          onClose={() => {
            setShowAssignModal(false);
            setCleaningData(null);
          }}
          onSuccess={() => {
            fetchTasks();
            setShowAssignModal(false);
            setCleaningData(null);
          }}
        />
      )}
    </div>
  );
}

function TaskDetailModal({ task, onClose, onRefresh, isManager, onAssignCleaning }) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirmCleaning = async () => {
    if (!window.confirm('Xác nhận hoàn tất dọn dẹp cho phòng này?')) return;
    setConfirming(true);
    try {
        await bookingApi.confirmCleaning(task._id);
        alert('Xác nhận hoàn thành dọn dẹp thành công!');
        onRefresh(); 
        onClose();
    }
    catch (error) { 
      alert('Lỗi: ' + (error.response?.data?.message || error.message)); 
    }
    finally { setConfirming(false); }
  };

  const needsAssignment = task.task_type === 'cleaning' && (!task.handled_by || (typeof task.handled_by === "object" && !task.handled_by?._id));
  const canConfirm = task.task_type === 'cleaning' && task.status === 'completed' && isManager;

  const typeConfig = TASK_TYPES[task.task_type] || TASK_TYPES.cleaning;
  const statusConfig = STATUS_MAP[task.status] || { label: task.status, color: 'bg-gray-100' };
  const renderSpecificDetails = () => {
    if (task.task_type === 'install') {
        const isInstall = task.type === 'install';
        return (
            <div className="space-y-3">
                <div className={`p-4 rounded-xl border ${isInstall ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                    <p className="text-[10px] font-black uppercase tracking-widest mb-1 opacity-70">YÊU CẦU</p>
                    <p className="font-bold text-sm flex items-center gap-2">
                        {isInstall ? <FiCheckCircle className="text-green-600"/> : <FiRefreshCw className="text-red-600"/>}
                        {isInstall ? "LẮP ĐẶT THIẾT BỊ " : "THÁO DỠ THIẾT BỊ "}
                    </p>
                </div>

                {task.install_details?.length > 0 && (
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">DANH SÁCH THIẾT BỊ</p>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                            {task.install_details.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">{item.equipment_id?.category_id?.name || "Thiết bị"}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">
                                            Mã: {item.equipment_id?.code || item.equipment_id?._id?.toString().slice(-6).toUpperCase() || "N/A"}
                                        </p>
                                    </div>
                                    <span className={`text-[10px] font-black px-2 py-1 rounded uppercase ${isInstall ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                        {isInstall ? 'Lắp vào' : 'Tháo ra'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (task.task_type.includes('import')) {
        const details = task.import_details || [];
        return (
            <div className="space-y-3">
                <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">TỔNG QUAN</p>
                    <p className="font-bold text-emerald-900 text-sm">Nhập {details.length} loại mặt hàng vào kho</p>
                </div>
                {details.length > 0 && (
                    <div>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">CHI TIẾT HÀNG HÓA</p>
                        <div className="space-y-2 max-h-[150px] overflow-y-auto pr-1 custom-scrollbar">
                            {details.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-white border border-slate-200 rounded-xl">
                                    <div>
                                        <p className="text-xs font-bold text-slate-700">
                                            {item.category_id?.name || item.service_id?.name || "Hàng hóa"}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold text-indigo-600">SL: {item.quantity}</span>
                                        <p className="text-[10px] text-slate-400">{item.total_import_price?.toLocaleString()} đ</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    if (task.task_type === 'incident') {
        return (
            <div className="space-y-3">
                <div className="p-4 bg-red-50 rounded-xl border border-red-100">
                    <p className="text-[10px] font-black text-red-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                        <FiAlertTriangle/> MÔ TẢ SỰ CỐ
                    </p>
                    <p className="font-bold text-red-900 text-sm italic">"{task.description}"</p>
                </div>

                {(task.resolution_note || task.note) && (
                    <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                        <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-1">
                            <FiCheckSquare/> KẾT QUẢ XỬ LÝ
                        </p>
                        <p className="font-bold text-emerald-900 text-sm">
                            "{task.resolution_note || task.note}"
                        </p>
                    </div>
                )}

                <div className="flex gap-2">
                    <div className="flex-1 p-3 bg-white border border-slate-200 rounded-xl">
                        <p className="text-[10px] text-slate-400 uppercase">Mức độ</p>
                        <p className="text-xs font-bold text-red-600 uppercase">{task.severity || 'Thường'}</p>
                    </div>
                    <div className="flex-1 p-3 bg-white border border-slate-200 rounded-xl">
                        <p className="text-[10px] text-slate-400 uppercase">Người báo</p>
                        <p className="text-xs font-bold text-slate-700 truncate">{task.reporter_id?.email || 'N/A'}</p>
                    </div>
                </div>
            </div>
        );
    }

    if (task.booking_info) {
        return (
            <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 relative overflow-hidden group">
                    <FiCalendar className="absolute -right-4 -bottom-4 text-blue-100/50 w-24 h-24 rotate-12 group-hover:rotate-0 transition-transform duration-500" />

                    <div className="flex justify-between items-start relative z-10 mb-3">
                        <div>
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">KHÁCH HÀNG</p>
                            <p className="text-base font-bold text-blue-900">{task.booking_info.customer_name || "Khách vãng lai"}</p>
                            {task.booking_info.customer_phone && <p className="text-[11px] font-medium text-slate-500 mt-0.5">{task.booking_info.customer_phone}</p>}
                        </div>
                        <span className="px-2 py-1 bg-white rounded-lg text-[9px] font-bold text-blue-600 shadow-sm border border-blue-100 uppercase">
                            {task.booking_info.status}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 relative z-10">
                        <div className="bg-white/80 p-2.5 rounded-xl border border-blue-50 shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Check-in</p>
                            <p className="text-xs font-black text-slate-700">
                                {format(new Date(task.booking_info.checkin), 'HH:mm dd/MM', { locale: vi })}
                            </p>
                        </div>
                        <div className="bg-white/80 p-2.5 rounded-xl border border-blue-50 shadow-sm">
                            <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Check-out</p>
                            <p className="text-xs font-black text-slate-700">
                                {format(new Date(task.booking_info.checkout), 'HH:mm dd/MM', { locale: vi })}
                            </p>
                        </div>
                    </div>
                </div>

                {task.note && !task.note.includes('booking') && (
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">GHI CHÚ THÊM</p>
                        <p className="text-xs text-slate-600 italic">"{task.note}"</p>
                    </div>
                )}

                {task.completion_images?.length > 0 && (
                    <CompletionPhotos images={task.completion_images} />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">GHI CHÚ</p>
                <p className="font-bold text-blue-900 text-sm">
                    {task.note ? `"${task.note}"` : "Vệ sinh phòng theo quy trình chuẩn."}
                </p>
            </div>

            {task.completion_images?.length > 0 && (
                <CompletionPhotos images={task.completion_images} />
            )}
        </div>
    );
  };

  const workerName = task.task_type === 'incident'
    ? task.assignee_info?.assignee_id?.full_name
    : task.handled_by?.full_name;

  const workerPhone = task.task_type === 'incident'
    ? task.assignee_info?.assignee_id?.phone_number
    : task.handled_by?.phone_number;

  const createdTime = task.created_at || task.occured_at || task.import_date || task.install_date;
  const startedTime = task.started_at || task.assignee_info?.assigned_at;
  const completedTime = task.completed_at || task.resolved_at || task.confirmed_at;

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm text-slate-800">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-4 border-white animate-fade-in-up">

        <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center bg-white">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xl ${typeConfig.color.split(' ')[1]}`}>
                {typeConfig.icon}
            </div>
            <div>
                <h3 className="font-black text-sm text-slate-800 uppercase tracking-wide">{typeConfig.label}</h3>
                <p className="text-[10px] font-bold text-slate-400">ID: #{task._id.slice(-6).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition font-bold text-lg">✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 no-scrollbar space-y-6">

          <div className="bg-slate-50 p-5 rounded-[2rem] border border-slate-100 text-center relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-400 to-transparent opacity-50"></div>
             <p className="text-3xl font-black text-slate-800 mb-1">
                {task.room_id ? `P.${task.room_id.room_number}` : "KHO TỔNG"}
             </p>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Vị trí thực hiện</p>
             <div className={`inline-block px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wide ${statusConfig.color}`}>
                {statusConfig.label}
             </div>
          </div>

          {renderSpecificDetails()}

          <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold">
                    <FiUser />
                </div>
                <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phụ trách chính</p>
                    <p className="text-sm font-bold text-slate-800">
                        {workerName || "Chưa phân công"}
                    </p>
                </div>
             </div>
             {workerPhone && <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">{workerPhone}</span>}
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">TIẾN ĐỘ THỜI GIAN</p>
            <div className="grid gap-2">
                <TimeLineRow label="Tạo / Tiếp nhận" time={createdTime} />
                <TimeLineRow label="Bắt đầu" time={startedTime} />
                <TimeLineRow label="Hoàn tất" time={completedTime} highlight={!!completedTime} />
                {task.confirmed_at && <TimeLineRow label="Admin xác nhận" time={task.confirmed_at} isLast />}
                {task.closed_at && <TimeLineRow label="Đóng hồ sơ" time={task.closed_at} isLast />}
            </div>
          </div>
        </div>

        <div className="p-5 bg-slate-50 flex flex-col gap-2 border-t border-slate-100">
          {task.task_type === 'cleaning' && isManager && (
            <>
              {/* Nút gán nhân viên dọn dẹp */}
              {needsAssignment && (
                <button 
                  onClick={() => {
                    onAssignCleaning(task);
                    onClose();
                  }}
                  className="w-full py-3 bg-yellow-500 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-yellow-600 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <FiUserPlus size={16}/> Gán nhân viên dọn dẹp
                </button>
              )}
              {/* Nút xác nhận hoàn thành */}
              {canConfirm && (
                <button 
                  onClick={handleConfirmCleaning} 
                  disabled={confirming} 
                  className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <FiCheckCircle size={16}/> {confirming ? 'Đang xác nhận...' : 'Xác nhận hoàn tất'}
                </button>
              )}
            </>
          )}
          <button onClick={onClose} className="w-full py-3 bg-white text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-slate-800 hover:bg-slate-100 transition-all border border-slate-200">
            Đóng cửa sổ
          </button>
        </div>
      </div>
    </div>
  );
}

const CompletionPhotos = ({ images }) => (
    <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
            📷 Ảnh minh chứng ({images.length})
        </p>
        <div className="grid grid-cols-3 gap-2">
            {images.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noreferrer"
                    className="block aspect-square rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm hover:shadow-md hover:scale-105 transition-all">
                    <img src={url} alt={`proof-${idx}`} className="w-full h-full object-cover" />
                </a>
            ))}
        </div>
    </div>
);

const TimeLineRow = ({ label, time, highlight }) => {
  if (!time) return null;
  return (
    <div className={`flex items-center justify-between p-3 rounded-xl border border-slate-100 shadow-sm ${highlight ? 'bg-indigo-50/50 border-indigo-100' : 'bg-white'}`}>
      <span className={`text-[10px] font-bold uppercase tracking-tighter ${highlight ? 'text-indigo-600' : 'text-slate-400'}`}>{label}</span>
      <span className={`text-[10px] font-black ${highlight ? 'text-indigo-700' : 'text-slate-700'}`}>{format(new Date(time), 'HH:mm - dd/MM/yyyy', { locale: vi })}</span>
    </div>
  );
};