import React, { useState, useEffect, useMemo } from "react";
import {
  format, addDays, subDays, startOfDay, endOfDay,
  eachHourOfInterval, isSameDay, differenceInMinutes,
  parseISO, isValid
} from "date-fns";
import { vi } from "date-fns/locale";
import {
  FiChevronLeft, FiChevronRight, FiPlus,
  FiXCircle, FiCheck, FiTool, FiRefreshCw, FiClock, FiSearch, FiFilter,
  FiLogIn, FiLogOut, FiShoppingCart, FiCalendar
} from "react-icons/fi";

import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";
import { bookingApi } from "../../api/bookingApi";

// --- CẤU HÌNH ---
const HOUR_WIDTH = 100;
const ROW_HEIGHT = 80;
const ROOM_COL_WIDTH = 200;

const STATUS_CONFIG = {
  available: { id: "available", color: "bg-white", border: "border-gray-300", label: "Trống", text: "text-gray-600", icon: null },
  booked: { id: "booked", color: "bg-blue-500", border: "border-blue-700", label: "Đã đặt", text: "text-white", icon: <FiCalendar /> },
  occupied: { id: "occupied", color: "bg-rose-500", border: "border-rose-700", label: "Đang ở", text: "text-white", icon: <FiCheck /> },
  cleaning: { id: "cleaning", color: "bg-amber-400", border: "border-amber-600", label: "Dọn dẹp", text: "text-amber-900", icon: <FiRefreshCw className="animate-spin-slow"/> },
  maintenance: { id: "maintenance", color: "bg-slate-700", border: "border-slate-900", label: "Bảo trì", text: "text-slate-200", icon: <FiTool /> },
};

const normalizeStatus = (status) => {
  switch (status) {
    case "confirmed": return "booked";
    case "checked_in": return "occupied";
    case "checked_out": return "cleaning";
    case "cancelled": 
    case "expired":
        return "available";
    default:
        return status;
  }
};

// --- DỮ LIỆU CỐ ĐỊNH (FIXED MOCK DATA) ---
// Dùng thời gian thực để làm mốc, nhưng cộng trừ ngày cố định
const now = new Date();
const y = now.getFullYear();
const m = now.getMonth();
const d = now.getDate();

export default function RoomCalendar() {
    const [currentDate, setCurrentDate] = useState(new Date());

    const [rooms, setRooms] = useState([]);
    const [events, setEvents] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");
    const [filterStatus, setFilterStatus] = useState("all");

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);

    useEffect(() => {
        const fetchCalendar = async () => {
            try {
            const data = await bookingApi.getRoomsCalendar(
                format(currentDate, "yyyy-MM-dd")
            );
            console.log("getCalendarRooms result returns: ", data);
            setRooms(data.rooms);

            const mappedEvents = data.events.map(e => ({
                _id: e.id,
                room_id: e.room_id,
                room_number: e.room_number,
                start: e.start,
                end: e.end,
                status: e.status,
                title: e.title,
                note: e.note,
                handled_by: e.handled_by,
            }));
            setEvents(mappedEvents);

            } catch (err) {
                alert(err.response?.data?.message || "Không tải được lịch phòng");
            }
        };
        fetchCalendar();
    }, [currentDate]);


    // logic lọc phòng để tìm kiếm
    const filteredRooms = useMemo(() => {
        const keyword = searchTerm.trim().toLowerCase();

        return rooms.filter(room => {
            // tìm theo số phòng
            const matchName = !keyword || room.room_number?.toLowerCase().includes(keyword);

            // lọc theo loại phòng
            const matchType = filterType === "all" || room.category_id?.category_name === filterType;

            // lọc theo trạng thái phòng
            let matchStatus = true;
            const roomEvents = events.filter(e => e.room_id === room._id);

            if (filterStatus === "available") {
                matchStatus = roomEvents.every(e => e.status !== "occupied" && e.status !== "booked" && e.status!== "maintenance");
            } else if (filterStatus !== "all") {
                matchStatus = roomEvents.some(e => e.status === filterStatus);
            }

            return matchName && matchType && matchStatus;
        });
    }, [rooms, events, searchTerm, filterType, filterStatus]);

    // danh sách các loại phòng
    const uniqueTypes = useMemo(() => {
        const types = rooms
            .map(r => r.category_id?.category_name)
            .filter(Boolean);
        return [...new Set(types)];
    }, [rooms]);

    const hoursInDay = useMemo(() => {
        return eachHourOfInterval({ start: startOfDay(currentDate), end: endOfDay(currentDate) });
    }, [currentDate]);

    const totalCalendarWidth = hoursInDay.length * HOUR_WIDTH;

    const handleDateChange = (e) => {
        const date = parseISO(e.target.value);
        if (isValid(date)) setCurrentDate(date);
    };

    const handleSlotClick = (room, time) => setSelectedSlot({ room, time });

    const getEventStyle = (event) => {
        const eventStart = parseISO(event.start);
        const eventEnd = parseISO(event.end);
        const dayStart = startOfDay(currentDate);
        const dayEnd = endOfDay(currentDate);

        // Cắt event nếu nó tràn ra ngoài ngày hiện tại
        const drawStart = eventStart < dayStart ? dayStart : eventStart;
        const drawEnd = eventEnd > dayEnd ? dayEnd : eventEnd;

        if (drawStart >= drawEnd) return null; // Không thuộc ngày này

        const diffMinutesStart = differenceInMinutes(drawStart, dayStart);
        const durationMinutes = differenceInMinutes(drawEnd, drawStart);
        return { left: (diffMinutesStart / 60) * HOUR_WIDTH, width: (durationMinutes / 60) * HOUR_WIDTH };
    };

    // TODO: thêm logic tạo phòng
    const handleCreateBooking = (type) => {
        // Logic check-in/out cố định
        const start = type === 'walk-in' ? new Date() : new Date(selectedSlot.time.getFullYear(), selectedSlot.time.getMonth(), selectedSlot.time.getDate(), 14, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + 1);
        end.setHours(12, 0, 0, 0);

        const newEvent = {
            _id: `new-${Date.now()}`,
            roomId: selectedSlot.room._id,
            title: type === 'walk-in' ? "Khách Vãng Lai" : "Đặt Trước Mới",
            start: start.toISOString(),
            end: end.toISOString(),
            status: type === 'walk-in' ? 'occupied' : 'booked',
            price: 0
        };
        setEvents([...events, newEvent]);
        setSelectedSlot(null);
    };

    const handleCheckIn = async (bookingId) => {
        try {
            await bookingApi.updateBookingStatus(bookingId, "checked_in");
            alert("Check-in thành công");
            fetchCalendar(); 
        } catch (err) {
            alert(err.response?.data?.message || "Không thể check-in");
        }
    };

    const handleCheckOut = async (bookingId) => {
        try {
            await bookingApi.updateBookingStatus(bookingId, "checked_out");
            alert("Check-out thành công");
            fetchCalendar();
        } catch (err) {
            alert(err.response?.data?.message || "Không thể check-out");
        }
    };

    // TODO: thêm logic hủy đặt phòng
    const handleCancelBooking = async (bookingId) => {
        if (!window.confirm("Bạn có chắc muốn hủy booking này?")) return;
        try {
            await bookingApi.updateBookingStatus(bookingId, "cancelled");
            toast.success("Hủy booking thành công");
            refetchBookings();
        } catch (err) {
            alert(err.response?.data?.message || "Không thể hủy booking");
        }
    };

    return (
        <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
        <Sidebar />
        <div className="flex-1 ml-[270px] flex flex-col h-screen overflow-hidden">
            <Topbar />

            <div className="flex-1 flex flex-col bg-white overflow-hidden">

                <div className="border-b border-gray-200 bg-white shadow-sm z-50 shrink-0">
                    <div className="flex justify-between items-center px-6 py-3 border-b border-gray-100">
                        <div className="flex items-center gap-4">
                            <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <span className="bg-indigo-100 p-2 rounded-lg text-indigo-600"><FiClock size={20}/></span>
                                Lịch Theo Giờ
                            </h1>
                            <div className="flex items-center bg-gray-50 rounded-xl border border-gray-200 p-1 shadow-sm relative group">
                                <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="p-1.5 hover:bg-white rounded-lg transition text-gray-500"><FiChevronLeft/></button>
                                <div className="relative">
                                    <span className="w-48 text-center font-bold text-gray-700 capitalize text-sm select-none px-4 block cursor-pointer hover:text-indigo-600 transition">{format(currentDate, "EEEE, dd/MM/yyyy", { locale: vi })}</span>
                                    <input type="date" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleDateChange} value={format(currentDate, "yyyy-MM-dd")}/>
                                </div>
                                <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-1.5 hover:bg-white rounded-lg transition text-gray-500"><FiChevronRight/></button>
                            </div>
                            <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200 transition">Hôm nay</button>
                        </div>
                        <div className="flex gap-4 items-center">
                            <div className="text-xs text-gray-400 font-medium">Tìm thấy {filteredRooms.length} phòng</div>
                            <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2 shadow-md"><FiPlus size={14}/> Tạo Mới</button>
                        </div>
                    </div>

                    <div className="px-6 py-3 bg-gray-50 flex items-center gap-4 overflow-x-auto">
                        <div className="relative">
                            <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text" placeholder="Tìm số phòng..."
                                className="pl-9 pr-4 py-1.5 border border-gray-200 rounded-lg text-sm w-40 focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500"><FiFilter className="inline mr-1"/>Loại:</span>
                            <select className="py-1.5 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                                <option value="all">Tất cả</option>
                                {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">Tình trạng:</span>
                            <select className="py-1.5 px-3 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer font-medium text-gray-700" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                                <option value="all">Tất cả trạng thái</option>
                                {Object.values(STATUS_CONFIG).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                            </select>
                        </div>
                        <div className="ml-auto flex gap-3 opacity-80">
                            {Object.values(STATUS_CONFIG).map(conf => (
                                <div key={conf.id} className="flex items-center gap-1.5 text-[10px] font-medium text-gray-600">
                                    <span className={`w-2 h-2 rounded-full border ${conf.id === 'available' ? 'border-gray-400 bg-white' : conf.color}`}></span>
                                    {conf.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 overflow-auto relative custom-scrollbar">
                    <div className="relative" style={{ minWidth: ROOM_COL_WIDTH + totalCalendarWidth }}>
                        <div className="sticky top-0 z-40 flex h-10 bg-gray-100 border-b border-gray-300 text-xs text-gray-500 font-bold">
                            <div className="sticky left-0 z-50 bg-gray-200 border-r border-gray-300 flex items-center justify-center uppercase tracking-wider shadow-sm text-gray-600" style={{ width: ROOM_COL_WIDTH, minWidth: ROOM_COL_WIDTH }}>Phòng ({filteredRooms.length})</div>
                            {hoursInDay.map((hour) => (
                                <div key={hour.toString()} style={{ width: HOUR_WIDTH, minWidth: HOUR_WIDTH }} className="flex items-center justify-start pl-2 border-r border-gray-300">{format(hour, "HH:00")}</div>
                            ))}
                        </div>

                        <div className="relative">
                            {filteredRooms.map((room) => (
                                <div key={room._id} className="flex border-b border-gray-200 hover:bg-gray-50/50 transition-colors group relative" style={{ height: ROW_HEIGHT }}>
                                    <div className="sticky left-0 z-30 bg-white border-r border-gray-300 flex flex-col justify-center px-4 shrink-0 group-hover:bg-gray-50 transition-colors shadow-[4px_0_10px_-5px_rgba(0,0,0,0.05)]" style={{ width: ROOM_COL_WIDTH, minWidth: ROOM_COL_WIDTH }}>
                                        <div className="flex justify-between items-center mb-1"><span className="font-bold text-gray-800 text-lg">{room.room_number}</span><span className="text-[10px] text-gray-400 font-bold">T{room.floor}</span></div>
                                        <div className="flex items-center gap-2"><span className={`text-[10px] px-2 py-0.5 rounded font-medium border bg-gray-50 text-gray-600 border-gray-100`}>{room.category_id.category_name}</span></div>
                                    </div>

                                    <div className="relative flex" style={{ width: totalCalendarWidth }}>

                                        {hoursInDay.map((hour) => (
                                            <div
                                                key={hour.toString()}
                                                style={{ width: HOUR_WIDTH, minWidth: HOUR_WIDTH }}
                                                className="border-r border-gray-300 h-full relative group/cell cursor-pointer hover:bg-indigo-50/30 transition"
                                                onClick={() => handleSlotClick(room, hour)}
                                            >
                                                <div className="absolute inset-0 opacity-0 group-hover/cell:opacity-100 flex items-center justify-center text-indigo-300 pointer-events-none">
                                                    <FiPlus />
                                                </div>
                                            </div>
                                        ))}

                                        {events
                                            .filter(e => e.room_id.toString() === room._id.toString())
                                            .map(event => {
                                                const position = getEventStyle(event);
                                                if (!position) return null;
                                                console.log("LOG IN MAP:", event.status, STATUS_CONFIG[event.status]);
                                                const config = STATUS_CONFIG[event.status] || STATUS_CONFIG.available;
                                                return (
                                                    <div
                                                        key={event._id}
                                                        onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); }}
                                                        style={{ left: `${position.left}px`, width: `${position.width}px` }}
                                                        className={`absolute top-2 bottom-2 rounded-lg shadow-sm cursor-pointer ${config.color} border-l-4 ${config.border} flex flex-col justify-center px-2 ${config.text} hover:brightness-110 hover:shadow-md hover:-translate-y-0.5 transition-all z-10 overflow-hidden text-xs`}
                                                    >
                                                        <div className="font-bold truncate flex items-center gap-1">{config.icon && <span className="opacity-80 scale-75">{config.icon}</span>}{event.title}</div>
                                                        {position.width > 60 && <div className="opacity-80 text-[10px] truncate mt-0.5 font-medium">{format(parseISO(event.start), "HH:mm")} - {format(parseISO(event.end), "HH:mm")}</div>}
                                                    </div>
                                                )
                                            })
                                        }
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {selectedSlot && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-zoom-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-[450px] p-6 relative">
                        <button onClick={() => setSelectedSlot(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><FiXCircle size={24}/></button>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Tạo Đặt Phòng Mới</h3>
                        <p className="text-sm text-gray-500 mb-6">
                            Phòng <span className="font-bold text-indigo-600">{selectedSlot.room.room_number}</span> •
                            Giờ chọn <span className="font-bold text-gray-800">{format(selectedSlot.time, "HH:mm")}</span>
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleCreateBooking('reservation')} className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-blue-100 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition group">
                                <div className="bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition"><FiCalendar size={24}/></div>
                                <span className="font-bold">Đặt Trước (14:00)</span>
                            </button>

                            <button onClick={() => handleCreateBooking('walk-in')} className="flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 border-emerald-100 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300 transition group">
                                <div className="bg-white p-3 rounded-full shadow-sm group-hover:scale-110 transition"><FiLogIn size={24}/></div>
                                <span className="font-bold">Check-in Ngay</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedEvent && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center animate-zoom-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-[400px] overflow-hidden">
                        <div className={`${STATUS_CONFIG[selectedEvent.status]?.color} p-5 text-white flex justify-between items-start`}>
                            <div>
                                <h3 className="font-bold text-lg">{selectedEvent.title}</h3>
                                <p className="text-xs opacity-80 mt-1">Mã: #{selectedEvent._id}</p>
                            </div>
                            <button onClick={() => setSelectedEvent(null)} className="bg-white/20 hover:bg-white/30 p-1.5 rounded-full transition"><FiXCircle size={20}/></button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-gray-100 pb-3">
                                <span className="text-gray-500">Trạng thái:</span>
                                <span className={`px-2.5 py-1 rounded-md text-xs font-bold ${STATUS_CONFIG[selectedEvent.status]?.color} ${STATUS_CONFIG[selectedEvent.status]?.text} bg-opacity-90`}>
                                    {STATUS_CONFIG[selectedEvent.status]?.label.toUpperCase()}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <span className="text-xs text-gray-400 block mb-1">Bắt đầu:</span>
                                    <span className="font-semibold text-gray-800">{format(parseISO(selectedEvent.start), "HH:mm dd/MM")}</span>
                                </div>
                                <div>
                                    <span className="text-xs text-gray-400 block mb-1">Kết thúc:</span>
                                    <span className="font-semibold text-gray-800">{format(parseISO(selectedEvent.end), "HH:mm dd/MM")}</span>
                                </div>
                            </div>

                            <div className="pt-4 grid gap-3">
                                {selectedEvent.status === 'booked' && (
                                    <>
                                        <button
                                        onClick={() => handleCheckIn(selectedEvent._id)}
                                        className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl font-bold transition shadow-lg shadow-emerald-200"
                                        >
                                        <FiLogIn /> Nhận Phòng (Check-in)
                                        </button>

                                        <button
                                        onClick={handleCancelBooking}
                                        className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 py-2.5 rounded-xl font-bold transition"
                                        >
                                        <FiXCircle /> Hủy Đặt Phòng
                                        </button>
                                    </>
                                )}


                                {selectedEvent.status === 'occupied' && (
                                    <>
                                        <button
                                        onClick={() => alert("Mở form thêm dịch vụ...")}
                                        className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2.5 rounded-xl font-bold transition"
                                        >
                                        <FiShoppingCart /> Thêm Dịch Vụ
                                        </button>

                                        <button
                                        onClick={handleCheckOut}
                                        className="w-full flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-xl font-bold transition shadow-lg shadow-orange-200"
                                        >
                                        <FiLogOut /> Trả Phòng (Check-out)
                                        </button>
                                    </>
                                )}

                                {/* TODO: THÊM LOGIC UPDATE STATUS PHÒNG SANG AVAILABLE */}
                                {["cleaning", "maintenance"].includes(selectedEvent.status) && (
                                    <button onClick={() => setSelectedEvent(null)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl font-bold transition">
                                        Xác nhận hoàn thành
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
}