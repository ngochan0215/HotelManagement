import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays, setHours, setMinutes } from "date-fns";
import {
  FiPlus, FiX, FiTrash2, FiSearch, FiCheckCircle, FiLogOut, FiUser,
  FiClock, FiMapPin, FiUserPlus, FiUsers, FiDollarSign, FiCalendar,
  FiPhone, FiCreditCard, FiMail, FiFilter, FiList, FiChevronDown, FiLogIn
} from "react-icons/fi";
import { jwtDecode } from "jwt-decode";
import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";
import ConfirmModal from "../../../components/confirmModal";
import { StatusPill } from "../../../components/ui/label";
import { bookingApi } from "../../api/bookingApi";
import { roomApi } from "../../api/roomApi";
import { customerApi } from "../../api/customerApi";
import { useAuth } from "../../auth/hooks/authContext";

const STATUS_MAP = {
  pending:     { label: "Chờ cọc", color: "yellow" },
  confirmed:   { label: "Đã cọc",  color: "blue" },
  in_progress: { label: "Đang ở",  color: "indigo" },
  completed:   { label: "Hoàn tất",color: "emerald" },
  cancelled:   { label: "Đã hủy",  color: "red" },
  expired:     { label: "Hết hạn", color: "gray" },
};

export default function BookingList() {
  const { user } = useAuth();

  const [bookings, setBookings] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerMode, setCustomerMode] = useState("existing");

  const [custSearchQuery, setCustSearchQuery] = useState("");
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [selectedCustDisplay, setSelectedCustDisplay] = useState(null);
  const dropdownRef = useRef(null);

  const [confirmState, setConfirmState] = useState({
      open: false,
      title: "",
      message: "",
      confirmText: "Đồng ý",
      type: "danger",
      onConfirm: null
  });

  const [formData, setFormData] = useState({
    customer_id: "", room_id: "", adults: 1, children: 0, deposit: 0, base_fee: 0,
    expected_checkin: "", expected_checkout: ""
  });

  const [newCustomer, setNewCustomer] = useState({
    email: "", full_name: "", phone_number: "", date_birth: "", nationality: "Vietnam", CCCD: ""
  });

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setShowCustDropdown(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
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
      const [bookRes, roomRes, custRes] = await Promise.all([
        bookingApi.getAllBookings(),
        roomApi.getAllRooms(),
        customerApi.getAllCustomers()
      ]);
      setBookings(Array.isArray(bookRes.result) ? bookRes.result : []);
      setRoomsList(roomRes.rooms || []);
      setCustomersList(custRes.customers || []);
    } catch (error) { console.error(error); }
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
    const checkin = setMinutes(setHours(now, 14), 0);
    const checkout = setMinutes(setHours(addDays(now, 1), 12), 0);

    // const availableRooms = roomsList.filter(r => r.room_status === 'available');
    // const defaultRoom = availableRooms.length > 0 ? availableRooms[0] : null;

    setFormData({
      customer_id: "",
      room_id: "",
      // room_id: defaultRoom ? defaultRoom._id : "",
      // base_fee: defaultRoom ? (defaultRoom.category_id?.price || 0) : 0,
      adults: 1, children: 0, 
      deposit: 0, base_fee: 0,
      expected_checkin: format(checkin, "yyyy-MM-dd'T'HH:mm"),
      expected_checkout: format(checkout, "yyyy-MM-dd'T'HH:mm")
    });

    setNewCustomer({ email: "", full_name: "", phone_number: "", date_birth: "", nationality: "Vietnam", CCCD: "" });
    setCustomerMode("existing");
    setCustSearchQuery("");
    setSelectedCustDisplay(null);
    setShowCustDropdown(false);
    setIsModalOpen(true);

    fetchAvailableRooms(format(checkin, "yyyy-MM-dd'T'HH:mm"), format(checkout, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (new Date(formData.expected_checkout) <= new Date(formData.expected_checkin)) {
        alert("Ngày check-out phải sau ngày check-in!");
        return;
      }

      let employeeId = null;
      if (user && user._id) employeeId = user._id;
      else if (user && user.token) {
          try {
              const decoded = jwtDecode(user.token);
              employeeId = decoded.userId || decoded._id || decoded.id;
          } catch (err) {}
      }

      if (!employeeId) {
          alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại!");
          return;
      }

      if (!formData.room_id) {
        alert("Vui lòng chọn một phòng trống!");
        return;
      }

      let finalCustomerId = formData.customer_id;
      if (customerMode === "new") {
          const randomPassword = "Khach@" + Math.floor(1000 + Math.random() * 9000);
          let emailToUse = newCustomer.email || `${newCustomer.phone_number}@guest.local`;
          const payloadRegister = { ...newCustomer, email: emailToUse, password: randomPassword };
          const resCust = await customerApi.createCustomer(payloadRegister);
          if (resCust && resCust.customerId) finalCustomerId = resCust.customerId;
          else throw new Error("Lỗi khi tạo hồ sơ khách hàng mới.");
      }

      if (!finalCustomerId) {
          alert("Vui lòng chọn khách hàng!");
          return;
      }

      const payloadBooking = {
        customer_id: finalCustomerId, handled_by: employeeId,
        adults: Number(formData.adults), children: Number(formData.children),
        deposit: Number(formData.deposit),
        rooms: [{
            room_id: formData.room_id,
            expected_checkin: new Date(formData.expected_checkin).toISOString(),
            expected_checkout: new Date(formData.expected_checkout).toISOString(),
            base_fee: Number(formData.base_fee)
        }]
      };

      await bookingApi.createBooking(payloadBooking);
      alert("Tạo đặt phòng thành công!");
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
        alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  const filteredCustomers = customersList.filter(c => {
      const query = custSearchQuery.toLowerCase();
      return c.full_name?.toLowerCase().includes(query) || c.phone_number?.includes(query);
  });
  const selectCustomer = (c) => { setFormData({ ...formData, customer_id: c._id }); setSelectedCustDisplay(c); setCustSearchQuery(""); setShowCustDropdown(false); };
  const clearSelectedCustomer = () => { setFormData({ ...formData, customer_id: "" }); setSelectedCustDisplay(null); setCustSearchQuery(""); };
  
  // const handleRoomSelect = (roomId) => {
  //   const selectedRoom = roomsList.find(r => r._id === roomId);
  //   setFormData(prev => ({ ...prev, room_id: roomId, base_fee: selectedRoom?.category_id?.price || 0 }));
  // };
  const handleRoomSelect = (roomId) => {
    const selectedRoom = roomsList.find(r => r._id === roomId);

    setFormData(prev => ({
      ...prev,
      room_id: roomId,
      base_fee: selectedRoom?.price || 0
    }));
  };

  const actionConfirm = (id) => setConfirmState({
      open: true,
      title: "Xác nhận Tiền Cọc",
      message: "Bạn có chắc chắn khách hàng đã thanh toán tiền cọc?",
      confirmText: "Đã thu tiền",
      type: "info",
      onConfirm: async () => { try { await bookingApi.confirmBooking(id); fetchData(); setConfirmState(p => ({...p, open: false})); } catch(e) { alert(e.message) } }
  });

  const actionCheckIn = (did, bid, rNum) => setConfirmState({
      open: true,
      title: `Check-in Phòng ${rNum}`,
      message: `Xác nhận giao phòng ${rNum} cho khách ngay bây giờ?`,
      confirmText: "Giao phòng",
      type: "success",
      onConfirm: async () => { try { await bookingApi.checkinBookingDetail(bid, did); fetchData(); setConfirmState(p => ({...p, open: false})); } catch(e) { alert(e.message) } }
  });

  const actionCheckOut = (did, bid, rNum) => setConfirmState({
      open: true,
      title: `Check-out Phòng ${rNum}`,
      message: `Xác nhận khách trả phòng ${rNum} và hoàn tất thanh toán?`,
      confirmText: "Trả phòng",
      type: "warning",
      onConfirm: async () => { try { await bookingApi.checkoutBookingDetail(bid, did); fetchData(); setConfirmState(p => ({...p, open: false})); } catch(e) { alert(e.message) } }
  });

  const actionCancel = (id) => {
      const r = prompt("Lý do hủy:");
      if(r) {
          bookingApi.cancelBooking(id, r)
            .then(()=>{ alert("Đã hủy thành công"); fetchData(); })
            .catch(e=>alert(e.message));
      }
  };

  const filteredBookings = useMemo(() => {
      return bookings.filter(b => {
          const matchStatus = activeTab === "all" || b.status === activeTab;
          const matchSearch = b.customer_id?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.customer_id?.phone_number?.includes(searchTerm);
          return matchStatus && matchSearch;
      });
  }, [bookings, activeTab, searchTerm]);

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-7xl mx-auto space-y-6">

          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">Quản lý Đặt phòng</h1>
                <p className="text-gray-500 text-sm mt-1">Theo dõi và xử lý các đơn đặt phòng của khách hàng.</p>
            </div>
            <button onClick={handleOpenModal} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm">
              <FiPlus size={20} /> Tạo đơn mới
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto no-scrollbar">
                    {['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(t => (
                        <button key={t} onClick={() => setActiveTab(t)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {STATUS_MAP[t]?.label || (t === 'all' ? 'Tất cả' : t)}
                        </button>
                    ))}
                </div>

                <div className="flex justify-between items-center">
                    <div className="relative w-full lg:w-96">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input type="text" placeholder="Tìm tên khách, SĐT..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 bg-gray-50/50">
                    <th className="py-3 pl-4">Khách hàng</th>
                    <th className="py-3">Phòng</th>
                    <th className="py-3">Lịch trình</th>
                    <th className="py-3 text-center">Cọc</th>
                    <th className="py-3 text-center">Trạng thái</th>
                    <th className="py-3 text-right pr-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                  {filteredBookings.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có dữ liệu đặt phòng.</td></tr>
                  ) : filteredBookings.map((b, index) => {
                    const statusInfo = STATUS_MAP[b.status] || STATUS_MAP.pending;
                    return (
                      <tr key={b._id || index} className="border-b border-gray-50 hover:bg-gray-50 transition group align-top">
                        <td className="py-4 pl-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                    {b.customer_id?.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{b.customer_id?.full_name}</div>
                                    <div className="text-xs text-gray-500">{b.customer_id?.phone_number}</div>
                                </div>
                            </div>
                        </td>
                        <td className="py-4">
                            <div className="flex flex-col gap-2">
                                {b.rooms?.map((r,i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs border border-gray-200">
                                            P.{r.room_id?.room_number}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </td>
                        <td className="py-4 text-xs text-gray-600">
                           <div className="mb-1"><span className="font-medium">In:</span> {format(new Date(b.expected_checkin), "dd/MM/yyyy HH:mm")}</div>
                           <div><span className="font-medium">Out:</span> {format(new Date(b.expected_checkout), "dd/MM/yyyy HH:mm")}</div>
                        </td>
                        <td className="py-4 text-center font-medium">
                            {b.deposit > 0 ? b.deposit.toLocaleString() : "0"}
                        </td>
                        <td className="py-4 text-center">
                            <StatusPill label={statusInfo.label} color={statusInfo.color} />
                        </td>
                        <td className="py-4 text-right pr-4">
                            <div className="flex flex-col items-end gap-2">
                                {b.status === 'pending' && (
                                    <button onClick={() => actionConfirm(b._id)}
                                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100 transition">
                                        Xác nhận cọc
                                    </button>
                                )}
                                {b.rooms?.map((r, i) => {
                                    if(b.status === 'confirmed' && r.status === 'reserved')
                                        return (
                                            <button key={i} onClick={()=>actionCheckIn(r._id,b._id,r.room_id?.room_number)}
                                                className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded hover:bg-emerald-100 transition">
                                                <FiLogIn/> Check-in
                                            </button>
                                        );
                                    if(r.status === 'checked_in')
                                        return (
                                            <button key={i} onClick={()=>actionCheckOut(r._id,b._id,r.room_id?.room_number)}
                                                className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded hover:bg-orange-100 transition">
                                                <FiLogOut/> Check-out
                                            </button>
                                        );
                                    return null;
                                })}
                                {['pending', 'confirmed'].includes(b.status) && (
                                    <button onClick={() => actionCancel(b._id)} className="text-xs text-red-400 hover:text-red-600 hover:underline">
                                        Hủy đơn
                                    </button>
                                )}
                            </div>
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[700px] shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between mb-6 items-center border-b border-gray-100 pb-2">
                <h3 className="font-bold text-xl text-gray-900">Tạo Đặt phòng Mới</h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-gray-100 p-2 rounded-full text-gray-500"><FiX size={20}/></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex gap-2">
                    <button type="button" onClick={() => setCustomerMode('existing')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${customerMode==='existing' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <FiUsers className="inline mr-2"/> Khách hàng cũ
                    </button>
                    <button type="button" onClick={() => setCustomerMode('new')}
                        className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${customerMode==='new' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        <FiUserPlus className="inline mr-2"/> Tạo khách mới
                    </button>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                    {customerMode === 'existing' ? (
                        <div className="relative" ref={dropdownRef}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Tìm kiếm khách hàng <span className="text-red-500">*</span></label>
                            {selectedCustDisplay ? (
                                <div className="flex items-center justify-between p-3 bg-white border border-indigo-200 rounded-lg shadow-sm">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold"><FiUser/></div>
                                        <div>
                                            <div className="font-bold text-gray-900 text-sm">{selectedCustDisplay.full_name}</div>
                                            <div className="text-xs text-gray-500">{selectedCustDisplay.phone_number} - {selectedCustDisplay.CCCD}</div>
                                        </div>
                                    </div>
                                    <button type="button" onClick={clearSelectedCustomer} className="text-gray-400 hover:text-red-500"><FiX/></button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input type="text" placeholder="Nhập Tên, SĐT hoặc CCCD..." className="w-full pl-9 border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white" value={custSearchQuery} onChange={(e) => { setCustSearchQuery(e.target.value); setShowCustDropdown(true); }} onFocus={() => setShowCustDropdown(true)} />
                                    <FiSearch className="absolute left-3 top-3 text-gray-400"/>
                                    {showCustDropdown && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                            {filteredCustomers.length > 0 ? (
                                                filteredCustomers.map(c => (
                                                    <div key={c._id} onClick={() => selectCustomer(c)} className="p-2.5 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-50 last:border-0">
                                                        <div className="font-bold text-gray-800">{c.full_name}</div>
                                                        <div className="text-xs text-gray-500">{c.phone_number}</div>
                                                    </div>
                                                ))
                                            ) : (<div className="p-3 text-center text-gray-500 text-xs">Không tìm thấy.</div>)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div><label className="text-xs font-bold text-gray-500">Họ tên *</label><input className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" value={newCustomer.full_name} onChange={e=>setNewCustomer({...newCustomer, full_name: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500">SĐT *</label><input className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" value={newCustomer.phone_number} onChange={e=>setNewCustomer({...newCustomer, phone_number: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500">CCCD *</label><input className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" value={newCustomer.CCCD} onChange={e=>setNewCustomer({...newCustomer, CCCD: e.target.value})}/></div>
                            <div><label className="text-xs font-bold text-gray-500">Email</label><input className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" placeholder="Option" value={newCustomer.email} onChange={e=>setNewCustomer({...newCustomer, email: e.target.value})}/></div>
                        </div>
                    )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Chọn Phòng <span className="text-red-500">*</span></label>
                        {/* <select required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-gray-50"
                            value={formData.room_id} onChange={e => handleRoomSelect(e.target.value)}>
                            <option value="">-- Chọn phòng trống --</option>
                            {roomsList.filter(r => r.room_status === 'available').map(r => (
                                <option key={r._id} value={r._id}>P.{r.room_number} ({r.category_id?.category_name})</option>
                            ))}
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">Giá phòng (VNĐ)</label>
                        <input type="number" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-gray-50 font-semibold text-gray-700"
                            value={formData.base_fee} onChange={e => setFormData({...formData, base_fee: e.target.value})} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                     <div><label className="block text-sm font-medium text-gray-700 mb-1">Check-in</label><input type="datetime-local" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-gray-50 text-sm" value={formData.expected_checkin} onChange={e => setFormData({...formData, expected_checkin: e.target.value})} /></div>
                     <div><label className="block text-sm font-medium text-gray-700 mb-1">Check-out</label><input type="datetime-local" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-gray-50 text-sm" value={formData.expected_checkout} onChange={e => setFormData({...formData, expected_checkout: e.target.value})} /></div>
                </div>
                <div className="grid grid-cols-3 gap-4 pt-2">
                     <div><label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Người lớn</label><input type="number" min="1" className="w-full border border-gray-300 rounded-lg p-2 text-center" value={formData.adults} onChange={e=>setFormData({...formData, adults: e.target.value})} /></div>
                     <div><label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Trẻ em</label><input type="number" min="0" className="w-full border border-gray-300 rounded-lg p-2 text-center" value={formData.children} onChange={e=>setFormData({...formData, children: e.target.value})} /></div>
                     <div><label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Cọc (VNĐ)</label><input type="number" min="0" className="w-full border border-gray-300 rounded-lg p-2 text-center font-bold text-emerald-600" value={formData.deposit} onChange={e=>setFormData({...formData, deposit: e.target.value})} /></div>
                </div>
                <div className="pt-4 mt-4 border-t border-gray-100">
                     <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition shadow-md flex justify-center items-center gap-2">
                        <FiCheckCircle size={18}/> Xác nhận Đặt Phòng
                     </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {confirmState.open && (
        <ConfirmModal
            open={confirmState.open}
            title={confirmState.title}
            message={confirmState.message}
            confirmText={confirmState.confirmText}
            cancelText="Đóng"
            type={confirmState.type}
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(p => ({ ...p, open: false }))}
        />
      )}
    </div>
  );
}