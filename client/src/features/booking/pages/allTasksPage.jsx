import React, { useState, useEffect, useMemo } from 'react';
import {
  FiRefreshCw, FiEye, FiCheckCircle, FiAlertCircle,
  FiSearch, FiChevronDown, FiCalendar, FiClipboard, FiPlay,
  FiChevronLeft, FiChevronRight, FiHash, FiMapPin, FiInfo, FiStar
} from 'react-icons/fi';
import { bookingApi } from '../../api/bookingApi.js';
import { format } from 'date-fns';
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";

export default function AllTasksPage() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState("");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterType !== 'all') params.type = filterType;
      if (filterStatus !== 'all') params.status = filterStatus;
      const res = await bookingApi.getAllTasks(params);
      if (res.success) setTasks(res.tasks || []);
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

  const filteredTasks = useMemo(() => {
    if (!searchTerm) return tasks;
    const lowerTerm = searchTerm.toLowerCase();
    return tasks.filter(task => {
      const roomNum = task.room_id?.room_number?.toLowerCase() || "";
      const employeeName = (task.handled_by?.full_name || task.employee_id?.full_name || "").toLowerCase();
      return roomNum.includes(lowerTerm) || employeeName.includes(lowerTerm);
    });
  }, [tasks, searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentTasks = filteredTasks.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredTasks.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  const renderPaginationButtons = () => {
    if (totalPages <= 1) return null;
    const delta = 2;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - delta && i <= currentPage + delta)) {
        range.push(i);
      }
    }

    let l;
    for (let i of range) {
      if (l) {
        if (i - l === 2) rangeWithDots.push(l + 1);
        else if (i - l !== 1) rangeWithDots.push('...');
      }
      rangeWithDots.push(i);
      l = i;
    }

    return (
      <div className="flex gap-1.5">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all"
        >
          <FiChevronLeft size={16} />
        </button>
        {rangeWithDots.map((page, index) => (
          page === '...' ? (
            <span key={`dots-${index}`} className="px-3 py-1 text-slate-400 self-center font-bold">...</span>
          ) : (
            <button
              key={page}
              onClick={() => handlePageChange(page)}
              className={`w-9 h-9 rounded-xl text-xs font-black transition-all ${
                currentPage === page
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : "border border-slate-200 hover:border-indigo-300 text-slate-600"
              }`}
            >
              {page}
            </button>
          )
        ))}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-30 transition-all"
        >
          <FiChevronRight size={16} />
        </button>
      </div>
    );
  };

  const getTaskTypeLabel = (type) => {
    const labels = { cleaning: 'Dọn phòng', install: 'Kỹ thuật', equipment_import: 'Nhập kho', product_import: 'Nhập SP', incident: 'Sự cố' };
    return labels[type] || 'Khác';
  };

  const getTaskTypeColor = (type) => {
    const colors = { cleaning: 'bg-blue-50 text-blue-600 border-blue-100', install: 'bg-purple-50 text-purple-600 border-purple-100', equipment_import: 'bg-emerald-50 text-emerald-600 border-emerald-100', product_import: 'bg-amber-50 text-amber-600 border-amber-100', incident: 'bg-rose-50 text-rose-600 border-rose-100' };
    return colors[type] || 'bg-slate-50 text-slate-600 border-slate-100';
  };

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
                <p className="text-slate-500 font-medium tracking-wide">Điều hành và giám sát luồng công việc toàn hệ thống</p>
              </div>
              <button onClick={fetchTasks} className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 active:scale-95">
                <FiRefreshCw className={loading ? 'animate-spin' : ''} />
                <span>LÀM MỚI</span>
              </button>
            </div>

            <div className="bg-white p-3 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col xl:flex-row items-center gap-4">
              <div className="flex bg-slate-100 p-1 rounded-2xl w-full xl:w-auto overflow-x-auto no-scrollbar gap-1">
                {['all', 'cleaning', 'install', 'incident'].map(type => (
                  <button key={type} onClick={() => setFilterType(type)} className={`px-6 py-2.5 rounded-xl text-[11px] font-black transition-all ${filterType === type ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700 uppercase'}`}>
                    {type === 'all' ? 'Tất cả' : type === 'cleaning' ? 'Dọn dẹp' : type === 'install' ? 'Kỹ thuật' : 'Sự cố'}
                  </button>
                ))}
              </div>
              <div className="hidden xl:block w-px h-8 bg-slate-200 mx-2"></div>
              <div className="flex-1 flex gap-3 w-full">
                <div className="relative flex-1 group">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input type="text" placeholder="Tìm theo phòng hoặc tên nhân viên..." className="w-full pl-12 pr-4 py-3 bg-slate-50 border-transparent rounded-2xl text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-indigo-100 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                <div className="relative min-w-[180px]">
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="appearance-none w-full pl-4 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-black text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer shadow-sm">
                        <option value="all">TẤT CẢ TRẠNG THÁI</option>
                        <option value="pending">CHỜ XỬ LÝ</option>
                        <option value="in_progress">ĐANG LÀM</option>
                        <option value="completed">HOÀN THÀNH</option>
                        <option value="confirmed">ĐÃ XÁC NHẬN</option>
                    </select>
                    <FiChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
              <div className="flex-1 overflow-x-auto">
                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center py-40 gap-4">
                        <div className="w-12 h-12 border-4 border-slate-100 border-t-indigo-600 rounded-full animate-spin"></div>
                        <span className="font-black text-slate-300 uppercase tracking-widest text-xs">Đang tải dữ liệu...</span>
                    </div>
                ) : filteredTasks.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center py-40 gap-4 opacity-30">
                        <FiAlertCircle size={64} />
                        <span className="font-black uppercase tracking-[0.2em]">Trống dữ liệu</span>
                    </div>
                ) : (
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 border-b border-slate-100">
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Loại việc</th>
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Vị trí</th>
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhân sự</th>
                        <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Tình trạng</th>
                        <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {currentTasks.map((task) => (
                        <tr key={task._id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-8 py-5">
                            <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border tracking-tighter ${getTaskTypeColor(task.task_type)}`}>
                              {getTaskTypeLabel(task.task_type)}
                            </span>
                          </td>
                          <td className="px-8 py-5 font-black text-slate-900 text-base italic tracking-tighter">P.{task.room_id?.room_number || '---'}</td>
                          <td className="px-8 py-5">
                            <span className="font-bold text-slate-600 uppercase text-xs">{task.handled_by?.full_name || task.employee_id?.full_name || 'Hệ thống'}</span>
                          </td>
                          <td className="px-8 py-5">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
                                task.status === 'confirmed' || task.status === 'completed' ? 'bg-emerald-50 text-emerald-600' :
                                task.status === 'in_progress' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              {task.status}
                            </span>
                          </td>
                          <td className="px-8 py-5 text-center">
                            <button onClick={() => handleViewDetail(task)} className="p-3 bg-slate-100 rounded-2xl text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm active:scale-90">
                              <FiEye size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
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
        <TaskDetailModal task={selectedTask} onClose={() => { setShowDetailModal(false); setSelectedTask(null); }} onRefresh={fetchTasks} />
      )}
    </div>
  );
}

function TaskDetailModal({ task, onClose, onRefresh }) {
  const [confirming, setConfirming] = useState(false);
  const handleConfirmCleaning = async () => {
    if (!window.confirm('Xác nhận hoàn tất dọn dẹp cho phòng này?')) return;
    setConfirming(true);
    try { await bookingApi.confirmCleaning(task._id); onRefresh(); onClose(); }
    catch (error) { alert(error.message); } finally { setConfirming(false); }
  };

  const getNaturalSummary = () => {
    const room = task.room_id?.room_number ? `phòng ${task.room_id.room_number}` : "khu vực chung";
    const staff = task.handled_by?.full_name || task.employee_id?.full_name || "nhân sự hệ thống";
    return task.task_type === 'cleaning' ? `Hiện tại, ${room} đang được ${staff} phụ trách dọn dẹp vệ sinh.` : `Nhiệm vụ tại ${room} đang được thực hiện bởi ${staff}.`;
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 flex items-center justify-center p-4 backdrop-blur-sm text-slate-800">
      <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-4 border-white">
        <div className="px-6 py-5 border-b border-slate-50 flex justify-between items-center bg-white">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
            <h3 className="font-black text-[10px] text-slate-400 uppercase tracking-[0.2em]">Thông tin nhiệm vụ</h3>
          </div>
          <button onClick={onClose} className="text-slate-300 hover:text-red-500 transition-all font-bold text-xl">✕</button>
        </div>
        <div className="p-6 overflow-y-auto flex-1 no-scrollbar space-y-6">
          <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 flex flex-col items-center text-center">
             <div className="w-14 h-14 bg-white rounded-2xl shadow-sm flex items-center justify-center text-indigo-600 mb-4 border border-slate-100"><FiClipboard size={28} /></div>
             <p className="text-base font-bold text-slate-900 leading-snug">{getNaturalSummary()}</p>
             <div className="mt-3 px-3 py-1 bg-white rounded-full border border-slate-200 text-[9px] font-black text-indigo-600 uppercase tracking-widest shadow-sm">TRẠNG THÁI: {task.status}</div>
          </div>
          <div className="space-y-5">
            {task.note && (
              <div>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 px-1 text-center">Lời nhắn quản lý</p>
                <div className="bg-amber-50/50 p-4 rounded-2xl border-2 border-amber-100/50 italic text-amber-900 font-bold text-xs leading-relaxed text-center">"{task.note.replace(/[0-9a-fA-F]{20,}/g, (match) => `#${match.slice(-6).toUpperCase()}`)}"</div>
              </div>
            )}
            <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-2 px-1 text-center">Lịch trình</p>
                <div className="grid grid-cols-1 gap-1.5">
                    <TimeLineRow label="Khởi tạo" time={task.created_at} />
                    <TimeLineRow label="Bắt đầu" time={task.started_at} />
                    <TimeLineRow label="Hoàn tất" time={task.completed_at} />
                </div>
            </div>
          </div>
        </div>
        <div className="p-5 bg-slate-50 flex flex-col gap-2">
          {task.task_type === 'cleaning' && task.status === 'completed' && (
            <button onClick={handleConfirmCleaning} disabled={confirming} className="w-full py-4 bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 shadow-xl active:scale-95 transition-all">Xác nhận hoàn tất</button>
          )}
          <button onClick={onClose} className="w-full py-3 bg-white text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:text-slate-900 transition-all border border-slate-100">Đóng cửa sổ</button>
        </div>
      </div>
    </div>
  );
}

const TimeLineRow = ({ label, time }) => {
  if (!time) return null;
  return (
    <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-slate-100 shadow-sm">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">{label}</span>
      <span className="text-[10px] font-black text-slate-800">{format(new Date(time), 'HH:mm - dd/MM')}</span>
    </div>
  );
};