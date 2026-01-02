import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiTrash2, FiSave, FiChevronDown } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi";
import { bookingApi } from "../../api/bookingApi";

export default function AddServiceUsageModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [activeBookings, setActiveBookings] = useState([]);
  const [services, setServices] = useState([]);

  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");

  const [usageList, setUsageList] = useState([
    { service_id: "", quantity: 1 }
  ]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [bookRes, srvRes] = await Promise.all([
          bookingApi.getAllBookings(),
          serviceApi.getAllServices()
        ]);

        const bookings = (bookRes.result || []).filter(b => b.status === 'in_progress');
        setActiveBookings(bookings);
        setServices(srvRes.services || []);
      } catch (err) {
        console.error(err);
      }
    };
    loadData();
  }, []);

  const handleSelectBooking = (bookingId) => {
    setSelectedBookingId(bookingId);
    const booking = activeBookings.find(b => b._id === bookingId);
    if (booking) {
      setSelectedCustomerId(booking.customer_id?._id || booking.customer_id);
    } else {
      setSelectedCustomerId("");
    }
  };

  const handleAddRow = () => setUsageList([...usageList, { service_id: "", quantity: 1 }]);
  const handleRemoveRow = (idx) => {
    const newList = [...usageList];
    newList.splice(idx, 1);
    setUsageList(newList);
  };
  const handleChangeRow = (idx, field, val) => {
    const newList = [...usageList];
    newList[idx][field] = val;
    setUsageList(newList);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBookingId || !selectedCustomerId) {
      alert("Vui lòng chọn phòng/khách hàng.");
      return;
    }
    if (usageList.some(i => !i.service_id || i.quantity <= 0)) {
      alert("Vui lòng chọn dịch vụ và số lượng > 0");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        booking_id: selectedBookingId,
        customer_id: selectedCustomerId,
        services: usageList.map(i => ({
          service_id: i.service_id,
          quantity: Number(i.quantity),
          use_from: new Date().toISOString()
        }))
      };

      await serviceApi.createServiceUsage(payload);
      alert("Ghi nhận sử dụng dịch vụ thành công!");
      onSuccess();
      onClose();
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-orange-50 rounded-t-xl">
            <div>
                <h2 className="text-xl font-bold text-gray-800">Thêm Dịch Vụ Sử Dụng</h2>
                <p className="text-sm text-gray-500">Ghi nhận khách sử dụng (Nước, Giặt ủi...)</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><FiX size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            <form id="usage-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-gray-50 p-4 rounded-lg border">
                    <label className="block text-sm font-bold mb-2">Chọn Phòng (Đang lưu trú)</label>
                    <div className="relative">
                        <select
                            className="w-full appearance-none border border-gray-300 rounded-lg p-2.5 pr-8 outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer"
                            value={selectedBookingId}
                            onChange={(e) => handleSelectBooking(e.target.value)}
                            required
                        >
                            <option value="">-- Chọn phòng --</option>
                            {activeBookings.map(b => (
                                <option key={b._id} value={b._id}>
                                Phòng {b.rooms?.[0]?.room_id?.room_number || "..."} - {b.customer_id?.full_name}
                                </option>
                            ))}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18}/>
                    </div>
                    {activeBookings.length === 0 && <p className="text-xs text-red-500 mt-1">Không có phòng nào đang check-in.</p>}
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-sm font-bold text-gray-700">Danh sách dịch vụ</label>
                        <button type="button" onClick={handleAddRow} className="text-sm text-orange-600 font-semibold hover:bg-orange-50 px-3 py-1 rounded transition-colors flex items-center gap-1">
                            <FiPlus /> Thêm dịch vụ
                        </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 font-semibold">
                                <tr>
                                    <th className="px-4 py-3 w-[60%]">Tên dịch vụ</th>
                                    <th className="px-4 py-3 w-[25%]">Số lượng</th>
                                    <th className="px-4 py-3 w-[15%] text-center">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {usageList.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 relative">
                                            <div className="relative w-full">
                                                <select
                                                    className="w-full appearance-none border rounded p-2 pr-8 focus:ring-2 focus:ring-orange-500 outline-none bg-white cursor-pointer"
                                                    value={item.service_id}
                                                    onChange={(e) => handleChangeRow(index, 'service_id', e.target.value)}
                                                    required
                                                >
                                                    <option value="">-- Chọn dịch vụ --</option>
                                                    {services.map(s => (
                                                        <option key={s._id} value={s._id}>{s.name} ({s.price.toLocaleString()}đ)</option>
                                                    ))}
                                                </select>
                                                <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14}/>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number" min="1" placeholder="1"
                                                className="w-full border rounded p-2 text-center font-bold outline-none focus:ring-2 focus:ring-orange-500"
                                                value={item.quantity}
                                                onChange={(e) => handleChangeRow(index, 'quantity', e.target.value)}
                                                required
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button type="button" onClick={() => handleRemoveRow(index)} className="text-red-400 hover:text-red-600 p-2">
                                                <FiTrash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </form>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <button onClick={onClose} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Hủy bỏ</button>
            <button
                type="submit" form="usage-form" disabled={loading}
                className="px-6 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 shadow-lg shadow-orange-200"
            >
                {loading ? "Đang xử lý..." : <><FiSave /> Xác nhận</>}
            </button>
        </div>
      </div>
    </div>
  );
}