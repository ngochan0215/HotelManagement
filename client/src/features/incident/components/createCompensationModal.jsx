import React, { useState, useEffect } from "react";
import { FiX, FiDollarSign, FiMapPin, FiCalendar, FiPackage, FiEdit2 } from "react-icons/fi";
import { incidentApi } from "../../api/incidentApi.js";
import { equipmentApi } from "../../api/equipmentApi.js";
import { bookingApi } from "../../api/bookingApi.js";
import Toast from "../../../components/toast.jsx";

export default function CreateCompensationModal({ incident, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [loadingEquipments, setLoadingEquipments] = useState(false);
  const [toast, setToast] = useState(null);
  const [note, setNote] = useState(incident?.description || "");
  const [equipments, setEquipments] = useState([]);
  const [bookingInfo, setBookingInfo] = useState(null);
  const [totalFeeNonEquipment, setTotalFeeNonEquipment] = useState(0);

  // Lấy tên người gây ra
  const payerName = incident.causer_name || "Chưa xác định";
  const isCustomer = incident.caused_by === "customer";
  const isEquipmentIncident = incident.type === "equipment" && incident.equipment_ids && incident.equipment_ids.length > 0;

  // Map type hiển thị
  const payerTypeMap = {
    customer: 'Khách hàng',
    employee: 'Nhân viên',
    hotel: 'Khách sạn'
  };
  const payerTypeLabel = payerTypeMap[incident.caused_by] || 'Không xác định';

  // Tính % bồi thường gợi ý dựa trên severity
  const getSuggestedCompensationRate = (severity, brokenState) => {
    // Base rate theo broken_state
    const baseRates = {
      scratched: { repair: 0.1, discard: 0.3 },
      cracked: { repair: 0.3, discard: 0.5 },
      broken: { repair: 0.5, discard: 0.8 },
      lost: { discard: 1.2 },
      unusable: { discard: 0.8 }
    };

    // Multiplier theo severity
    const severityMultipliers = {
      low: 0.8,
      medium: 1.0,
      high: 1.2,
      critical: 1.5
    };

    const baseRate = baseRates[brokenState] || { repair: 0.1, discard: 0.3 };
    const multiplier = severityMultipliers[severity] || 1.0;
    
    return {
      repair: baseRate.repair ? (baseRate.repair * multiplier) : 0,
      discard: baseRate.discard ? (baseRate.discard * multiplier) : 0
    };
  };

  // Tự động đọc ghi chú từ sự cố vào ô ghi chú (người dùng có thể giữ hoặc xóa ghi lại)
  useEffect(() => {
    setNote(incident?.description || "");
  }, [incident]);

  // Fetch thông tin thiết bị
  useEffect(() => {
    const fetchEquipments = async () => {
      if (!isEquipmentIncident) return;

      setLoadingEquipments(true);
      try {
        const equipmentPromises = incident.equipment_ids.map(async (eqId) => {
          try {
            const res = await equipmentApi.getEquipmentById(eqId);
            const equipment = res?.equipment;
            if (equipment) {
              const category = equipment.category_id;
              const originalPrice = category?.price || 0;
              const suggestedRates = getSuggestedCompensationRate(incident.severity, "broken");
              
              return {
                equipment_id: eqId,
                equipment_name: category?.name || "Thiết bị",
                original_price: originalPrice,
                broken_state: "broken", // Default
                resolution: "repair", // Default
                compensation_rate: suggestedRates.repair, // Default to repair rate
                penalty_fee: Math.round(originalPrice * suggestedRates.repair),
                condition: equipment.condition,
                status: equipment.status
              };
            }
            return null;
          } catch (err) {
            console.error(`Error fetching equipment ${eqId}:`, err);
            return null;
          }
        });

        const equipmentData = await Promise.all(equipmentPromises);
        setEquipments(equipmentData.filter(eq => eq !== null));
      } catch (err) {
        console.error("Error fetching equipments:", err);
        setEquipments([]);
      } finally {
        setLoadingEquipments(false);
      }
    };

    fetchEquipments();
  }, [incident]);

  // Fetch thông tin booking nếu là khách hàng
  useEffect(() => {
    const fetchBookingInfo = async () => {
      if (!isCustomer || !incident.booking_id) return;

      try {
        const bookingRes = await bookingApi.getAllBookings();
        const allBookings = bookingRes?.result || bookingRes?.data || [];
        const booking = allBookings.find(b => String(b._id) === String(incident.booking_id));
        
        if (booking) {
          console.log("Found booking for incident:", booking);
          setBookingInfo({
            booking_id: booking._id,
            booking_code: booking.code || booking._id.toString().slice(-6),
            room_number: booking.rooms?.[0]?.room_info?.room_number || "N/A"
          });
        }
      } catch (err) {
        console.error("Error fetching booking info:", err);
      }
    };

    fetchBookingInfo();

  }, [incident, isCustomer]);

  // Cập nhật penalty_fee khi thay đổi rate hoặc resolution
  const updateEquipmentPenalty = (index, field, value) => {
    const updated = [...equipments];
    updated[index] = { ...updated[index], [field]: value };

    if (field === "compensation_rate" || field === "resolution") {
      const eq = updated[index];
      const suggestedRates = getSuggestedCompensationRate(incident.severity, eq.broken_state);
      
      if (field === "resolution") {
        // Update rate based on resolution
        eq.compensation_rate = suggestedRates[value] || eq.compensation_rate;
      }
      
      // Recalculate penalty_fee
      eq.penalty_fee = Math.round(eq.original_price * eq.compensation_rate);
    } else if (field === "broken_state") {
      // Update suggested rates when broken_state changes
      const suggestedRates = getSuggestedCompensationRate(incident.severity, value);
      eq.compensation_rate = suggestedRates[eq.resolution] || eq.compensation_rate;
      eq.penalty_fee = Math.round(eq.original_price * eq.compensation_rate);
    } else if (field === "penalty_fee") {
      // Manual override - calculate new rate
      eq.compensation_rate = eq.original_price > 0 ? (Number(value) / eq.original_price) : 0;
    }

    setEquipments(updated);
  };

  // Tính tổng tiền bồi thường
  const totalFee = isEquipmentIncident 
    ? equipments.reduce((sum, eq) => sum + (eq.penalty_fee || 0), 0)
    : totalFeeNonEquipment;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isEquipmentIncident && equipments.length === 0) {
      setToast({ message: "Vui lòng chờ tải thông tin thiết bị hoặc kiểm tra lại sự cố.", type: "error" });
      return;
    }

    if (isEquipmentIncident && equipments.some(eq => !eq.broken_state || !eq.resolution || eq.penalty_fee <= 0)) {
      setToast({ message: "Vui lòng điền đầy đủ thông tin cho tất cả thiết bị.", type: "error" });
      return;
    }

    if (!isEquipmentIncident && (!totalFee || totalFee <= 0)) {
      setToast({ message: "Vui lòng nhập số tiền bồi thường hợp lệ.", type: "error" });
      return;
    }

    setLoading(true);
    try {
      let payload;

      if (isEquipmentIncident) {
        // Gửi compensation_details cho sự cố về thiết bị
        payload = {
          payer_type: incident.caused_by || 'customer',
          payer_id: incident.causer_id?._id || incident.causer_id,
          compensation_details: equipments.map(eq => ({
            equipment_id: eq.equipment_id,
            broken_state: eq.broken_state,
            resolution: eq.resolution
          })),
          note: note || `Bồi thường cho sự cố thiết bị: ${incident.type}`
        };
        
        // Gọi API tạo phiếu đền bù với compensation_details
        await incidentApi.createCompensationTicketWithDetails(incident._id, payload);
      } else {
        // Gửi total_fee cho sự cố không về thiết bị
        payload = {
          payer_type: incident.caused_by || 'customer',
          payer_id: incident.causer_id?._id || incident.causer_id,
          total_fee: totalFee,
          note: note || `Bồi thường cho sự cố: ${incident.type}`
        };
        
        await incidentApi.createCompensationTicket(incident._id, payload);
      }

      setToast({ message: "Đã tạo phiếu bồi thường thành công!", type: "success" });
      onSuccess?.();
      onClose();
    } catch (err) {
      console.error(err);
      setToast({ message: "Lỗi: " + (err.response?.data?.message || err.message), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-red-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-red-700 flex items-center gap-2">
            <FiDollarSign /> Tạo Phiếu Đền Bù
          </h3>
          <button onClick={onClose}><FiX className="text-gray-500 hover:text-red-700" size={20}/></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Thông tin đối tượng */}
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-500">Đối tượng:</span>
                <span className="font-bold text-gray-800 uppercase ml-2">{payerTypeLabel}</span>
              </div>
              <div>
                <span className="text-gray-500">Họ tên:</span>
                <span className="font-bold text-indigo-600 ml-2">{payerName}</span>
              </div>
            </div>

            {/* Hiển thị thông tin phòng và booking nếu là khách hàng */}
            {isCustomer && (
              <div className="mt-3 pt-3 border-t border-gray-300">
                <div className="flex items-center gap-2 text-blue-700 font-semibold mb-2">
                  <FiMapPin size={16} />
                  <span>Thông tin phòng và booking:</span>
                </div>
                <div className="grid grid-cols-2 gap-3 bg-white p-2 rounded border border-blue-200">
                  <div className="flex items-center gap-2">
                    <FiMapPin size={14} className="text-gray-400" />
                    <span className="text-gray-600">Phòng:</span>
                    <span className="font-bold text-gray-800">
                      {
                        incident.rooms?.[0]?.room_info?.room_number ||
                        bookingInfo?.room_number ||
                        "N/A"
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FiCalendar size={14} className="text-gray-400" />
                    <span className="text-gray-600">Mã Booking:</span>
                    <span className="font-bold text-gray-800">
                      {bookingInfo?.booking_code || incident.booking_id?._id?.toString().slice(-6) || "N/A"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Danh sách thiết bị nếu là sự cố về thiết bị */}
          {isEquipmentIncident ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b">
                <FiPackage size={18} className="text-amber-600" />
                <h4 className="font-bold text-gray-800">Danh sách thiết bị bị hư hỏng</h4>
              </div>

              {loadingEquipments ? (
                <div className="text-center py-8 text-gray-500">Đang tải thông tin thiết bị...</div>
              ) : equipments.length > 0 ? (
                <div className="space-y-3">
                  {equipments.map((eq, index) => (
                    <div key={eq.equipment_id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h5 className="font-bold text-gray-800">{eq.equipment_name}</h5>
                          <div className="text-sm text-gray-600 mt-1">
                            Giá gốc: <span className="font-semibold text-green-700">
                              {new Intl.NumberFormat('vi-VN').format(eq.original_price)} đ
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Tiền bồi thường</div>
                          <div className="text-lg font-bold text-red-600">
                            {new Intl.NumberFormat('vi-VN').format(eq.penalty_fee)} đ
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Tình trạng hư hỏng</label>
                          <select
                            value={eq.broken_state}
                            onChange={(e) => updateEquipmentPenalty(index, "broken_state", e.target.value)}
                            className="w-full border rounded px-2 py-1.5 text-sm"
                          >
                            <option value="scratched">Xước nhẹ</option>
                            <option value="cracked">Nứt</option>
                            <option value="broken">Vỡ/Hỏng</option>
                            <option value="lost">Mất</option>
                            <option value="unusable">Không dùng được</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">Giải pháp</label>
                          <select
                            value={eq.resolution}
                            onChange={(e) => updateEquipmentPenalty(index, "resolution", e.target.value)}
                            className="w-full border rounded px-2 py-1.5 text-sm"
                          >
                            <option value="repair">Sửa chữa</option>
                            <option value="discard">Thay thế</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-700 mb-1">
                            % Bồi thường <span className="text-gray-400">(Có thể chỉnh)</span>
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="200"
                              value={Math.round(eq.compensation_rate * 100 * 10) / 10}
                              onChange={(e) => {
                                const percent = Number(e.target.value);
                                if (isNaN(percent)) return;
                                const rate = Math.min(percent / 100, 2);
                                updateEquipmentPenalty(index, "compensation_rate", rate);
                              }}
                              className="w-full border rounded px-2 py-1.5 text-sm"
                            />

                            <span className="text-xs text-gray-500">%</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-amber-300">
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                          Số tiền bồi thường <span className="text-gray-400">(Có thể chỉnh)</span>
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            value={eq.penalty_fee}
                            onChange={(e) => updateEquipmentPenalty(index, "penalty_fee", Number(e.target.value))}
                            className="w-full border rounded px-3 py-2 pl-8 text-sm font-semibold text-red-600"
                          />
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">₫</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Tự động tính: {new Intl.NumberFormat('vi-VN').format(eq.original_price)} × {(eq.compensation_rate * 100).toFixed(1)}% = {new Intl.NumberFormat('vi-VN').format(Math.round(eq.original_price * eq.compensation_rate))} đ
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">Không tìm thấy thông tin thiết bị</div>
              )}

              {/* Tổng tiền */}
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-gray-800 text-lg">Tổng tiền bồi thường:</span>
                  <span className="text-2xl font-bold text-red-700">
                    {new Intl.NumberFormat('vi-VN').format(totalFee)} đ
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Form cho sự cố không về thiết bị */
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Số tiền bồi thường (VNĐ)</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10 focus:ring-2 focus:ring-red-200 outline-none font-bold text-lg text-red-600"
                  placeholder="0"
                  value={totalFeeNonEquipment || ""}
                  onChange={(e) => {
                    const value = Number(e.target.value);
                    if (!isNaN(value) && value >= 0) {
                      setTotalFeeNonEquipment(value);
                    }
                  }}
                  autoFocus
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₫</span>
              </div>
              <p className="text-xs text-gray-400 mt-1 italic">* Số tiền này sẽ được tính vào hóa đơn hoặc trừ lương.</p>
            </div>
          )}

          {/* Ghi chú */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Lý do / Ghi chú</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-200 outline-none h-20 text-sm"
              placeholder="Ví dụ: Làm vỡ TV Samsung 43 inch..."
              value={note}
              onChange={e => setNote(e.target.value)}
            />
          </div>

          <div className="pt-2 flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-gray-50 transition">
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading || loadingEquipments}
              className="flex-1 py-2.5 rounded-lg bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-200 transition"
            >
              {loading ? "Đang tạo..." : "Xác nhận Tạo"}
            </button>
          </div>
        </form>
      </div>
    </div>
    </>
  );
}
