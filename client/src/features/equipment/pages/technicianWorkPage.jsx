import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  FiClock, FiCheckCircle, FiPlay, FiAlertCircle,
  FiRefreshCw, FiEye, FiSearch, FiFilter, FiCalendar, FiTool, FiArrowRight, FiArrowLeft, FiList, FiArrowUp, FiArrowDown
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
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });

  const [filterStatus, setFilterStatus] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("desc");

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await equipmentApi.getMyInstallTickets({});
      setTickets(res.installs || []);
    } catch (error) {
      setToast({
        type: "error",
        message: "Lỗi tải dữ liệu: " + (error.response?.data?.message || error.message)
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleAction = (ticket, actionType) => {
    const isStart = actionType === 'start';
    setConfirmState({
      open: true,
      title: isStart ? "Bắt đầu công việc" : "Hoàn thành công việc",
      message: `Xác nhận ${isStart ? 'bắt đầu' : 'hoàn tất'} phiếu tại phòng ${ticket.room_id?.room_number}?`,
      onConfirm: async () => {
        try {
          if (isStart) await equipmentApi.startInstallTicket(ticket._id);
          else await equipmentApi.completeInstallTicket(ticket._id);
          setToast({ type: "success", message: "Thao tác thành công!" });
          setConfirmState({ ...confirmState, open: false });
          fetchTickets();
        } catch (error) {
          setToast({ type: "error", message: error.response?.data?.message || "Lỗi thao tác" });
        }
      }
    });
  };

  const processedTickets = useMemo(() => {
    let result = tickets.filter(t => {
      const hasStart = t.started_at && t.started_at !== "";
      const hasEnd = t.completed_at && t.completed_at !== "";
      const isPending = t.status === "assigned" || (t.status === "waiting_confirm" && !hasStart);
      const isDoing = t.status === "waiting_confirm" && hasStart && !hasEnd;
      const isCompleted = t.status === "completed" || hasEnd;
      if (filterStatus === 'assigned' && !isPending) return false;
      if (filterStatus === 'waiting_confirm' && !isDoing) return false;
      if (filterStatus === 'completed' && !isCompleted) return false;
      if (!searchTerm) return true;
      const lowerTerm = searchTerm.toLowerCase();
      const room = t.room_id?.room_number?.toLowerCase() || "";
      const code = t._id.toLowerCase();
      return room.includes(lowerTerm) || code.includes(lowerTerm);
    });
    result.sort((a, b) => {
      const dateA = new Date(a.install_date);
      const dateB = new Date(b.install_date);
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    return result;
  }, [tickets, searchTerm, sortOrder, filterStatus]);

  const stats = useMemo(() => {
    return {
      pending: tickets.filter(t => t.status === "assigned" || (t.status === "waiting_confirm" && (!t.started_at || t.started_at === ""))).length,
      doing: tickets.filter(t => t.status === "waiting_confirm" && (t.started_at && t.started_at !== "") && (!t.completed_at || t.completed_at === "")).length,
      done: tickets.filter(t => t.status === "completed" || (t.completed_at && t.completed_at !== "")).length
    };
  }, [tickets]);

  const getStatusBadge = (status, started_at, completed_at) => {
    const hasStart = started_at && started_at !== "";
    const hasEnd = completed_at && completed_at !== "";
    if (status === "assigned" || (status === "waiting_confirm" && !hasStart)) return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black border shadow-sm bg-red-600 text-white border-red-700">
        <FiClock /> CHỜ BẮT ĐẦU
      </span>
    );
    if (status === "waiting_confirm" && hasStart && !hasEnd) return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black border shadow-sm bg-blue-600 text-white border-blue-700">
        <FiPlay /> ĐANG THỰC HIỆN
      </span>
    );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-black border shadow-sm bg-emerald-600 text-white border-emerald-700">
        <FiCheckCircle /> HOÀN TẤT
      </span>
    );
  };

  const getTypeBadge = (type) => {
    return type === 'install' ? (
      <span className="inline-flex items-center gap-1 text-indigo-900 bg-white/70 px-2 py-0.5 rounded text-[10px] font-black border border-indigo-200 uppercase">
        <FiArrowRight /> Lắp đặt
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-rose-900 bg-white/70 px-2 py-0.5 rounded text-[10px] font-black border border-rose-200 uppercase">
        <FiArrowLeft /> Tháo dỡ
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] font-sans text-sm text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px] flex flex-col overflow-hidden">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-4 no-scrollbar">
          <div className="max-w-7xl mx-auto space-y-4">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3">
              <div>
                <h1 className="text-xl font-black text-gray-900 tracking-tight uppercase">Công việc của tôi</h1>
                <p className="text-gray-500 text-xs font-medium italic">Nhân viên kỹ thuật thiết bị</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <StatCard label="Cần xử lý" count={stats.pending} icon={FiClock} color="orange" active={filterStatus === 'assigned'} onClick={() => setFilterStatus('assigned')} />
              <StatCard label="Đang làm" count={stats.doing} icon={FiPlay} color="blue" active={filterStatus === 'waiting_confirm'} onClick={() => setFilterStatus('waiting_confirm')} />
              <StatCard label="Đã xong" count={stats.done} icon={FiCheckCircle} color="green" active={filterStatus === 'completed'} onClick={() => setFilterStatus('completed')} />
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-2 flex flex-col md:flex-row items-center gap-2 sticky top-0 z-10">
              <div className="flex bg-gray-100 p-1 rounded-md w-full md:w-auto overflow-x-auto no-scrollbar">
                <FilterTab label="Tất cả" active={filterStatus === 'all'} onClick={() => setFilterStatus('all')} />
                <FilterTab label="Chờ làm" active={filterStatus === 'assigned'} onClick={() => setFilterStatus('assigned')} count={stats.pending} />
                <FilterTab label="Đang chạy" active={filterStatus === 'waiting_confirm'} onClick={() => setFilterStatus('waiting_confirm')} count={stats.doing} />
                <FilterTab label="Hoàn tất" active={filterStatus === 'completed'} onClick={() => setFilterStatus('completed')} />
              </div>
              <div className="w-px h-6 bg-gray-200 hidden md:block mx-1"></div>
              <div className="flex bg-gray-100 p-1 rounded-md shrink-0 border border-gray-200">
                <button onClick={() => setSortOrder("desc")} className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-black transition-all ${sortOrder === "desc" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><FiArrowDown size={14}/> MỚI NHẤT</button>
                <button onClick={() => setSortOrder("asc")} className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] font-black transition-all ${sortOrder === "asc" ? "bg-white text-indigo-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}><FiArrowUp size={14}/> CŨ NHẤT</button>
              </div>
              <div className="relative w-full md:flex-1">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input type="text" placeholder="Tìm phòng, mã phiếu..." className="w-full pl-8 pr-4 py-1.5 bg-gray-50 border border-transparent focus:bg-white focus:ring-1 focus:ring-indigo-500 rounded-md text-xs font-medium outline-none transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <button onClick={fetchTickets} className="p-1.5 bg-gray-50 text-gray-600 rounded-md hover:bg-white hover:text-indigo-600 hover:shadow-sm border border-transparent hover:border-gray-200 transition-all"><FiRefreshCw className={loading ? "animate-spin" : ""} size={14} /></button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pb-6">
              {loading ? (
                <div className="col-span-full p-12 text-center text-gray-400 font-bold uppercase"><FiRefreshCw className="animate-spin inline mr-2" /> Đang đồng bộ...</div>
              ) : processedTickets.length === 0 ? (
                <div className="col-span-full p-12 text-center bg-white rounded-lg border-2 border-dashed border-gray-200 text-gray-400 font-bold uppercase tracking-widest">Không có dữ liệu hiển thị</div>
              ) : (
                processedTickets.map((ticket) => (
                  <TicketCard key={ticket._id} ticket={ticket} onView={() => { setSelectedTicket(ticket); setShowDetailModal(true); }} onAction={handleAction} getTypeBadge={getTypeBadge} getStatusBadge={getStatusBadge} />
                ))
              )}
            </div>
          </div>
        </main>
      </div>
      {showDetailModal && selectedTicket && <TicketDetailModal ticket={selectedTicket} onClose={() => { setShowDetailModal(false); setSelectedTicket(null); }} />}
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <ConfirmModal open={confirmState.open} title={confirmState.title} message={confirmState.message} onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState({ ...confirmState, open: false })} />
    </div>
  );
}

const FilterTab = ({ label, active, onClick, count }) => (
  <button onClick={onClick} className={`relative px-3 py-1.5 rounded-md text-xs font-black transition-all whitespace-nowrap flex items-center gap-1.5 ${active ? "bg-white text-indigo-700 shadow-md ring-1 ring-black/5" : "text-gray-500 hover:bg-gray-200"}`}>
    {label} {count > 0 && <span className={`text-[10px] px-1 py-0.5 rounded-full ${active ? 'bg-indigo-100' : 'bg-gray-200'}`}>{count}</span>}
  </button>
);

const StatCard = ({ label, count, icon: Icon, color, active, onClick }) => {
  const colors = { orange: "text-red-700 bg-red-100", blue: "text-blue-700 bg-blue-100", green: "text-emerald-700 bg-emerald-100" };
  const borders = { orange: "border-red-500", blue: "border-blue-500", green: "border-emerald-500" };
  return (
    <div onClick={onClick} className={`bg-white rounded-lg p-3 border-2 shadow-sm flex items-center justify-between transition-all cursor-pointer ${active ? `${borders[color]} ring-2 ring-black/5 scale-[1.02]` : "border-gray-200"}`}>
      <div><p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{label}</p><p className="text-2xl font-black text-gray-900">{count}</p></div>
      <div className={`p-2 rounded-lg ${colors[color]}`}><Icon className="w-5 h-5" /></div>
    </div>
  );
};

const TicketCard = ({ ticket, onView, onAction, getTypeBadge, getStatusBadge }) => {
  const roomDisplay = ticket.room_id ? `P.${ticket.room_id.room_number}` : "---";
  const hasStart = ticket.started_at && ticket.started_at !== "";
  const hasEnd = ticket.completed_at && ticket.completed_at !== "";
  const canStart = ticket.status === "assigned" || (ticket.status === "waiting_confirm" && !hasStart);
  const canComplete = ticket.status === "waiting_confirm" && hasStart && !hasEnd;
  const isCompleted = ticket.status === "completed" || hasEnd;
  let cardStyle = "rounded-xl p-4 border-2 shadow-md transition-all duration-200 flex flex-col";
  let btnStyle = "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 shadow-sm";
  let roomStyle = "text-gray-900";
  if (canStart) {
    cardStyle += " bg-red-50 border-red-500";
    btnStyle = "bg-red-600 text-white hover:bg-red-700 border-transparent shadow-lg shadow-red-100";
    roomStyle = "text-red-900";
  } else if (canComplete) {
    cardStyle += " bg-blue-50 border-blue-500";
    btnStyle = "bg-blue-600 text-white hover:bg-blue-700 border-transparent shadow-lg shadow-blue-100";
    roomStyle = "text-blue-900";
  } else if (isCompleted) {
    cardStyle += " bg-gray-100 border-gray-300 opacity-60 grayscale-[40%]";
    btnStyle = "bg-emerald-600 text-white hover:bg-emerald-700 border-transparent";
    roomStyle = "text-gray-600";
  }
  return (
    <div className={cardStyle}>
      <div className="flex flex-row items-center justify-between gap-3 mb-3 pb-3 border-b border-black/5">
        <div className="flex items-center gap-2">{getStatusBadge(ticket.status, ticket.started_at, ticket.completed_at)}<span className="text-[10px] font-mono font-black opacity-60 tracking-tighter">#{ticket._id.slice(-6).toUpperCase()}</span></div>
        <div>{getTypeBadge(ticket.type)}</div>
      </div>
      <div className="flex items-end justify-between gap-2 mb-4">
        <div><p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-0.5">PHÒNG SỐ</p><p className={`text-3xl font-black leading-none tracking-tighter ${roomStyle}`}>{roomDisplay}</p></div>
        <div className="flex flex-col items-end">
           <p className="text-[10px] font-black opacity-50 uppercase tracking-widest mb-0.5">LỊCH HẸN</p>
           <div className="flex items-center gap-1 font-black text-xs bg-white/80 px-2 py-1 rounded border shadow-sm"><FiCalendar size={12} className="text-gray-500" />{format(parseISO(ticket.install_date), "dd/MM/yyyy")}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-auto pt-3 border-t border-black/5">
        <button onClick={onView} className="flex-1 py-2 rounded-lg text-xs font-black bg-white border-2 border-gray-200 hover:bg-gray-50 transition uppercase tracking-tighter shadow-sm">Chi tiết</button>
        {canStart && <button onClick={() => onAction(ticket, 'start')} className={`flex-[1.5] py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 uppercase tracking-tighter ${btnStyle}`}><FiPlay className="fill-current" size={10} /> BẮT ĐẦU</button>}
        {canComplete && <button onClick={() => onAction(ticket, 'complete')} className={`flex-[1.5] py-2 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 uppercase tracking-tighter ${btnStyle}`}><FiCheckCircle size={12} /> HOÀN TẤT</button>}
      </div>
    </div>
  );
};

const TicketDetailModal = ({ ticket, onClose }) => {
  const [details, setDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await equipmentApi.getEquipmentInstallById(ticket._id);
        if (res.success) setDetails(res.install.install_details || []);
      } catch (error) { console.error(error); } finally { setLoading(false); }
    };
    fetchDetails();
  }, [ticket._id]);

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border-4 border-white">
        <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <div><h3 className="font-black text-lg text-gray-900 uppercase">Thông tin phiếu</h3><p className="text-[10px] text-gray-400 font-mono mt-0.5">#{ticket._id}</p></div>
          <button onClick={onClose} className="p-2 bg-white rounded-full text-gray-400 hover:text-red-500 shadow-sm transition">✕</button>
        </div>
        <div className="p-5 overflow-y-auto bg-white flex-1 no-scrollbar">
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 shadow-inner"><p className="text-[10px] font-black text-indigo-400 uppercase mb-1 text-xs">VỊ TRÍ</p><p className="text-2xl font-black text-indigo-900">Phòng {ticket.room_id?.room_number}</p></div>
            <div className="bg-rose-50 p-3 rounded-xl border border-rose-100 shadow-inner"><p className="text-[10px] font-black text-rose-400 uppercase mb-1 text-xs">LOẠI VIỆC</p><p className="text-lg font-black text-rose-900 uppercase">{ticket.type === 'install' ? 'Lắp đặt' : 'Tháo dỡ'}</p></div>
          </div>
          <h4 className="font-black text-gray-800 mb-3 flex items-center gap-2 border-b-2 border-gray-100 pb-2 text-xs uppercase tracking-widest"><FiTool className="text-indigo-500" /> Thiết bị yêu cầu ({details.length})</h4>
          {loading ? <div className="py-10 text-center font-bold text-gray-300">Đang tải...</div> : details.length === 0 ? <p className="text-gray-400 italic p-4 text-center text-xs bg-gray-50 rounded-xl">Không có thiết bị chi tiết</p> : (
            <div className="space-y-2">{details.map((item, idx) => (
              <div key={idx} className="flex items-center p-3 rounded-xl border-2 border-gray-100 bg-white shadow-sm hover:border-indigo-300 transition-all">
                <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black mr-3 text-xs shadow-md">{idx + 1}</div>
                <div><p className="font-black text-gray-800 text-sm leading-tight">{item.equipment_id?.category_id?.name || item.equipment_id?.name || "Thiết bị không tên"}</p></div>
                <div className="ml-auto"><span className="px-3 py-1 bg-gray-100 border border-gray-200 rounded-lg text-xs font-black text-gray-600 shadow-inner">x1</span></div>
              </div>
            ))}</div>
          )}
        </div>
        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end"><button onClick={onClose} className="px-8 py-2 bg-gray-900 text-white font-black rounded-xl text-xs hover:bg-black transition uppercase tracking-widest shadow-lg">Đóng lại</button></div>
      </div>
    </div>
  );
};