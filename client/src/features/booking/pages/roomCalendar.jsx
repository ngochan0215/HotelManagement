import React, { useState, useEffect, useMemo } from "react";
import {
  format, addDays, subDays, startOfDay, endOfDay,
  eachHourOfInterval, differenceInMinutes, parseISO, isValid, isSameDay
} from "date-fns";
import { vi } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";
import { bookingApi } from "../../api/bookingApi";
import { roomApi } from "../../api/roomApi";
import { serviceApi } from "../../api/serviceApi";

const HOUR_WIDTH = 120;
const ROW_HEIGHT = 90;
const ROOM_COL_WIDTH = 220;

const STATUS_CONFIG = {
  pending: {
    label: "Chờ cọc",
    style: "bg-yellow-100 border-l-4 border-yellow-500 text-yellow-900 hover:bg-yellow-200",
  },
  confirmed: {
    label: "Đã cọc",
    style: "bg-blue-100 border-l-4 border-blue-600 text-blue-900 hover:bg-blue-200",
  },
  occupied: {
    label: "Đang ở",
    style: "bg-rose-100 border-l-4 border-rose-600 text-rose-900 hover:bg-rose-200",
  },
  cleaning: {
    label: "Dọn dẹp",
    style: "bg-teal-100 border-l-4 border-teal-600 text-teal-900 hover:bg-teal-200",
  },
  maintenance: {
    label: "Bảo trì",
    style: "bg-slate-200 border-l-4 border-slate-600 text-slate-800 hover:bg-slate-300",
  },
  completed: {
    label: "Đã xong",
    style: "bg-gray-200 border-l-4 border-gray-400 text-gray-500 opacity-80 hover:bg-gray-300",
  },
};

export default function RoomCalendar() {
    const navigate = useNavigate();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [rooms, setRooms] = useState([]);
    const [events, setEvents] = useState([]);
    const [services, setServices] = useState([]);

    const [searchTerm, setSearchTerm] = useState("");
    const [filterType, setFilterType] = useState("all");

    const [selectedEvent, setSelectedEvent] = useState(null);
    const [showServiceModal, setShowServiceModal] = useState(false);
    const [selectedServicesToAdd, setSelectedServicesToAdd] = useState([]);

    const currentTimePosition = useMemo(() => {
        const now = new Date();
        const start = startOfDay(currentDate);
        if (!isSameDay(now, currentDate)) return null;
        const diffMinutes = differenceInMinutes(now, start);
        return (diffMinutes / 60) * HOUR_WIDTH;
    }, [currentDate]);

    const fetchCalendar = async () => {
        try {
            const [roomsRes, bookingsRes] = await Promise.all([
                roomApi.getAllRooms(),
                bookingApi.getAllBookings()
            ]);

            const roomList = roomsRes.rooms || [];
            const bookingList = bookingsRes.result || [];
            setRooms(roomList);

            const processedEvents = [];
            const dayStart = startOfDay(currentDate);
            const dayEnd = endOfDay(currentDate);
            const now = new Date();

            bookingList.forEach(booking => {
                const customerId = booking.customer_id?._id || booking.customer_id;
                const customerName = booking.customer_id?.full_name || "Khách vãng lai";
                const customerPhone = booking.customer_id?.phone_number || "";
                const customerCCCD = booking.customer_id?.CCCD || "";
                const bookingCode = booking._id.toString().slice(-6).toUpperCase();

                if (Array.isArray(booking.rooms)) {
                    booking.rooms.forEach(detail => {
                        const roomId = detail.room_id?._id || detail.room_id;
                        const roomNumber = detail.room_id?.room_number || "N/A";

                        const start = detail.actual_checkin ? new Date(detail.actual_checkin) : new Date(detail.expected_checkin);
                        const end = detail.actual_checkout ? new Date(detail.actual_checkout) : new Date(detail.expected_checkout);

                        if (end <= dayStart || start >= dayEnd) return;

                        let status = 'pending';
                        let isCompleted = false;

                        if (booking.status === 'pending') status = 'pending';
                        else if (booking.status === 'confirmed') status = 'confirmed';
                        if (detail.status === 'checked_in') status = 'occupied';

                        if (['checked_out', 'cancelled'].includes(detail.status) || ['cancelled', 'expired', 'completed'].includes(booking.status)) {
                            status = 'completed';
                            isCompleted = true;
                        } else if (status !== 'occupied' && end < now) {
                            status = 'completed';
                            isCompleted = true;
                        }

                        processedEvents.push({
                            _id: detail._id,
                            booking_id: booking._id,
                            customer_id: customerId,
                            room_id: roomId,
                            room_number: roomNumber,
                            start: start.toISOString(),
                            end: end.toISOString(),
                            status: status,
                            title: status === 'occupied' ? 'Đang ở' : 'Đặt phòng',
                            customer_name: customerName,
                            customer_phone: customerPhone,
                            customer_cccd: customerCCCD,
                            booking_code: bookingCode,
                            isCompleted: isCompleted,
                            note: booking.note || ""
                        });
                    });
                }
            });

            roomList.forEach(room => {
                if (['cleaning', 'maintenance'].includes(room.room_status)) {
                    processedEvents.push({
                        _id: `log-${room._id}`,
                        room_id: room._id,
                        room_number: room.room_number,
                        start: new Date().toISOString(),
                        end: endOfDay(currentDate).toISOString(),
                        status: room.room_status,
                        title: room.room_status === 'cleaning' ? 'Đang dọn' : 'Bảo trì',
                        customer_name: room.room_status === 'cleaning' ? 'Buồng phòng' : 'Kỹ thuật',
                        isCompleted: false
                    });
                }
            });

            setEvents(processedEvents);
        } catch (err) { console.error(err); }
    };

    const fetchServices = async () => {
        try {
            const res = await serviceApi.getAllServices({ status: 'active' });
            setServices(res.services || []);
        } catch (error) { console.error(error); }
    };

    useEffect(() => {
        fetchCalendar();
    }, [currentDate]);

    const getEventStyle = (event) => {
        const eventStart = parseISO(event.start);
        const eventEnd = parseISO(event.end);
        const dayStart = startOfDay(currentDate);
        const dayEnd = endOfDay(currentDate);

        if (eventEnd <= dayStart || eventStart >= dayEnd) return null;

        const drawStart = eventStart < dayStart ? dayStart : eventStart;
        const drawEnd = eventEnd > dayEnd ? dayEnd : eventEnd;

        const diffMinutesStart = differenceInMinutes(drawStart, dayStart);
        const durationMinutes = differenceInMinutes(drawEnd, drawStart);

        const width = (durationMinutes / 60) * HOUR_WIDTH - 1;

        return { left: (diffMinutesStart / 60) * HOUR_WIDTH, width: Math.max(width, 40) };
    };

    const handleConfirmDeposit = async () => {
        if (!window.confirm("Xác nhận khách đã đóng tiền cọc?")) return;
        try { await bookingApi.confirmBooking(selectedEvent.booking_id); alert("Thành công!"); setSelectedEvent(null); fetchCalendar(); } catch (err) { alert(err.response?.data?.message); }
    };

    const handleCheckIn = () => navigate('/booking-management');
    const handleCheckOut = () => navigate('/booking-management');

    const handleCompleteCleaning = async () => {
        try { await roomApi.completeCleaning(selectedEvent.room_id); alert("Xong!"); setSelectedEvent(null); fetchCalendar(); } catch (err) { alert(err.response?.data?.message); }
    };
    const handleCompleteMaintenance = async () => {
        try { await roomApi.completeMaintenance(selectedEvent.room_id); alert("Xong!"); setSelectedEvent(null); fetchCalendar(); } catch (err) { alert(err.response?.data?.message); }
    };

    const openAddServiceModal = () => {
        if (!services.length) fetchServices();
        setShowServiceModal(true);
        setSelectedServicesToAdd([{ service_id: "", quantity: 1 }]);
    };

    const handleSubmitService = async () => {
        try {
            const valid = selectedServicesToAdd.filter(s => s.service_id && s.quantity > 0);
            if (!valid.length) { alert("Chọn dịch vụ"); return; }

            if (!selectedEvent.customer_id) {
                alert("Lỗi: Không tìm thấy thông tin khách hàng trong booking này.");
                return;
            }

            const payload = {
                booking_id: selectedEvent.booking_id,
                customer_id: selectedEvent.customer_id, // Lấy trực tiếp từ event (đã thêm ở trên)
                services: valid.map(item => ({
                    service_id: item.service_id,
                    quantity: Number(item.quantity), // Ép kiểu số
                    use_from: new Date().toISOString() // Thêm trường bắt buộc này
                }))
            };

            await serviceApi.createServiceUsage(payload);

            alert("Thêm dịch vụ thành công!");
            setShowServiceModal(false);
            setSelectedEvent(null);
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + (err.response?.data?.message || err.message));
        }
    };

    const handleEmptySlotClick = () => navigate('/booking-management');
    const hoursInDay = useMemo(() => eachHourOfInterval({ start: startOfDay(currentDate), end: endOfDay(currentDate) }), [currentDate]);
    const totalCalendarWidth = hoursInDay.length * HOUR_WIDTH;

    const filteredRooms = useMemo(() => rooms.filter(r =>
        (!searchTerm || r.room_number.includes(searchTerm)) &&
        (filterType==='all' || r.category_id?.category_name === filterType)
    ), [rooms, searchTerm, filterType]);
    const uniqueTypes = useMemo(() => [...new Set(rooms.map(r => r.category_id?.category_name).filter(Boolean))], [rooms]);

    return (
        <div className="flex bg-[#F1F5F9] min-h-screen font-sans text-slate-800">
            <Sidebar />
            <div className="flex-1 ml-[270px] flex flex-col h-screen overflow-hidden">
                <Topbar />
                <div className="flex-1 flex flex-col bg-white overflow-hidden m-4 rounded-xl shadow border border-slate-200">
                    <div className="border-b border-slate-200 bg-white z-50 shrink-0 p-4 pb-0">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-4">
                                <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">Lịch Phòng</h1>
                                <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200 p-1">
                                    <button onClick={() => setCurrentDate(subDays(currentDate, 1))} className="p-2 w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition font-bold text-slate-500">{'<'}</button>
                                    <span className="w-48 text-center font-bold text-slate-700 capitalize text-sm">{format(currentDate, "EEEE, dd/MM/yyyy", { locale: vi })}</span>
                                    <button onClick={() => setCurrentDate(addDays(currentDate, 1))} className="p-2 w-8 h-8 flex items-center justify-center hover:bg-white rounded-md transition font-bold text-slate-500">{'>'}</button>
                                </div>
                                <button onClick={() => setCurrentDate(new Date())} className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-4 py-2.5 rounded-lg transition">Hôm nay</button>
                            </div>
                            <div className="flex gap-3">
                                <div className="relative"><input className="px-4 py-2.5 border border-slate-200 bg-slate-50 rounded-lg text-sm outline-none focus:border-indigo-500 w-48 font-medium" placeholder="Tìm số phòng..." value={searchTerm} onChange={e=>setSearchTerm(e.target.value)}/></div>
                                <select className="border border-slate-200 bg-slate-50 rounded-lg px-4 py-2.5 text-sm outline-none font-medium text-slate-600" value={filterType} onChange={e=>setFilterType(e.target.value)}><option value="all">Tất cả loại</option>{uniqueTypes.map(t=><option key={t} value={t}>{t}</option>)}</select>
                            </div>
                        </div>
                        <div className="flex gap-6 overflow-x-auto pb-3">
                             {Object.entries(STATUS_CONFIG).map(([key, conf]) => (
                                 <div key={key} className="flex items-center gap-2 text-xs font-bold text-slate-600 whitespace-nowrap">
                                     <span className={`w-3 h-3 rounded-full shadow-sm ${conf.style.split(' ')[0]}`}></span>{conf.label}
                                 </div>
                             ))}
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto relative custom-scrollbar">
                        <div className="relative" style={{ minWidth: ROOM_COL_WIDTH + totalCalendarWidth }}>
                            <div className="sticky top-0 z-40 flex h-12 bg-slate-50 border-b border-slate-200 text-xs text-slate-500 font-bold shadow-sm">
                                <div className="sticky left-0 z-50 bg-slate-50 border-r border-slate-200 flex items-center justify-center w-[220px]">PHÒNG</div>
                                {hoursInDay.map(h => <div key={h} style={{width:HOUR_WIDTH}} className="flex items-center justify-center border-r border-slate-200">{format(h,"HH:00")}</div>)}
                            </div>
                            <div className="relative pb-10 bg-white">
                                {currentTimePosition !== null && <div className="absolute top-0 bottom-0 z-30 border-l-2 border-red-500 pointer-events-none" style={{left:ROOM_COL_WIDTH+currentTimePosition}}><div className="absolute -top-1.5 -left-[6px] w-3 h-3 bg-red-500 rounded-full shadow-sm ring-2 ring-white"></div></div>}
                                {filteredRooms.map(room => (
                                    <div key={room._id} className="flex border-b border-slate-100 hover:bg-slate-50 transition" style={{height:ROW_HEIGHT}}>
                                        <div className="sticky left-0 z-30 bg-white border-r border-slate-200 flex flex-col justify-center px-5 w-[220px] shrink-0 shadow-[4px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                            <div className="flex justify-between items-center"><span className="font-bold text-slate-800 text-lg">{room.room_number}</span><span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded border border-slate-200">T{room.floor||1}</span></div>
                                            <div className="text-xs text-slate-500 mt-1 truncate">{room.category_id?.category_name}</div>
                                        </div>
                                        <div className="relative flex" style={{width:totalCalendarWidth}}>
                                            {hoursInDay.map(h => (
                                                <div
                                                    key={h}
                                                    style={{width:HOUR_WIDTH}}
                                                    className="border-r border-slate-100 h-full cursor-pointer hover:bg-indigo-50/30 transition-colors"
                                                    onClick={handleEmptySlotClick}
                                                    title="Click để tạo đặt phòng mới"
                                                ></div>
                                            ))}

                                            {events.filter(e=>e.room_id===room._id).map(evt => {
                                                const style=getEventStyle(evt); if(!style) return null;
                                                const conf = evt.isCompleted ? STATUS_CONFIG.completed : (STATUS_CONFIG[evt.status] || STATUS_CONFIG.pending);

                                                return (
                                                    <div key={evt._id}
                                                        onClick={(e)=>{e.stopPropagation();setSelectedEvent(evt);setShowServiceModal(false)}}
                                                        style={{left:style.left, width:style.width}}
                                                        className={`absolute top-2 bottom-2 rounded-md cursor-pointer flex flex-col justify-center px-3 transition-all overflow-hidden whitespace-nowrap border border-white/60 shadow-sm hover:shadow-md hover:scale-[1.01] hover:z-20 ${conf.style} ${evt.isCompleted ? 'z-0' : 'z-10'}`}
                                                        title={`${evt.title} - ${evt.customer_name}`}
                                                    >
                                                        <div className="flex items-center gap-1.5 mb-0.5 font-bold"><span className="truncate">{evt.customer_name}</span></div>
                                                        {style.width>60 && <div className="text-[10px] font-medium opacity-90 flex justify-between"><span>{format(parseISO(evt.start),"HH:mm")} - {format(parseISO(evt.end),"HH:mm")}</span></div>}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {selectedEvent && !showServiceModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-[450px] overflow-hidden animate-zoom-in border border-gray-100">
                            <div className="bg-white p-5 border-b border-gray-100 flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 mb-1"><span className="text-xl font-bold text-slate-800">{selectedEvent.room_number}</span><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${STATUS_CONFIG[selectedEvent.status]?.style.split(' ')[0]} ${STATUS_CONFIG[selectedEvent.status]?.style.split(' ')[2]} border-transparent`}>{STATUS_CONFIG[selectedEvent.status]?.label}</span></div>
                                    <div className="text-xs text-slate-400">Mã đơn: #{selectedEvent.booking_code || "---"}</div>
                                </div>
                                <button onClick={()=>setSelectedEvent(null)} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 font-bold text-xl px-3">✕</button>
                            </div>
                            <div className="p-6 space-y-5">
                                {['pending','confirmed','occupied','completed'].includes(selectedEvent.status) && (
                                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">KH</div>
                                            <div><div className="font-bold text-slate-800">{selectedEvent.customer_name}</div><div className="text-xs text-slate-500">Khách hàng</div></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-indigo-200/50">
                                            <div><div className="text-[10px] font-bold text-slate-400 uppercase">SĐT</div><div className="font-medium text-slate-700">{selectedEvent.customer_phone||'--'}</div></div>
                                            <div><div className="text-[10px] font-bold text-slate-400 uppercase">CCCD</div><div className="font-medium text-slate-700">{selectedEvent.customer_cccd||'--'}</div></div>
                                        </div>
                                    </div>
                                )}
                                <div className="flex justify-between bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
                                    <div><div className="text-xs text-slate-400 font-bold uppercase mb-1">Check-in</div><div className="font-bold text-slate-700 text-lg">{format(parseISO(selectedEvent.start),"HH:mm")}</div><div className="text-xs text-slate-500">{format(parseISO(selectedEvent.start),"dd/MM")}</div></div>
                                    <div className="w-[1px] bg-slate-200 h-10 self-center"></div>
                                    <div><div className="text-xs text-slate-400 font-bold uppercase mb-1">Check-out</div><div className="font-bold text-slate-700 text-lg">{format(parseISO(selectedEvent.end),"HH:mm")}</div><div className="text-xs text-slate-500">{format(parseISO(selectedEvent.end),"dd/MM")}</div></div>
                                </div>
                                {selectedEvent.isCompleted ? <div className="bg-gray-100 p-3 rounded text-center text-sm text-gray-500 font-bold">Đã hoàn tất/Lịch sử</div> : (
                                    <div className="grid gap-3">
                                        {selectedEvent.status==='pending' && <button onClick={handleConfirmDeposit} className="btn-action bg-yellow-500 hover:bg-yellow-600 text-white">Xác nhận cọc</button>}
                                        {selectedEvent.status==='confirmed' && <button onClick={handleCheckIn} className="btn-action bg-blue-600 hover:bg-blue-700 text-white">Check-in</button>}
                                        {selectedEvent.status==='occupied' && <div className="grid grid-cols-2 gap-3"><button onClick={openAddServiceModal} className="btn-action bg-white border-2 border-indigo-100 text-indigo-600">Dịch vụ</button><button onClick={handleCheckOut} className="btn-action bg-rose-500 hover:bg-rose-600 text-white">Trả phòng</button></div>}
                                        {selectedEvent.status==='cleaning' && <button onClick={handleCompleteCleaning} className="btn-action bg-teal-600 hover:bg-teal-700 text-white">Xong dọn dẹp</button>}
                                        {selectedEvent.status==='maintenance' && <button onClick={handleCompleteMaintenance} className="btn-action bg-slate-600 hover:bg-slate-700 text-white">Xong bảo trì</button>}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {showServiceModal && (
                    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-[550px] max-h-[90vh] flex flex-col overflow-hidden animate-zoom-in">
                            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-white">
                                <div><h3 className="font-bold text-xl text-slate-800">Thêm Dịch Vụ</h3><p className="text-sm text-slate-500">Phòng {selectedEvent?.room_number}</p></div>
                                <button onClick={() => setShowServiceModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-xl px-2">✕</button>
                            </div>
                            <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50">
                                {selectedServicesToAdd.map((item, idx) => (
                                    <div key={idx} className="flex gap-3 mb-3 items-end bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                                        <div className="flex-1"><label className="text-xs font-bold text-slate-500 block mb-1">Dịch vụ</label><select className="w-full border border-gray-200 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white" value={item.service_id} onChange={e => {const newList=[...selectedServicesToAdd];newList[idx].service_id=e.target.value;setSelectedServicesToAdd(newList)}}><option value="">-- Chọn --</option>{services.map(s=><option key={s._id} value={s._id}>{s.name} ({s.price.toLocaleString()}đ)</option>)}</select></div>
                                        <div className="w-24"><label className="text-xs font-bold text-slate-500 block mb-1">SL</label><input type="number" min="1" className="w-full border border-gray-200 rounded-lg p-2.5 text-sm text-center outline-none focus:border-indigo-500" value={item.quantity} onChange={e=>{const newList=[...selectedServicesToAdd];newList[idx].quantity=parseInt(e.target.value)||0;setSelectedServicesToAdd(newList)}}/></div>
                                        <button onClick={()=>{const newList=selectedServicesToAdd.filter((_,i)=>i!==idx);setSelectedServicesToAdd(newList)}} className="text-slate-400 hover:text-red-500 p-2.5 mb-0.5 bg-gray-50 rounded-lg font-bold">Xóa</button>
                                    </div>
                                ))}
                                <button onClick={()=>setSelectedServicesToAdd([...selectedServicesToAdd,{service_id:"",quantity:1}])} className="w-full py-3 border-2 border-dashed border-indigo-200 text-indigo-600 font-bold rounded-xl hover:bg-indigo-50 transition flex items-center justify-center gap-2 mt-2">Thêm dòng</button>
                            </div>
                            <div className="p-5 border-t border-gray-100 bg-white flex justify-end gap-3">
                                <button onClick={()=>setShowServiceModal(false)} className="px-5 py-2.5 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">Hủy</button>
                                <button onClick={handleSubmitService} className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-200">Lưu & Xác nhận</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <style jsx>{` .btn-action { @apply w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95; } `}</style>
        </div>
    );
}