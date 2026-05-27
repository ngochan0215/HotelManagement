import React, { useState, useEffect, useMemo } from "react";
import { FiX, FiPlus, FiTrash2, FiSave, FiChevronDown, FiDollarSign } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import { bookingApi } from "../../api/bookingApi.js";
import Toast from "../../../components/toast.jsx";

const EMPTY_ROW = () => ({
  service_id: "",
  service_type: "",
  quantity: 1,
  asset_id: "",
  use_from: "",
  finish_at: "",
  slot_id: "",
  availableAssets: [],
  availableSlots: [],
  loadingExtra: false,
});

const TYPE_BADGE = {
  product: "bg-blue-100 text-blue-700",
  rental: "bg-purple-100 text-purple-700",
  experience: "bg-green-100 text-green-700",
};

const TYPE_LABEL = {
  product: "Sản phẩm",
  rental: "Thuê đồ",
  experience: "Trải nghiệm",
};

function formatSlotOption(slot) {
  const date = slot.date ? new Date(slot.date).toLocaleDateString("vi-VN") : "";
  const start = slot.start_time
    ? new Date(slot.start_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "";
  const end = slot.end_time
    ? new Date(slot.end_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "";
  const remaining = slot.max_capacity - slot.booked_count;
  return `${slot.label} | ${date} ${start}${end ? " - " + end : ""} | Còn ${remaining} chỗ`;
}

export default function AddServiceUsageModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [activeBookings, setActiveBookings] = useState([]);
  const [services, setServices] = useState([]);
  const [toast, setToast] = useState(null);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [usageList, setUsageList] = useState([EMPTY_ROW()]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [bookRes, srvRes] = await Promise.all([
          bookingApi.getAllBookings(),
          serviceApi.getAllServices(),
        ]);
        const bookings = (bookRes.result || []).filter(b => b.status === "in_progress");
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
    setSelectedCustomerId(booking ? (booking.customer_id?._id || booking.customer_id) : "");
  };

  const handleAddRow = () => setUsageList(prev => [...prev, EMPTY_ROW()]);
  const handleRemoveRow = (idx) => setUsageList(prev => prev.filter((_, i) => i !== idx));

  const handleChangeService = async (idx, serviceId) => {
    const svc = services.find(s => s._id === serviceId);
    const serviceType = svc?.service_type || "";
    const needsExtra = serviceId && (serviceType === "rental" || serviceType === "experience");

    setUsageList(prev => {
      const updated = [...prev];
      updated[idx] = { ...EMPTY_ROW(), service_id: serviceId, service_type: serviceType, loadingExtra: needsExtra };
      return updated;
    });

    if (!needsExtra) return;

    try {
      if (serviceType === "rental") {
        const assets = await serviceApi.getAssets({ service_id: serviceId, status: "in-stock" });
        setUsageList(prev => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], availableAssets: assets, loadingExtra: false };
          return updated;
        });
      } else if (serviceType === "experience") {
        const slots = await serviceApi.getSlots({ service_id: serviceId, status: "open" });
        setUsageList(prev => {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], availableSlots: slots, loadingExtra: false };
          return updated;
        });
      }
    } catch (e) {
      console.error(e);
      setUsageList(prev => {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], loadingExtra: false };
        return updated;
      });
    }
  };

  const handleChangeField = (idx, field, val) => {
    setUsageList(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: val };
      return updated;
    });
  };

  const totalAmount = useMemo(() => {
    return usageList.reduce((sum, item) => {
      if (!item.service_id || !item.quantity) return sum;
      const svc = services.find(s => s._id === item.service_id);
      if (!svc) return sum;
      return sum + svc.price * Number(item.quantity || 0);
    }, 0);
  }, [usageList, services]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBookingId || !selectedCustomerId) {
      setToast({ message: "Vui lòng chọn phòng/khách hàng.", type: "error" });
      return;
    }

    for (const item of usageList) {
      if (!item.service_id) {
        setToast({ message: "Vui lòng chọn dịch vụ cho tất cả dòng.", type: "error" });
        return;
      }
      if (!item.quantity || Number(item.quantity) < 1) {
        setToast({ message: "Số lượng phải >= 1.", type: "error" });
        return;
      }
      if (item.service_type === "rental") {
        if (!item.asset_id) {
          setToast({ message: "Vui lòng chọn tài sản cho dịch vụ thuê.", type: "error" });
          return;
        }
        if (!item.use_from || !item.finish_at) {
          setToast({ message: "Vui lòng nhập đầy đủ thời gian bắt đầu và kết thúc thuê.", type: "error" });
          return;
        }
        if (new Date(item.use_from) >= new Date(item.finish_at)) {
          setToast({ message: "Thời gian bắt đầu phải trước thời gian kết thúc.", type: "error" });
          return;
        }
      }
      if (item.service_type === "experience" && !item.slot_id) {
        setToast({ message: "Vui lòng chọn slot cho dịch vụ trải nghiệm.", type: "error" });
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        booking_id: selectedBookingId,
        customer_id: selectedCustomerId,
        services: usageList.map(item => {
          const base = { service_id: item.service_id, quantity: Number(item.quantity) };
          if (item.service_type === "rental") {
            return {
              ...base,
              asset_id: item.asset_id,
              use_from: new Date(item.use_from).toISOString(),
              finish_at: new Date(item.finish_at).toISOString(),
            };
          }
          if (item.service_type === "experience") {
            return { ...base, slot_id: item.slot_id };
          }
          return { ...base, use_from: new Date().toISOString() };
        }),
      };

      await serviceApi.createServiceUsage(payload);
      setToast({ message: "Ghi nhận sử dụng dịch vụ thành công!", type: "success" });
      onSuccess();
      onClose();
    } catch (error) {
      setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">

          {/* Header */}
          <div className="px-6 py-4 border-b flex justify-between items-center bg-orange-50 rounded-t-xl">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Thêm Dịch Vụ Sử Dụng</h2>
              <p className="text-sm text-gray-500">Ghi nhận khách sử dụng dịch vụ (Sản phẩm, Thuê đồ, Trải nghiệm...)</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
              <FiX size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-6 overflow-y-auto flex-1">
            <form id="usage-form" onSubmit={handleSubmit} className="space-y-6">

              {/* Booking selector */}
              <div className="bg-gray-50 p-4 rounded-lg border">
                <label className="block text-sm font-bold mb-2">Chọn Phòng (Đang lưu trú)</label>
                <div className="relative">
                  <select
                    className="w-full appearance-none border border-gray-300 rounded-lg p-2.5 pr-8 outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer"
                    value={selectedBookingId}
                    onChange={e => handleSelectBooking(e.target.value)}
                    required
                  >
                    <option value="">-- Chọn phòng --</option>
                    {activeBookings.map(b => (
                      <option key={b._id} value={b._id}>
                        Phòng {b.rooms?.[0]?.room_info?.room_number || "..."} - {b.customer_info?.full_name}
                      </option>
                    ))}
                  </select>
                  <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                </div>
                {activeBookings.length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Không có phòng nào đang check-in.</p>
                )}
              </div>

              {/* Service list */}
              <div>
                <div className="flex justify-between items-end mb-3">
                  <label className="text-sm font-bold text-gray-700">Danh sách dịch vụ</label>
                  <button
                    type="button"
                    onClick={handleAddRow}
                    className="text-sm text-orange-600 font-semibold hover:bg-orange-50 px-3 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <FiPlus /> Thêm dịch vụ
                  </button>
                </div>

                <div className="space-y-3">
                  {usageList.map((item, idx) => {
                    const selectedSvc = services.find(s => s._id === item.service_id);
                    const subtotal = selectedSvc ? selectedSvc.price * Number(item.quantity || 0) : 0;

                    return (
                      <div key={idx} className="border rounded-lg p-4 bg-gray-50 space-y-3">

                        {/* Service selector row */}
                        <div className="flex gap-2 items-center">
                          <div className="relative flex-1">
                            <select
                              className="w-full appearance-none border rounded-lg p-2.5 pr-8 outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer text-sm"
                              value={item.service_id}
                              onChange={e => handleChangeService(idx, e.target.value)}
                              required
                            >
                              <option value="">-- Chọn dịch vụ --</option>
                              {services.map(s => (
                                <option key={s._id} value={s._id}>
                                  {s.name} — {s.price?.toLocaleString()}đ/{s.unit || "lần"}
                                </option>
                              ))}
                            </select>
                            <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                          </div>
                          {item.service_type && (
                            <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${TYPE_BADGE[item.service_type] || "bg-gray-100 text-gray-600"}`}>
                              {TYPE_LABEL[item.service_type] || item.service_type}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(idx)}
                            className="text-red-400 hover:text-red-600 p-2 rounded"
                          >
                            <FiTrash2 size={16} />
                          </button>
                        </div>

                        {item.loadingExtra && (
                          <p className="text-xs text-gray-400 italic">Đang tải dữ liệu...</p>
                        )}

                        {/* Product: quantity only */}
                        {item.service_type === "product" && (
                          <div className="flex items-center gap-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">Số lượng</label>
                              <input
                                type="number" min="1"
                                className="w-28 border rounded-lg p-2 text-center font-bold outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                value={item.quantity}
                                onChange={e => handleChangeField(idx, "quantity", e.target.value)}
                                required
                              />
                            </div>
                            {selectedSvc && (
                              <p className="mt-5 text-sm text-orange-600 font-semibold">
                                = {subtotal.toLocaleString()}đ
                              </p>
                            )}
                          </div>
                        )}

                        {/* Rental: asset + date range + quantity */}
                        {item.service_type === "rental" && !item.loadingExtra && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Tài sản <span className="text-red-500">*</span>
                              </label>
                              {item.availableAssets.length === 0 ? (
                                <p className="text-xs text-red-500">Không có tài sản nào khả dụng cho dịch vụ này.</p>
                              ) : (
                                <div className="relative">
                                  <select
                                    className="w-full appearance-none border rounded-lg p-2.5 pr-8 outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer text-sm"
                                    value={item.asset_id}
                                    onChange={e => handleChangeField(idx, "asset_id", e.target.value)}
                                    required
                                  >
                                    <option value="">-- Chọn tài sản --</option>
                                    {item.availableAssets.map(a => (
                                      <option key={a._id} value={a._id}>
                                        {a.identifier} ({a.condition})
                                      </option>
                                    ))}
                                  </select>
                                  <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                </div>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                  Thời gian bắt đầu thuê <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="datetime-local"
                                  className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                  value={item.use_from}
                                  onChange={e => handleChangeField(idx, "use_from", e.target.value)}
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                  Thời gian kết thúc thuê <span className="text-red-500">*</span>
                                </label>
                                <input
                                  type="datetime-local"
                                  className="w-full border rounded-lg p-2 outline-none focus:ring-2 focus:ring-orange-500 bg-white text-sm"
                                  value={item.finish_at}
                                  min={item.use_from}
                                  onChange={e => handleChangeField(idx, "finish_at", e.target.value)}
                                  required
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Số lượng</label>
                                <input
                                  type="number" min="1"
                                  className="w-28 border rounded-lg p-2 text-center font-bold outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                  value={item.quantity}
                                  onChange={e => handleChangeField(idx, "quantity", e.target.value)}
                                  required
                                />
                              </div>
                              {selectedSvc && (
                                <p className="mt-5 text-sm text-orange-600 font-semibold">
                                  = {subtotal.toLocaleString()}đ
                                </p>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Experience: slot picker + quantity */}
                        {item.service_type === "experience" && !item.loadingExtra && (
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs font-semibold text-gray-600 mb-1">
                                Slot <span className="text-red-500">*</span>
                              </label>
                              {item.availableSlots.length === 0 ? (
                                <p className="text-xs text-red-500">Không có slot nào đang mở cho dịch vụ này.</p>
                              ) : (
                                <div className="relative">
                                  <select
                                    className="w-full appearance-none border rounded-lg p-2.5 pr-8 outline-none focus:ring-2 focus:ring-orange-500 bg-white cursor-pointer text-sm"
                                    value={item.slot_id}
                                    onChange={e => handleChangeField(idx, "slot_id", e.target.value)}
                                    required
                                  >
                                    <option value="">-- Chọn slot --</option>
                                    {item.availableSlots.map(sl => (
                                      <option key={sl._id} value={sl._id}>
                                        {formatSlotOption(sl)}
                                      </option>
                                    ))}
                                  </select>
                                  <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14} />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Số lượng người</label>
                                <input
                                  type="number" min="1"
                                  className="w-28 border rounded-lg p-2 text-center font-bold outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                  value={item.quantity}
                                  onChange={e => handleChangeField(idx, "quantity", e.target.value)}
                                  required
                                />
                              </div>
                              {selectedSvc && (
                                <p className="mt-5 text-sm text-orange-600 font-semibold">
                                  = {subtotal.toLocaleString()}đ
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Total */}
              <div className="bg-orange-50 p-4 rounded-lg border-2 border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiDollarSign className="text-orange-600" size={20} />
                    <span className="font-bold text-gray-800 text-lg">Tổng tiền:</span>
                  </div>
                  <span className="font-bold text-orange-600 text-2xl">
                    {totalAmount.toLocaleString()} đ
                  </span>
                </div>
              </div>

            </form>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <button
              onClick={onClose}
              className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="submit" form="usage-form" disabled={loading}
              className="px-6 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 shadow-lg shadow-orange-200"
            >
              {loading ? "Đang xử lý..." : <><FiSave /> Xác nhận</>}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
