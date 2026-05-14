import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO, addHours } from "date-fns";
import {
  FiClock, FiCheckCircle, FiPlay, FiAlertCircle,
  FiRefreshCw, FiEye, FiHome, FiSearch, FiCalendar, FiArrowDown, FiArrowUp, FiZap
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
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });
  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await bookingApi.getMyCleaningTasks();
      console.log("Fetched tasks:", res);
      setTasks(res.tasks || []);
    } catch (error) {
      setToast({ type: "error", message: "Lỗi tải dữ liệu: " + (error.response?.data?.message || error.message) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleAction = (task, actionType) => {
    const isStart = actionType === 'start';
    setConfirmState({
      open: true,
      title: isStart ? "Bắt đầu dọn dẹp" : "Hoàn tất dọn dẹp",
      message: `Xác nhận ${isStart ? 'bắt đầu' : 'hoàn thành'} dọn dẹp phòng ${task.room?.room_number || 'N/A'}?`,
      onConfirm: async () => {
        try {
          if (isStart) await bookingApi.startCleaningTask(task._id);
          else await bookingApi.completeCleaningTask(task._id);
          setToast({ type: "success", message: "Thao tác thành công!" });
          setConfirmState({ ...confirmState, open: false });
          fetchTasks();
        } catch (error) {
          setToast({ type: "error", message: error.response?.data?.message || "Lỗi thao tác" });
        }
      }
    });
  };

  const processedTasks = useMemo(() => {
    let result = tasks.filter(t => {
      if (filterStatus === 'pending' && t.status !== 'pending') return false;
      if (filterStatus === 'in_progress' && t.status !== 'in_progress') return false;
      if (filterStatus === 'completed' && (t.status !== 'completed' && t.status !== 'confirmed')) return false;

      if (!searchTerm) return true;
      const lowerTerm = searchTerm.toLowerCase();
      const roomNum = t.room?.room_number?.toLowerCase() || "";
      return roomNum.includes(lowerTerm) || t._id.toLowerCase().includes(lowerTerm);
    });

    result.sort((a, b) => {
      const dateA = new Date(a.created_at);
      const dateB = new Date(b.created_at);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [tasks, searchTerm, sortOrder, filterStatus]);

  const stats = useMemo(() => {
    return {
      pending: tasks.filter(t => t.status === "pending").length,
      doing: tasks.filter(t => t.status === "in_progress").length,
      done: tasks.filter(t => t.status === "completed" || t.status === "confirmed").length
    };
  }, [tasks]);

  const getStatusBadge = (status) => {
    const config = {
      pending: { label: "CHỜ BẮT ĐẦU", color: "bg-red-600 text-white border-red-700", icon: <FiClock /> },
      in_progress: { label: "ĐANG DỌN DẸP", color: "bg-blue-600 text-white border-blue-700", icon: <FiPlay /> },
      completed: { label: "CHỜ XÁC NHẬN", color: "bg-orange-500 text-white border-orange-600", icon: <FiAlertCircle /> },
      confirmed: { label: "ĐÃ HOÀN TẤT", color: "bg-emerald-600 text-white border-emerald-700", icon: <FiCheckCircle /> }
    };
    const info = config[status] || config.pending;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black border shadow-sm ${info.color}`}>
        {info.icon} {info.label}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-sm text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px] flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 no-scrollbar">
          <div className="max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Nhiệm vụ buồng phòng</h1>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 opacity-70">Làm sạch nhanh trong 02 giờ để sẵn sàng đón khách</p>
              </div>
              <button onClick={fetchTasks} className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-slate-200 rounded-xl font-bold text-slate-600 hover:border-indigo-500 hover:text-indigo-600 transition-all shadow-sm active:scale-95">
                <FiRefreshCw className={loading ? "animate-spin" : ""} />
                <span>Cập nhật mới</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Chờ thực hiện" count={stats.pending} icon={FiClock} color="orange" active={filterStatus === 'pending'} onClick={() => setFilterStatus('pending')} />
              <StatCard label="Đang dọn dẹp" count={stats.doing} icon={FiPlay} color="blue" active={filterStatus === 'in_progress'} onClick={() => setFilterStatus('in_progress')} />
              <StatCard label="Đã hoàn thành" count={stats.done} icon={FiCheckCircle} color="green" active={filterStatus === 'completed'} onClick={() => setFilterStatus('completed')} />
            </div>

            <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-100 flex flex-col xl:flex-row items-center gap-3 sticky top-0 z-10">
              <div className="flex bg-slate-100 p-1.5 rounded-xl w-full xl:w-auto overflow-x-auto no-scrollbar">
                <FilterTab label="Tất cả" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
                <FilterTab label="Chờ làm" active={filterStatus === 'pending'} onClick={() => setFilterStatus('pending')} count={stats.pending} />
                <FilterTab label="Đang làm" active={filterStatus === 'in_progress'} onClick={() => setFilterStatus('in_progress')} count={stats.doing} />
                <FilterTab label="Hoàn tất" active={filterStatus === 'completed'} onClick={() => setFilterStatus('completed')} />
              </div>
              <div className="hidden xl:block w-px h-6 bg-slate-200 mx-1"></div>
              <div className="flex flex-row items-center gap-2 w-full xl:flex-1">
                <div className="flex bg-slate-100 p-1 rounded-md shrink-0 border border-slate-200">
                  <button onClick={() => setSortOrder("desc")} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${sortOrder === "desc" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><FiArrowDown size={14}/> MỚI NHẤT</button>
                  <button onClick={() => setSortOrder("asc")} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${sortOrder === "asc" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><FiArrowUp size={14}/> CŨ NHẤT</button>
                </div>
                <div className="relative flex-1 group">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input type="text" placeholder="Tìm nhanh phòng..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
              {loading ? (
                <div className="col-span-full py-20 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                  <span className="font-black text-slate-400 uppercase text-xs">Đang lấy danh sách phòng...</span>
                </div>
              ) : processedTasks.length === 0 ? (
                <div className="col-span-full p-20 text-center bg-white rounded-3xl border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
                  <FiHome size={48} className="text-slate-200" />
                  <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Chưa có phòng nào cần dọn</p>
                </div>
              ) : (
                processedTasks.map((task) => (
                  <TaskCard key={task._id} task={task} onView={() => { setSelectedTask(task); setShowDetailModal(true); }} onAction={handleAction} getStatusBadge={getStatusBadge} />
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {showDetailModal && selectedTask && <TaskDetailModal task={selectedTask} onClose={() => { setShowDetailModal(false); setSelectedTask(null); }} />}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <ConfirmModal open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState({ ...confirmState, open: false })} />
    </div>
  );
}

const FilterTab = ({ label, active, onClick, count }) => (
  <button onClick={onClick} className={`relative px-5 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${active ? "bg-white text-indigo-700 shadow-sm transform scale-105 z-10" : "text-slate-500 hover:text-slate-700"}`}>
    {label} {count > 0 && <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? 'bg-indigo-100' : 'bg-slate-200 opacity-60'}`}>{count}</span>}
  </button>
);

const StatCard = ({ label, count, icon: Icon, color, active, onClick }) => {
  const colors = { orange: "text-red-700 bg-red-100 border-red-200", blue: "text-blue-700 bg-blue-100 border-blue-200", green: "text-emerald-700 bg-emerald-100 border-emerald-200" };
  const borders = { orange: "border-red-500 shadow-red-100", blue: "border-blue-500 shadow-blue-100", green: "border-emerald-500 shadow-emerald-100" };
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl p-4 border-2 shadow-sm flex items-center justify-between transition-all cursor-pointer hover:-translate-y-1 ${active ? `${borders[color]} ring-4 ring-slate-100 shadow-lg` : "border-slate-100"}`}>
      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p><p className="text-3xl font-black text-slate-900 leading-none">{count}</p></div>
      <div className={`p-3 rounded-xl shadow-inner ${colors[color]}`}><Icon size={20} className="stroke-[3px]" /></div>
    </div>
  );
};

const TaskCard = ({ task, onView, onAction, getStatusBadge }) => {
  const roomDisplay = task.room ? `P.${task.room.room_number}` : "---";
  const isPending = task.status === "pending";
  const isDoing = task.status === "in_progress";
  const isCompleted = task.status === "completed" || task.status === "confirmed";

  const startTime = parseISO(task.created_at);
  const deadlineTime = addHours(startTime, 2);

  let cardStyle = "rounded-3xl p-5 border-2 shadow-md transition-all duration-300 flex flex-col hover:shadow-xl";
  let btnStyle = "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm";
  let roomStyle = "text-slate-900";

  if (isPending) {
    cardStyle += " bg-red-50 border-red-500 shadow-red-50";
    btnStyle = "bg-red-600 text-white hover:bg-red-700 border-transparent shadow-lg shadow-red-200";
    roomStyle = "text-red-900";
  } else if (isDoing) {
    cardStyle += " bg-blue-50 border-blue-500 shadow-blue-50";
    btnStyle = "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-lg shadow-blue-200";
    roomStyle = "text-blue-900";
  } else if (isCompleted) {
    cardStyle += " bg-slate-50 border-slate-200 opacity-60 grayscale-[50%]";
    btnStyle = "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent";
    roomStyle = "text-slate-600";
  }

  return (
    <div className={cardStyle}>
      <div className="flex flex-row items-center justify-between gap-3 mb-4 pb-4 border-b border-slate-900/5">
        <div className="flex items-center gap-2">
          {getStatusBadge(task.status)}
          <span className="text-[10px] font-mono font-black opacity-40">#{task._id.slice(-6).toUpperCase()}</span>
        </div>
        {!isCompleted && (
           <div className="flex items-center gap-1 text-red-600 animate-pulse">
             <FiZap size={14} fill="currentColor" />
             <span className="text-[10px] font-black uppercase tracking-tighter">Ưu tiên</span>
           </div>
        )}
      </div>

      <div className="flex items-end justify-between gap-2 mb-5">
        <div>
           <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1 text-slate-400">PHÒNG</p>
           <p className={`text-4xl font-black leading-none tracking-tighter ${roomStyle}`}>{roomDisplay}</p>
        </div>
        <div className="flex flex-col items-end text-right">
           <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-1 text-slate-400">NHẬN - HẠN XỬ LÝ</p>
           <div className="flex items-center gap-2 font-black text-xs bg-white/80 px-3 py-1.5 rounded-xl border-2 border-slate-100 shadow-sm text-slate-700">
             <span className="text-slate-900">{format(startTime, "HH:mm dd/MM")}</span>
             <span className="text-slate-300">→</span>
             <span className="text-red-600">{format(deadlineTime, "HH:mm dd/MM")}</span>
           </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mt-auto pt-4 border-t border-slate-900/5">
        <button onClick={onView} className="flex-1 py-2.5 rounded-xl text-xs font-black bg-white border-2 border-slate-200 hover:border-slate-400 transition shadow-sm uppercase tracking-tighter">Chi tiết</button>
        {isPending && (
          <button onClick={() => onAction(task, 'start')} className={`flex-[1.8] py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 uppercase tracking-tighter shadow-lg shadow-red-100 ${btnStyle}`}><FiPlay className="fill-current" size={12} /> BẮT ĐẦU</button>
        )}
        {isDoing && (
          <button onClick={() => onAction(task, 'complete')} className={`flex-[1.8] py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 uppercase tracking-tighter shadow-lg shadow-blue-100 ${btnStyle}`}><FiCheckCircle size={14} /> HOÀN TẤT</button>
        )}
      </div>
    </div>
  );
};

const TaskDetailModal = ({ task, onClose }) => {
  const startTime = parseISO(task.created_at);
  const deadlineTime = addHours(startTime, 2);
  const roomCategory = task.room?.category_id?.category_name || "Tiêu chuẩn";

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md text-slate-800">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-8 border-white">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-black text-xl text-slate-900 uppercase tracking-tighter">Chi tiết nhiệm vụ</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-widest uppercase">ID: {task._id}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white shadow-md rounded-full text-slate-400 hover:text-red-500 transition flex items-center justify-center">✕</button>
        </div>
        <div className="p-6 overflow-y-auto bg-white flex-1 no-scrollbar">
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-100 shadow-sm">
              <p className="text-[10px] font-black text-indigo-400 uppercase mb-1 tracking-widest">PHÒNG</p>
              <p className="text-3xl font-black text-indigo-900">{task.room?.room_number}</p>
            </div>
            <div className="bg-rose-50 p-4 rounded-2xl border-2 border-rose-100 shadow-sm">
              <p className="text-[10px] font-black text-rose-400 uppercase mb-1 tracking-widest">LOẠI PHÒNG</p>
              <p className="text-xl font-black text-rose-900 uppercase tracking-tighter truncate">{roomCategory}</p>
            </div>
          </div>
          <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Tiến độ thời gian thực tế</p>
              <div className="space-y-4">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-slate-500 text-xs font-bold uppercase">Giờ nhận:</span><span className="font-black text-slate-800 text-sm">{format(startTime, "HH:mm - dd/MM/yyyy")}</span></div>
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-red-500 text-xs font-black uppercase">Hạn hoàn tất:</span><span className="font-black text-red-600 text-sm">{format(deadlineTime, "HH:mm - dd/MM/yyyy")}</span></div>
                  {task.started_at && <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-blue-500 text-xs font-bold uppercase">Thực tế bắt đầu:</span><span className="font-black text-blue-700 text-sm">{format(parseISO(task.started_at), "HH:mm - dd/MM/yyyy")}</span></div>}
                  {task.completed_at && <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-green-500 text-xs font-bold uppercase">Thực tế kết thúc:</span><span className="font-black text-green-700 text-sm">{format(parseISO(task.completed_at), "HH:mm - dd/MM/yyyy")}</span></div>}
                  {task.confirmed_at && <div className="flex justify-between items-center border-b border-slate-200 pb-2"><span className="text-indigo-500 text-xs font-bold uppercase">Quản lý xác nhận:</span><span className="font-black text-indigo-700 text-sm">{format(parseISO(task.confirmed_at), "HH:mm - dd/MM/yyyy")}</span></div>}
              </div>
          </div>
          {task.note && (
            <div className="mt-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 text-center">Ghi chú từ quản lý</p>
              <div className="bg-amber-50 rounded-2xl p-4 border-2 border-amber-100 shadow-inner"><p className="text-sm font-bold text-amber-900 italic leading-relaxed text-center">"{task.note}"</p></div>
            </div>
          )}
        </div>
        <div className="p-6 border-t border-slate-50 bg-slate-50 flex justify-end"><button onClick={onClose} className="px-10 py-3 bg-slate-900 text-white font-black rounded-2xl text-xs hover:bg-black transition uppercase tracking-widest shadow-xl active:scale-95">Đóng lại</button></div>
      </div>
    </div>
  );
};