import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiTrash2, FiSave, FiLock } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import Toast from "../../../components/toast.jsx";

const STATUS_LABEL = { open: "Còn chỗ", full: "Đầy", closed: "Đã đóng" };
const STATUS_COLOR = {
  open: "bg-green-100 text-green-700",
  full: "bg-orange-100 text-orange-700",
  closed: "bg-gray-100 text-gray-500",
};

const EMPTY_FORM = { date: "", label: "", start_time: "", end_time: "", max_capacity: 10 };

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("vi-VN");
}
function fmtTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

export default function ServiceSlotModal({ service, onClose }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchSlots();
  }, []);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const data = await serviceApi.getSlots({ service_id: service._id });
      setSlots(data);
    } catch (e) {
      setToast({ type: "error", message: "Lỗi tải slot: " + e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.date || !form.label.trim() || !form.start_time) {
      setToast({ type: "error", message: "Vui lòng nhập đủ ngày, nhãn và giờ bắt đầu." });
      return;
    }
    if (Number(form.max_capacity) < 1) {
      setToast({ type: "error", message: "Sức chứa phải >= 1." });
      return;
    }
    setSubmitting(true);
    try {
      await serviceApi.createSlot({
        service_id: service._id,
        date: new Date(form.date).toISOString(),
        label: form.label.trim(),
        start_time: new Date(`${form.date}T${form.start_time}`).toISOString(),
        end_time: form.end_time ? new Date(`${form.date}T${form.end_time}`).toISOString() : undefined,
        max_capacity: Number(form.max_capacity),
      });
      setToast({ type: "success", message: "Thêm slot thành công!" });
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      fetchSlots();
    } catch (e) {
      setToast({ type: "error", message: "Lỗi: " + (e.response?.data?.message || e.message) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = async (slot) => {
    if (!window.confirm(`Đóng slot "${slot.label}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await serviceApi.closeSlot(slot._id);
      setToast({ type: "success", message: "Đã đóng slot." });
      fetchSlots();
    } catch (e) {
      setToast({ type: "error", message: "Lỗi: " + (e.response?.data?.message || e.message) });
    }
  };

  const handleDelete = async (slot) => {
    if (slot.booked_count > 0) {
      setToast({ type: "error", message: "Không thể xóa slot đã có lượt đặt." });
      return;
    }
    if (!window.confirm(`Xóa slot "${slot.label}"?`)) return;
    try {
      await serviceApi.deleteSlot(slot._id);
      setToast({ type: "success", message: "Đã xóa slot." });
      fetchSlots();
    } catch (e) {
      setToast({ type: "error", message: "Lỗi: " + (e.response?.data?.message || e.message) });
    }
  };

  return (
    <>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

          <div className="px-6 py-4 border-b flex justify-between items-center bg-green-50 rounded-t-xl">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Quản lý Slot — {service.name}</h2>
              <p className="text-xs text-gray-500">Dịch vụ trải nghiệm · {slots.length} slot</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><FiX size={20} /></button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Add form */}
            {showAddForm ? (
              <form onSubmit={handleAdd} className="border border-green-200 rounded-lg p-4 bg-green-50 space-y-3">
                <h3 className="text-sm font-bold text-gray-700">Tạo slot mới</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Nhãn slot <span className="text-red-500">*</span></label>
                    <input
                      type="text" required placeholder="VD: Buổi sáng, Ca 1..."
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                      value={form.label}
                      onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Ngày <span className="text-red-500">*</span></label>
                    <input
                      type="date" required
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                      value={form.date}
                      onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Giờ bắt đầu <span className="text-red-500">*</span></label>
                    <input
                      type="time" required
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                      value={form.start_time}
                      onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Giờ kết thúc</label>
                    <input
                      type="time"
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                      value={form.end_time}
                      onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Sức chứa tối đa <span className="text-red-500">*</span></label>
                    <input
                      type="number" min="1" required
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-green-500"
                      value={form.max_capacity}
                      onChange={e => setForm(f => ({ ...f, max_capacity: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); }}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition">Hủy</button>
                  <button type="submit" disabled={submitting}
                    className="px-4 py-2 text-sm bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition flex items-center gap-1.5 disabled:opacity-60">
                    <FiSave size={14} />{submitting ? "Đang lưu..." : "Lưu slot"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 text-sm text-green-600 font-semibold hover:bg-green-50 px-4 py-2 rounded-lg border border-green-200 transition w-full justify-center"
              >
                <FiPlus /> Tạo slot mới
              </button>
            )}

            {/* Slot list */}
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-6">Đang tải...</p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6 italic">Chưa có slot nào. Hãy tạo slot để khách có thể đăng ký.</p>
            ) : (
              <div className="space-y-2">
                {slots.map(slot => (
                  <div key={slot._id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-white hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{slot.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {fmtDate(slot.date)} · {fmtTime(slot.start_time)}{slot.end_time ? ` – ${fmtTime(slot.end_time)}` : ""}
                        · {slot.booked_count}/{slot.max_capacity} chỗ đã đặt
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[slot.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[slot.status] || slot.status}
                      </span>
                      {slot.status !== "closed" && (
                        <button
                          onClick={() => handleClose(slot)}
                          title="Đóng slot"
                          className="text-orange-400 hover:text-orange-600 p-1"
                        >
                          <FiLock size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(slot)}
                        disabled={slot.booked_count > 0}
                        title={slot.booked_count > 0 ? "Đã có lượt đặt, không thể xóa" : "Xóa slot"}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end rounded-b-xl">
            <button onClick={onClose} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">Đóng</button>
          </div>
        </div>
      </div>
    </>
  );
}
