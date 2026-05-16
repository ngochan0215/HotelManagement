import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { format, parseISO, addHours } from "date-fns";
import {
  FiClock, FiCheckCircle, FiPlay, FiAlertCircle,
  FiRefreshCw, FiEye, FiHome, FiSearch, FiArrowDown, FiArrowUp, FiZap,
  FiUpload, FiX, FiImage, FiCamera,
} from "react-icons/fi";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import Toast from "../../../components/toast.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import { bookingApi } from "../../api/bookingApi.js";

const MAX_IMAGES = 5;
const ACCEPTED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

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

  // photo-upload complete modal
  const [completeModal, setCompleteModal] = useState({ open: false, task: null });

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await bookingApi.getMyCleaningTasks();
      setTasks(res.tasks || []);
    } catch (error) {
      setToast({ type: "error", message: "Lỗi tải dữ liệu: " + (error.response?.data?.message || error.message) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const handleAction = (task, actionType) => {
    if (actionType === "complete") {
      setCompleteModal({ open: true, task });
      return;
    }
    setConfirmState({
      open: true,
      title: "Bắt đầu dọn dẹp",
      message: `Xác nhận bắt đầu dọn dẹp phòng ${task.room?.room_number || "N/A"}?`,
      onConfirm: async () => {
        try {
          await bookingApi.startCleaningTask(task._id);
          setToast({ type: "success", message: "Đã bắt đầu công việc!" });
          setConfirmState((s) => ({ ...s, open: false }));
          fetchTasks();
        } catch (error) {
          setToast({ type: "error", message: error.response?.data?.message || "Lỗi thao tác" });
        }
      },
    });
  };

  const handleCompleteSubmit = async (taskId, images) => {
    try {
      await bookingApi.completeCleaningTask(taskId, images);
      setCompleteModal({ open: false, task: null });
      setToast({ type: "success", message: "Hoàn thành! Chờ quản lý xác nhận." });
      fetchTasks();
    } catch (error) {
      throw error;
    }
  };

  const processedTasks = useMemo(() => {
    let result = tasks.filter((t) => {
      if (filterStatus === "pending" && t.status !== "pending") return false;
      if (filterStatus === "in_progress" && t.status !== "in_progress") return false;
      if (filterStatus === "completed" && t.status !== "completed" && t.status !== "confirmed") return false;
      if (!searchTerm) return true;
      const lowerTerm = searchTerm.toLowerCase();
      const roomNum = t.room?.room_number?.toLowerCase() || "";
      return roomNum.includes(lowerTerm) || t._id.toLowerCase().includes(lowerTerm);
    });
    result.sort((a, b) => {
      const da = new Date(a.created_at), db = new Date(b.created_at);
      return sortOrder === "desc" ? db - da : da - db;
    });
    return result;
  }, [tasks, searchTerm, sortOrder, filterStatus]);

  const stats = useMemo(() => ({
    pending: tasks.filter((t) => t.status === "pending").length,
    doing: tasks.filter((t) => t.status === "in_progress").length,
    done: tasks.filter((t) => t.status === "completed" || t.status === "confirmed").length,
  }), [tasks]);

  const getStatusBadge = (status) => {
    const config = {
      pending:     { label: "CHỜ BẮT ĐẦU",   color: "bg-red-600 text-white border-red-700",       icon: <FiClock /> },
      in_progress: { label: "ĐANG DỌN DẸP",   color: "bg-blue-600 text-white border-blue-700",     icon: <FiPlay /> },
      completed:   { label: "CHỜ XÁC NHẬN",   color: "bg-orange-500 text-white border-orange-600", icon: <FiAlertCircle /> },
      confirmed:   { label: "ĐÃ HOÀN TẤT",    color: "bg-emerald-600 text-white border-emerald-700", icon: <FiCheckCircle /> },
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

            {/* Header */}
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

            {/* Stat cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <StatCard label="Chờ thực hiện" count={stats.pending}  icon={FiClock}       color="orange" active={filterStatus === "pending"}     onClick={() => setFilterStatus("pending")} />
              <StatCard label="Đang dọn dẹp"  count={stats.doing}    icon={FiPlay}        color="blue"   active={filterStatus === "in_progress"}  onClick={() => setFilterStatus("in_progress")} />
              <StatCard label="Đã hoàn thành" count={stats.done}     icon={FiCheckCircle} color="green"  active={filterStatus === "completed"}    onClick={() => setFilterStatus("completed")} />
            </div>

            {/* Filter / search bar */}
            <div className="bg-white p-2 rounded-2xl shadow-md border border-slate-100 flex flex-col xl:flex-row items-center gap-3 sticky top-0 z-10">
              <div className="flex bg-slate-100 p-1.5 rounded-xl w-full xl:w-auto overflow-x-auto no-scrollbar">
                <FilterTab label="Tất cả"    active={filterStatus === "all"}         onClick={() => setFilterStatus("all")} />
                <FilterTab label="Chờ làm"   active={filterStatus === "pending"}     onClick={() => setFilterStatus("pending")}     count={stats.pending} />
                <FilterTab label="Đang làm"  active={filterStatus === "in_progress"} onClick={() => setFilterStatus("in_progress")} count={stats.doing} />
                <FilterTab label="Hoàn tất"  active={filterStatus === "completed"}   onClick={() => setFilterStatus("completed")} />
              </div>
              <div className="hidden xl:block w-px h-6 bg-slate-200 mx-1" />
              <div className="flex flex-row items-center gap-2 w-full xl:flex-1">
                <div className="flex bg-slate-100 p-1 rounded-md shrink-0 border border-slate-200">
                  <button onClick={() => setSortOrder("desc")} className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${sortOrder === "desc" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><FiArrowDown size={14} /> MỚI NHẤT</button>
                  <button onClick={() => setSortOrder("asc")}  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black transition-all ${sortOrder === "asc"  ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}><FiArrowUp   size={14} /> CŨ NHẤT</button>
                </div>
                <div className="relative flex-1 group">
                  <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input type="text" placeholder="Tìm nhanh phòng..." className="w-full pl-11 pr-4 py-2 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-indigo-500 transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Task cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
              {loading ? (
                <div className="col-span-full py-20 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin" />
                  <span className="font-black text-slate-400 uppercase text-xs">Đang lấy danh sách phòng...</span>
                </div>
              ) : processedTasks.length === 0 ? (
                <div className="col-span-full p-20 text-center bg-white rounded-3xl border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
                  <FiHome size={48} className="text-slate-200" />
                  <p className="text-slate-400 font-black uppercase tracking-widest text-sm">Chưa có phòng nào cần dọn</p>
                </div>
              ) : (
                processedTasks.map((task) => (
                  <TaskCard key={task._id} task={task}
                    onView={() => { setSelectedTask(task); setShowDetailModal(true); }}
                    onAction={handleAction}
                    getStatusBadge={getStatusBadge}
                  />
                ))
              )}
            </div>
          </div>
        </main>
      </div>

      {showDetailModal && selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => { setShowDetailModal(false); setSelectedTask(null); }} />
      )}

      {completeModal.open && completeModal.task && (
        <CompleteWithPhotosModal
          task={completeModal.task}
          onClose={() => setCompleteModal({ open: false, task: null })}
          onSubmit={handleCompleteSubmit}
          setToast={setToast}
        />
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <ConfirmModal open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState((s) => ({ ...s, open: false }))} />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

const FilterTab = ({ label, active, onClick, count }) => (
  <button onClick={onClick} className={`relative px-5 py-2 rounded-lg text-xs font-black transition-all whitespace-nowrap flex items-center gap-2 ${active ? "bg-white text-indigo-700 shadow-sm transform scale-105 z-10" : "text-slate-500 hover:text-slate-700"}`}>
    {label}
    {count > 0 && <span className={`text-[10px] px-2 py-0.5 rounded-full ${active ? "bg-indigo-100" : "bg-slate-200 opacity-60"}`}>{count}</span>}
  </button>
);

const StatCard = ({ label, count, icon: Icon, color, active, onClick }) => {
  const colors = { orange: "text-red-700 bg-red-100 border-red-200", blue: "text-blue-700 bg-blue-100 border-blue-200", green: "text-emerald-700 bg-emerald-100 border-emerald-200" };
  const borders = { orange: "border-red-500 shadow-red-100", blue: "border-blue-500 shadow-blue-100", green: "border-emerald-500 shadow-emerald-100" };
  return (
    <div onClick={onClick} className={`bg-white rounded-2xl p-4 border-2 shadow-sm flex items-center justify-between transition-all cursor-pointer hover:-translate-y-1 ${active ? `${borders[color]} ring-4 ring-slate-100 shadow-lg` : "border-slate-100"}`}>
      <div>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-3xl font-black text-slate-900 leading-none">{count}</p>
      </div>
      <div className={`p-3 rounded-xl shadow-inner ${colors[color]}`}><Icon size={20} className="stroke-[3px]" /></div>
    </div>
  );
};

const TaskCard = ({ task, onView, onAction, getStatusBadge }) => {
  const roomDisplay = task.room ? `P.${task.room.room_number}` : "---";
  const isPending   = task.status === "pending";
  const isDoing     = task.status === "in_progress";
  const isCompleted = task.status === "completed" || task.status === "confirmed";

  const startTime    = parseISO(task.created_at);
  const deadlineTime = addHours(startTime, 2);

  let cardStyle = "rounded-3xl p-5 border-2 shadow-md transition-all duration-300 flex flex-col hover:shadow-xl";
  let btnStyle  = "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm";
  let roomStyle = "text-slate-900";

  if (isPending) {
    cardStyle += " bg-red-50 border-red-500 shadow-red-50";
    btnStyle   = "bg-red-600 text-white hover:bg-red-700 border-transparent shadow-lg shadow-red-200";
    roomStyle  = "text-red-900";
  } else if (isDoing) {
    cardStyle += " bg-blue-50 border-blue-500 shadow-blue-50";
    btnStyle   = "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-lg shadow-blue-200";
    roomStyle  = "text-blue-900";
  } else if (isCompleted) {
    cardStyle += " bg-slate-50 border-slate-200 opacity-60 grayscale-[50%]";
    btnStyle   = "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent";
    roomStyle  = "text-slate-600";
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
          <button onClick={() => onAction(task, "start")} className={`flex-[1.8] py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 uppercase tracking-tighter shadow-lg shadow-red-100 ${btnStyle}`}>
            <FiPlay className="fill-current" size={12} /> BẮT ĐẦU
          </button>
        )}
        {isDoing && (
          <button onClick={() => onAction(task, "complete")} className={`flex-[1.8] py-2.5 rounded-xl text-xs font-black transition flex items-center justify-center gap-2 uppercase tracking-tighter shadow-lg shadow-blue-100 ${btnStyle}`}>
            <FiCamera size={14} /> HOÀN TẤT + ẢNH
          </button>
        )}
      </div>
    </div>
  );
};

// ─── Complete-with-photos modal ─────────────────────────────────────────────

function CompleteWithPhotosModal({ task, onClose, onSubmit, setToast }) {
  const [files, setFiles]         = useState([]);   // File objects
  const [previews, setPreviews]   = useState([]);   // object-URL strings
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef(null);

  // revoke object URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => previews.forEach((url) => URL.revokeObjectURL(url));
  }, [previews]);

  const addFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter((f) => {
      if (!ACCEPTED.includes(f.type)) {
        setToast({ type: "error", message: `${f.name}: Chỉ chấp nhận JPG, PNG, WEBP` });
        return false;
      }
      if (f.size > 5 * 1024 * 1024) {
        setToast({ type: "error", message: `${f.name}: Vượt quá 5 MB` });
        return false;
      }
      return true;
    });

    setFiles((prev) => {
      const merged = [...prev, ...valid].slice(0, MAX_IMAGES);
      setPreviews(merged.map((f) => URL.createObjectURL(f)));
      return merged;
    });
  }, [setToast]);

  const removeFile = (idx) => {
    URL.revokeObjectURL(previews[idx]);
    setFiles((prev)    => prev.filter((_, i) => i !== idx));
    setPreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(task._id, files);
    } catch (err) {
      setToast({ type: "error", message: err.response?.data?.message || "Lỗi gửi yêu cầu" });
    } finally {
      setSubmitting(false);
    }
  };

  const roomNumber = task.room?.room_number || "N/A";
  const canAdd     = files.length < MAX_IMAGES;

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border-8 border-white">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
          <div>
            <h3 className="font-black text-xl text-slate-900 uppercase tracking-tighter flex items-center gap-2">
              <FiCamera className="text-blue-600" /> Hoàn tất dọn dẹp
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-widest uppercase">
              Phòng {roomNumber} · #{task._id.slice(-6).toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} className="w-10 h-10 bg-white shadow-md rounded-full text-slate-400 hover:text-red-500 transition flex items-center justify-center disabled:opacity-40">
            <FiX size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 no-scrollbar space-y-5">

          {/* Upload zone */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                <FiImage className="text-blue-500" /> Ảnh minh chứng
              </p>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${files.length >= MAX_IMAGES ? "bg-red-100 text-red-600" : "bg-slate-100 text-slate-500"}`}>
                {files.length} / {MAX_IMAGES}
              </span>
            </div>

            {/* Drop zone — only shown when slots remain */}
            {canAdd && (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none
                  ${isDragging ? "border-blue-500 bg-blue-50 scale-[1.01]" : "border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/50"}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors ${isDragging ? "bg-blue-100" : "bg-white border-2 border-slate-200"}`}>
                  <FiUpload size={20} className={isDragging ? "text-blue-600" : "text-slate-400"} />
                </div>
                <div className="text-center">
                  <p className="text-xs font-black text-slate-700">Kéo thả hoặc <span className="text-blue-600 underline underline-offset-2">bấm để chọn</span></p>
                  <p className="text-[10px] text-slate-400 mt-1">JPG · PNG · WEBP · Tối đa 5 MB / ảnh · {MAX_IMAGES - files.length} slot còn lại</p>
                </div>
                <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </div>
            )}

            {/* Preview grid */}
            {previews.length > 0 && (
              <div className={`grid grid-cols-3 gap-3 ${canAdd ? "mt-4" : ""}`}>
                {previews.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-2xl overflow-hidden border-2 border-slate-100 shadow-md group">
                    <img src={url} alt={`preview-${idx}`} className="w-full h-full object-cover" />
                    {/* dark overlay on hover */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all" />
                    <button
                      onClick={() => removeFile(idx)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center text-red-500 opacity-0 group-hover:opacity-100 transition-all shadow-md hover:bg-red-500 hover:text-white"
                    >
                      <FiX size={12} />
                    </button>
                    <span className="absolute bottom-1.5 left-1.5 text-[9px] font-black bg-black/50 text-white px-1.5 py-0.5 rounded-full">
                      {(files[idx]?.size / 1024).toFixed(0)} KB
                    </span>
                  </div>
                ))}

                {/* Add-more tile (when slots remain but grid is showing) */}
                {canAdd && (
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-1 text-slate-400 hover:border-blue-400 hover:text-blue-500 hover:bg-blue-50 transition-all"
                  >
                    <FiUpload size={16} />
                    <span className="text-[9px] font-black uppercase">Thêm</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Info box */}
          <div className="bg-blue-50 border-2 border-blue-100 rounded-2xl p-4 text-xs text-blue-800 font-bold leading-relaxed">
            Ảnh sẽ được lưu làm minh chứng cho công việc dọn dẹp. Quản lý sẽ xem xét và xác nhận hoàn thành.
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3 shrink-0">
          <button onClick={onClose} disabled={submitting} className="px-6 py-2.5 rounded-xl text-xs font-black text-slate-500 hover:text-slate-700 border-2 border-slate-200 hover:border-slate-300 bg-white transition disabled:opacity-40">
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl text-xs font-black text-white bg-blue-600 hover:bg-blue-700 transition flex items-center justify-center gap-2 shadow-lg shadow-blue-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {submitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Đang tải ảnh...
              </>
            ) : (
              <>
                <FiCheckCircle size={14} />
                Xác nhận hoàn thành {files.length > 0 && `(${files.length} ảnh)`}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task detail modal ───────────────────────────────────────────────────────

const TaskDetailModal = ({ task, onClose }) => {
  const startTime    = parseISO(task.created_at);
  const deadlineTime = addHours(startTime, 2);
  const roomCategory = task.room?.category_id?.category_name || "Tiêu chuẩn";
  const images       = task.completion_images || [];

  return (
    <div className="fixed inset-0 bg-slate-900/80 z-50 flex items-center justify-center p-4 backdrop-blur-md text-slate-800">
      <div className="bg-white rounded-[2rem] w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-8 border-white">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="font-black text-xl text-slate-900 uppercase tracking-tighter">Chi tiết nhiệm vụ</h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5 tracking-widest uppercase">ID: {task._id}</p>
          </div>
          <button onClick={onClose} className="w-10 h-10 bg-white shadow-md rounded-full text-slate-400 hover:text-red-500 transition flex items-center justify-center">✕</button>
        </div>

        <div className="p-6 overflow-y-auto bg-white flex-1 no-scrollbar space-y-6">
          {/* Room + category */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-100 shadow-sm">
              <p className="text-[10px] font-black text-indigo-400 uppercase mb-1 tracking-widest">PHÒNG</p>
              <p className="text-3xl font-black text-indigo-900">{task.room?.room_number}</p>
            </div>
            <div className="bg-rose-50 p-4 rounded-2xl border-2 border-rose-100 shadow-sm">
              <p className="text-[10px] font-black text-rose-400 uppercase mb-1 tracking-widest">LOẠI PHÒNG</p>
              <p className="text-xl font-black text-rose-900 uppercase tracking-tighter truncate">{roomCategory}</p>
            </div>
          </div>

          {/* Timeline */}
          <div className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 text-center">Tiến độ thời gian thực tế</p>
            <div className="space-y-4">
              <TimeRow label="Giờ nhận:"         value={format(startTime, "HH:mm - dd/MM/yyyy")}                                         color="slate" />
              <TimeRow label="Hạn hoàn tất:"     value={format(deadlineTime, "HH:mm - dd/MM/yyyy")}                                      color="red" />
              {task.started_at   && <TimeRow label="Thực tế bắt đầu:"     value={format(parseISO(task.started_at),   "HH:mm - dd/MM/yyyy")} color="blue" />}
              {task.completed_at && <TimeRow label="Thực tế kết thúc:"    value={format(parseISO(task.completed_at), "HH:mm - dd/MM/yyyy")} color="green" />}
              {task.confirmed_at && <TimeRow label="Quản lý xác nhận:"    value={format(parseISO(task.confirmed_at), "HH:mm - dd/MM/yyyy")} color="indigo" />}
            </div>
          </div>

          {/* Completion photos */}
          {images.length > 0 && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <FiCamera className="text-blue-500" /> Ảnh minh chứng ({images.length})
              </p>
              <div className="grid grid-cols-3 gap-2">
                {images.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-xl overflow-hidden border-2 border-slate-100 shadow-sm hover:shadow-md hover:scale-105 transition-all">
                    <img src={url} alt={`completion-${idx}`} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Note */}
          {task.note && (
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1 text-center">Ghi chú từ quản lý</p>
              <div className="bg-amber-50 rounded-2xl p-4 border-2 border-amber-100 shadow-inner">
                <p className="text-sm font-bold text-amber-900 italic leading-relaxed text-center">"{task.note}"</p>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-50 bg-slate-50 flex justify-end">
          <button onClick={onClose} className="px-10 py-3 bg-slate-900 text-white font-black rounded-2xl text-xs hover:bg-black transition uppercase tracking-widest shadow-xl active:scale-95">Đóng lại</button>
        </div>
      </div>
    </div>
  );
};

const TimeRow = ({ label, value, color }) => {
  const colors = {
    slate:  "text-slate-500",
    red:    "text-red-500 font-black",
    blue:   "text-blue-500",
    green:  "text-green-500",
    indigo: "text-indigo-500",
  };
  const valueColors = {
    slate:  "text-slate-800",
    red:    "text-red-600 font-black",
    blue:   "text-blue-700",
    green:  "text-green-700",
    indigo: "text-indigo-700",
  };
  return (
    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
      <span className={`text-xs font-bold uppercase ${colors[color]}`}>{label}</span>
      <span className={`font-black text-sm ${valueColors[color]}`}>{value}</span>
    </div>
  );
};
