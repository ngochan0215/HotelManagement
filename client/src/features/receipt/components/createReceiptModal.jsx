import React, { useState, useEffect } from "react";
import { FiX, FiCheckCircle, FiAlertCircle, FiSearch, FiDollarSign } from "react-icons/fi";
import { receiptApi } from "../../api/receiptApi.js";
import { bookingApi } from "../../api/bookingApi.js";
import { incidentApi } from "../../api/incidentApi.js";
import Toast from "../../../components/toast.jsx";

export default function CreateReceiptModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [toast, setToast] = useState(null);

  const [bookings, setBookings] = useState([]);
  const [bookedIds, setBookedIds] = useState(new Set());
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [relatedCompensations, setRelatedCompensations] = useState([]);
  const [selectedCompensateId, setSelectedCompensateId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [note, setNote] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [bookingsRes, receiptsRes] = await Promise.all([
          bookingApi.getAllBookings(),
          receiptApi.getAllReceipts(),
        ]);
        setBookings(bookingsRes.bookings || []);

        const ids = new Set(
          (receiptsRes.receipts || [])
            .filter(r => r.status !== "cancelled")
            .map(r => {
              const bid = r.booking_id;
              return (typeof bid === "object" ? bid?._id : bid)?.toString();
            })
            .filter(Boolean)
        );
        setBookedIds(ids);
      } catch (err) {
        console.error(err);
      } finally {
        setFetching(false);
      }
    };
    fetchData();
  }, []);

  const handleSelectBooking = async (bookingId) => {
    if (!bookingId) {
        setSelectedBooking(null);
        setRelatedCompensations([]);
        return;
    }

    const booking = bookings.find(b => b._id === bookingId);
    setSelectedBooking(booking);

    try {
        const resIncidents = await incidentApi.getAllCompensateTickets();
        const tickets = resIncidents.data || [];

        const pendingTickets = tickets.filter(
            t => t.incident_id?.booking_id === bookingId && t.status === 'pending'
        );
        setRelatedCompensations(pendingTickets);
    } catch (e) {
        console.error("Lỗi load phiếu phạt:", e);
    }
  };

  const handleSubmit = async () => {
    if (!selectedBooking) {
      setToast({ message: "Vui lòng chọn đơn đặt phòng!", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        booking_id: selectedBooking._id,
        payment: paymentMethod,
        note: note,
        compensate_ticket_id: selectedCompensateId || null,
      };

      await receiptApi.createReceipt(payload);
      setToast({ message: "Xuất hóa đơn thành công!", type: "success" });
      onSuccess?.();
      onClose();
    } catch (err) {
      setToast({ message: "Lỗi: " + (err.response?.data?.message || err.message), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
      if (!selectedBooking) return 0;
      let total = selectedBooking.total_fee || 0;
      total -= (selectedBooking.deposit || 0);
      if (selectedCompensateId) {
          const ticket = relatedCompensations.find(t => t._id === selectedCompensateId);
          if (ticket) total += (ticket.total_fee || 0);
      }

      return Math.max(total, 0);
  };

  return (
    <>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl flex flex-col max-h-[90vh]">

        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-indigo-50 rounded-t-xl">
          <h3 className="font-bold text-lg text-indigo-800 flex items-center gap-2">
            <FiDollarSign/> Lập Hóa Đơn Mới
          </h3>
          <button onClick={onClose}><FiX className="text-gray-500 hover:text-black"/></button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
            <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Chọn Đơn đặt phòng</label>
                <div className="relative">
                    <select
                        className="w-full border border-gray-300 p-2.5 rounded-lg outline-none focus:border-indigo-500 bg-white"
                        onChange={(e) => handleSelectBooking(e.target.value)}
                        value={selectedBooking?._id || ""}
                        disabled={loading}
                    >
                        <option value="">-- Chọn đơn đặt phòng --</option>
                        {bookings
                            .filter(b => !["expired", "cancelled"].includes(b.status) && !bookedIds.has(b._id.toString()))
                            .map(b => (
                            <option key={b._id} value={b._id}>
                                #{b._id.toString().slice(-6).toUpperCase()} — {b.customer_info?.full_name} ({b.status})
                            </option>
                        ))}
                    </select>
                    {fetching && <span className="absolute right-8 top-3 text-xs text-gray-400">Đang tải...</span>}
                </div>
            </div>

            {selectedBooking && (
                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-3 animate-fade-in-down">
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-600">Tiền phòng (đã trừ KM):</span>
                        <span className="font-bold">{selectedBooking.total_fee?.toLocaleString()} đ</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 pb-2">
                        <span className="text-gray-600">Đã đặt cọc:</span>
                        <span className="font-bold text-green-600">- {(selectedBooking.deposit || 0).toLocaleString()} đ</span>
                    </div>

                    {relatedCompensations.length > 0 ? (
                        <div className="bg-red-50 p-2 rounded border border-red-100">
                            <div className="flex items-center gap-2 text-red-700 font-bold mb-1 text-xs uppercase">
                                <FiAlertCircle/> Có {relatedCompensations.length} phiếu phạt chưa thu:
                            </div>
                            <select
                                className="w-full border p-1.5 rounded text-xs bg-white text-red-600 font-medium outline-none"
                                onChange={(e) => setSelectedCompensateId(e.target.value)}
                                value={selectedCompensateId}
                            >
                                <option value="">-- Không gộp (Thu sau) --</option>
                                {relatedCompensations.map(c => (
                                    <option key={c._id} value={c._id}>
                                        Gộp: {c.incident_id?.description} (+{c.total_fee.toLocaleString()} đ)
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                            <FiCheckCircle/> Không có khoản phạt phát sinh.
                        </p>
                    )}

                    <div className="flex justify-between pt-1 text-lg">
                        <span className="font-bold text-gray-800">Cần thanh toán:</span>
                        <span className="font-black text-indigo-700">{calculateTotal().toLocaleString()} đ</span>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Thanh toán qua</label>
                    <select
                        className="w-full border border-gray-300 p-2.5 rounded-lg outline-none bg-white"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                    >
                        <option value="cash">Tiền mặt</option>
                        <option value="bank">Chuyển khoản (PayOS)</option>
                    </select>
                </div>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Ghi chú</label>
                    <input
                        type="text"
                        className="w-full border border-gray-300 p-2.5 rounded-lg outline-none"
                        placeholder="VD: Khách check-out sớm..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </div>
            </div>

        </div>

        <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50 rounded-b-xl">
            <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-white transition">Hủy bỏ</button>
            <button
                onClick={handleSubmit}
                disabled={loading || !selectedBooking}
                className={`px-6 py-2.5 rounded-lg text-white font-bold transition shadow-lg ${loading || !selectedBooking ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
            >
                {loading ? "Đang xử lý..." : "Xuất Hóa Đơn"}
            </button>
        </div>
      </div>
    </div>
    </>
  );
}