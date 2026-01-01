import React, { useState, useEffect } from "react";
import { format, parseISO, addDays } from "date-fns";
import { FiPlus, FiX, FiTrash2, FiCalendar } from "react-icons/fi";
import axios from "axios";
import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";
import ConfirmModal from "../../../components/confirmModal";
import { StatusPill } from "../../../components/ui/label";
import { bookingApi } from "../../api/bookingApi";
import { roomApi } from "../../api/roomApi";
import { useAuth } from "../../auth/hooks/authContext";

const STATUS_MAP = {
  pending:     { label: "Chờ cọc", color: "yellow" },
  confirmed:   { label: "Đã cọc",  color: "blue" },
  checked_in:  { label: "Đang ở",  color: "indigo" },
  occupied:    { label: "Đang ở",  color: "indigo" },
  checked_out: { label: "Đã trả",  color: "gray" },
  cancelled:   { label: "Đã hủy",  color: "red" },
};

export default function BookingList() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");

  const [confirmState, setConfirmState] = useState({
    open: false, title: "", message: "", onConfirm: null
  });

  const [formData, setFormData] = useState({
    customer_id: "", room_id: "", adults: 1, children: 0, deposit: 0, base_fee: 0,
    expected_checkin: "", expected_checkout: ""
  });

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      fetchAvailableRooms(
        formData.expected_checkin,
        formData.expected_checkout
      );
    }
  }, [
    formData.expected_checkin,
    formData.expected_checkout,
    formData.adults,
    formData.children,
    isModalOpen
  ]);


  const fetchData = async () => {
    try {
      const [bookRes, roomRes] = await Promise.all([
        bookingApi.getAllBookings(),
        roomApi.getAllRooms()
      ]);

      setBookings(Array.isArray(bookRes.result) ? bookRes.result : []);
      setRoomsList(roomRes.rooms || []);
      const token = localStorage.getItem("token");
      const custRes = await axios.get("http://localhost:3000/customer/all", {
          headers: { Authorization: `Bearer ${token}` }
      });
      setCustomersList(Array.isArray(custRes.data) ? custRes.data : []);
      if (custRes.data.customers) setCustomersList(custRes.data.customers);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchAvailableRooms = async (checkin, checkout) => {
    if (!checkin || !checkout) return;

    try {
      const res = await roomApi.getAvailableBy({
        checkin,
        checkout,
        adults: formData.adults,
        children: formData.children,
      });
      console.log("AVAILABLE ROOMS: ", res);

      const flatRooms = res.flatMap(c =>
        c.rooms.map(r => ({
          _id: r.room_id,
          room_number: r.room_number,
          category_name: c.name,
          price: c.price
        }))
      );

      console.log("FLAT ROOMS: ", flatRooms);
      setRoomsList(flatRooms);
    } catch (err) {
      console.error(err);
      setRoomsList([]);
    }
  };


  const handleOpenModal = () => {
    const now = new Date();
    const tomorrow = addDays(now, 1);
    tomorrow.setHours(12, 0, 0, 0);

    const checkin = format(now, "yyyy-MM-dd'T'HH:mm");
    const checkout = format(tomorrow, "yyyy-MM-dd'T'HH:mm");

    setFormData({
      customer_id: "", room_id: "", adults: 1, children: 0, deposit: 0, base_fee: 0,
      expected_checkin: "",
      expected_checkout: format(tomorrow, "yyyy-MM-dd'T'HH:mm")
    });

    setIsModalOpen(true);
    fetchAvailableRooms(checkin, checkout);
  };

  const handleRoomSelect = (roomId) => {
    const selectedRoom = roomsList.find(r => r._id === roomId);
    setFormData(prev => ({
        ...prev,
        room_id: roomId,
        //base_fee: selectedRoom?.category_id?.price || 0
        base_fee: selectedRoom?.price || 0
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        customer_id: formData.customer_id, handled_by: user?._id,
        adults: Number(formData.adults), children: Number(formData.children),
        deposit: Number(formData.deposit),
        rooms: [{
            room_id: formData.room_id,
            expected_checkin: formData.expected_checkin,
            expected_checkout: formData.expected_checkout,
            base_fee: Number(formData.base_fee)
        }]
      };
      await bookingApi.createBooking(payload);
      alert("Thành công!");
      setIsModalOpen(false);
      fetchData();
    } catch (error) { alert("Lỗi: " + (error.response?.data?.message || error.message)); }
  };

  const actionConfirm = (id) => {
    setConfirmState({
      open: true, title: "Xác nhận cọc", message: "Xác nhận khách đã cọc tiền?",
      onConfirm: async () => { await bookingApi.confirmBooking(id); fetchData(); setConfirmState(p => ({...p, open: false})); }
    });
  };

  const actionCheckIn = (id) => {
    setConfirmState({
      open: true, title: "Check-in", message: "Xác nhận khách nhận phòng?",
      onConfirm: async () => { await bookingApi.updateBookingStatus(id, "checked_in"); fetchData(); setConfirmState(p => ({...p, open: false})); }
    });
  };

  const actionCheckOut = (id) => {
    setConfirmState({
      open: true, title: "Check-out", message: "Xác nhận khách trả phòng?",
      onConfirm: async () => { await bookingApi.updateBookingStatus(id, "checked_out"); fetchData(); setConfirmState(p => ({...p, open: false})); }
    });
  };

  const actionCancel = (id) => {
    const reason = prompt("Lý do hủy:");
    if(reason) { bookingApi.cancelBooking(id, reason).then(() => fetchData()).catch(e => alert(e.message)); }
  };

  const filteredBookings = bookings.filter(b => activeTab === "all" || b.status === activeTab);

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />

      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-end gap-4 border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Quản lý Đặt phòng</h1>
                <p className="text-gray-500 text-sm mt-1">Quản lý danh sách đặt phòng, check-in, check-out.</p>
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-800">Danh sách Đặt phòng</h2>
                <button
                    onClick={handleOpenModal}
                    className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
                >
                  <FiPlus /> Tạo đơn mới
                </button>
            </div>
            <div className="mb-4 flex gap-2">
                {['all', 'pending', 'confirmed', 'occupied'].map(t => (
                    <button key={t} onClick={() => setActiveTab(t)}
                        className={`px-3 py-1 rounded text-sm font-medium border ${activeTab === t ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                        {t === 'all' ? 'Tất cả' : STATUS_MAP[t]?.label || t}
                    </button>
                ))}
            </div>

            {/* TABLE */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 text-sm border-b border-gray-100">
                    <th className="py-3 font-semibold pl-4">Khách hàng</th>
                    <th className="py-3 font-semibold">Phòng</th>
                    <th className="py-3 font-semibold">Thời gian</th>
                    <th className="py-3 font-semibold">Cọc</th>
                    <th className="py-3 font-semibold">Trạng thái</th>
                    <th className="py-3 font-semibold text-right pr-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                  {filteredBookings.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-8 text-gray-400">Chưa có dữ liệu đặt phòng.</td></tr>
                  ) : filteredBookings.map((b) => {
                    const status = STATUS_MAP[b.status] || STATUS_MAP.pending;
                    return (
                      <tr key={b._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                        <td className="py-4 pl-4 font-medium">
                            {b.customer_id?.full_name} <br/>
                            <span className="text-xs text-gray-500 font-normal">{b.customer_id?.phone_number}</span>
                        </td>
                        <td className="py-4">
                            {b.rooms?.map((r,i) => (
                                <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs mr-1">{r.room_id?.room_number}</span>
                            ))}
                        </td>
                        <td className="py-4 text-xs">
                           In: {format(parseISO(b.expected_checkin), "dd/MM HH:mm")} <br/>
                           Out: {format(parseISO(b.expected_checkout), "dd/MM HH:mm")}
                        </td>
                        <td className="py-4 font-bold">{b.deposit?.toLocaleString()}</td>
                        <td className="py-4">
                            <StatusPill
                                label={status.label}
                                color={status.color}
                            />
                        </td>

                        <td className="py-4 text-right pr-4">
                            {b.status === 'pending' && (
                                <button onClick={() => actionConfirm(b._id)} className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded text-xs mr-2 font-medium hover:bg-emerald-100">
                                    Xác nhận
                                </button>
                            )}
                            {b.status === 'confirmed' && (
                                <button onClick={() => actionCheckIn(b._id)} className="text-indigo-600 bg-indigo-50 px-3 py-1 rounded text-xs mr-2 font-medium hover:bg-indigo-100">
                                    Check-in
                                </button>
                            )}
                            {['occupied', 'checked_in'].includes(b.status) && (
                                <button onClick={() => actionCheckOut(b._id)} className="text-orange-600 bg-orange-50 px-3 py-1 rounded text-xs mr-2 font-medium hover:bg-orange-100">
                                    Check-out
                                </button>
                            )}
                            {['pending', 'confirmed'].includes(b.status) && (
                                <button onClick={() => actionCancel(b._id)} className="text-gray-400 hover:text-red-500">
                                    <FiTrash2 size={16}/>
                                </button>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>

      {/* MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[500px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4 items-center">
                <h3 className="font-bold text-lg text-gray-800">Tạo Đặt phòng</h3>
                <button onClick={() => setIsModalOpen(false)}><FiX size={24}/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Khách hàng</label>
                    <select required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"
                        value={formData.customer_id} onChange={e => setFormData({...formData, customer_id: e.target.value})}>
                        <option value="">-- Chọn khách --</option>
                        {customersList.map(c => <option key={c._id} value={c._id}>{c.full_name} - {c.phone_number}</option>)}
                    </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phòng</label>
                        {/* <select required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"
                            value={formData.room_id} onChange={e => handleRoomSelect(e.target.value)}>
                            <option value="">-- Chọn --</option>
                            {roomsList.map(r => <option key={r._id} value={r._id} disabled={r.room_status!=='available'}>{r.room_number}</option>)}
                        </select> */}
                        <select
  required
  className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"
  value={formData.room_id}
  onChange={e => handleRoomSelect(e.target.value)}
>
  <option value="">-- Chọn phòng trống --</option>
  {roomsList.map(r => (
    <option key={r._id} value={r._id}>
      {r.room_number} ({r.category_name})
    </option>
  ))}
</select>

                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Giá (VNĐ)</label>
                        <input type="number" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none"
                            value={formData.base_fee} onChange={e => setFormData({...formData, base_fee: e.target.value})} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label>
                        <input type="datetime-local" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none"
                            value={formData.expected_checkin} onChange={e => setFormData({...formData, expected_checkin: e.target.value})} />
                     </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label>
                        <input type="datetime-local" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none"
                            value={formData.expected_checkout} onChange={e => setFormData({...formData, expected_checkout: e.target.value})} />
                     </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                     <div><label className="block text-sm font-medium text-gray-700 mb-1">Lớn</label><input type="number" min="1" className="w-full border border-gray-300 rounded-lg p-2.5" value={formData.adults} onChange={e=>setFormData({...formData, adults: e.target.value})} /></div>
                     <div><label className="block text-sm font-medium text-gray-700 mb-1">Nhỏ</label><input type="number" min="0" className="w-full border border-gray-300 rounded-lg p-2.5" value={formData.children} onChange={e=>setFormData({...formData, children: e.target.value})} /></div>
                     <div><label className="block text-sm font-medium text-gray-700 mb-1">Cọc</label><input type="number" min="0" className="w-full border border-gray-300 rounded-lg p-2.5" value={formData.deposit} onChange={e=>setFormData({...formData, deposit: e.target.value})} /></div>
                </div>
                <div className="pt-2">
                     <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition">Lưu Đặt Phòng</button>
                </div>
            </form>
          </div>
        </div>
      )}
      {confirmState.open && (
        <ConfirmModal
            open={confirmState.open} title={confirmState.title} message={confirmState.message}
            confirmText="Đồng ý" cancelText="Hủy"
            onConfirm={confirmState.onConfirm} onCancel={() => setConfirmState(p => ({ ...p, open: false }))}
        />
      )}

    </div>
  );
}