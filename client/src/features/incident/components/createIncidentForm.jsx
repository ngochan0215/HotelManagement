import React, { useEffect, useState, useRef } from "react";
import { incidentApi } from "../../api/incidentApi";
import { employeeApi } from "../../api/employeeApi";
import { roomApi } from "../../api/roomApi";
import { bookingApi } from "../../api/bookingApi";
import { customerApi } from "../../api/customerApi";

const SearchableSelect = ({ label, options, value, onChange, placeholder }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  const filteredOptions = options.filter(opt =>
    opt?.label?.toLowerCase().includes(search.toLowerCase())
  );

  const displayedOptions = filteredOptions.slice(0, 50);

  const selectedOption = options.find(o => o.id === value);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => {
        inputRef.current.focus();
      }, 50);
    }
  }, [isOpen]);

  return (
    <div className="relative mb-4" ref={wrapperRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-1">{label}</label>
      <div
        className={`w-full border rounded px-3 py-2 bg-white cursor-pointer flex justify-between items-center ${isOpen ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300'}`}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) setSearch("");
        }}
      >
        <span className={`truncate text-sm ${value ? 'text-gray-900' : 'text-gray-500'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="text-gray-400 text-xs ml-2">▼</span>
      </div>

      {isOpen && (
        <div
            className="absolute z-50 mt-1 w-full bg-white border border-gray-300 rounded shadow-lg max-h-60 overflow-hidden flex flex-col animate-fade-in-down"
            onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-2 border-b bg-gray-50">
            <input
              ref={inputRef}
              type="text"
              className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:border-blue-500"
              placeholder="Gõ tìm kiếm..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="overflow-y-auto flex-1">
            {displayedOptions.length > 0 ? (
              <>
                {displayedOptions.map((opt) => (
                  <div
                    key={opt.id}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                    }}
                    className={`px-3 py-2 text-sm cursor-pointer border-b border-gray-50 last:border-0 hover:bg-blue-50 ${value === opt.id ? 'bg-blue-100 text-blue-800 font-semibold' : 'text-gray-700'}`}
                  >
                    {opt.label}
                  </div>
                ))}
                {filteredOptions.length > 50 && (
                  <div className="p-2 text-xs text-center text-gray-400 italic bg-gray-50">
                    ...và {filteredOptions.length - 50} kết quả khác. Hãy nhập thêm từ khóa.
                  </div>
                )}
              </>
            ) : (
              <div className="p-3 text-center text-sm text-gray-500">
                Không tìm thấy kết quả.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default function CreateIncidentModal({ onClose, onSuccess }) {
  const [rooms, setRooms] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    description: "",
    type: "equipment",
    severity: "medium",
    caused_by: "other",
    causer_id: "",
    occured_at: new Date().toISOString().slice(0, 16),
    room_id: "",
    booking_id: "",
  });

  const POSITIONS = [
    { id: "manager", label: "Quản lý" },
    { id: "receptionist", label: "Lễ tân" },
    { id: "housekeeper", label: "Buồng phòng" },
    { id: "technician", label: "Kỹ thuật" },
    { id: "customer-service", label: "CSKH" },
    { id: "accountant", label: "Kế toán" },
    { id: "it", label: "CNTT" },
  ];

  const getPositionLabel = (posId) => {
    const found = POSITIONS.find(p => p.id === posId);
    return found ? found.label : posId;
  };

  useEffect(() => {
    loadOptions();
  }, []);

  const loadOptions = async () => {
    try {
      const [roomRes, bookingRes, empRes, custRes] = await Promise.all([
        roomApi.getAllRooms(),
        bookingApi.getAllBookings(),
        employeeApi.getAllEmployees(),
        customerApi.getAllCustomers()
      ]);

      setRooms(roomRes?.rooms || roomRes?.data || []);
      setBookings(bookingRes?.bookings || bookingRes?.data || []);
      setEmployees(empRes?.employees || empRes?.data || []);
      setCustomers(custRes?.customers || custRes?.data || []);
    } catch (err) {
      console.error("Load options failed", err);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "caused_by") {
      setForm((prev) => ({ ...prev, causer_id: "" }));
    }
  };

  const getCauserOptions = () => {
      if (form.caused_by === "employee") {
        return employees.map((e) => ({
          id: e.user_id,
          label: `${e.full_name} - NV (${getPositionLabel(e.position) || "N/A"})`
        }));
      }

      if (form.caused_by === "customer") {
        return customers.map((c, index) => ({
          id: c.user_id?._id || c.user_id,

          label: `${c.full_name} | CCCD: ${c.CCCD || "Trống"} | SĐT: ${c.phone_number || "Trống"}`
        }));
      }
      return [];
    };
  const getRoomOptions = () => rooms.map(r => ({
    id: r._id,
    label: `Phòng ${r.room_number} - ${r.type_id?.name || 'Standard'}`
  }));

  const getBookingOptions = () => bookings.map(b => ({
    id: b._id,
    label: `Mã: ${b.code} - Khách: ${b.customer_name}`
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.type || !form.severity) {
      alert("Vui lòng điền đầy đủ thông tin mô tả, loại và mức độ.");
      return;
    }
    if (form.caused_by !== "other" && !form.causer_id) {
      alert("Vui lòng chọn người gây ra sự cố.");
      return;
    }
    if (form.caused_by !== "other" && form.causer_id.toString().startsWith("temp_")) {
        alert("Lỗi dữ liệu hệ thống: Không lấy được ID khách hàng. Vui lòng báo bộ phận kỹ thuật (Backend) sửa API getAllCustomers.");
        return;
    }

    setLoading(true);
    try {
      const payload = {
        ...form,
        room_id: form.room_id || null,
        booking_id: form.booking_id || null,
        causer_id: form.caused_by !== "other" ? form.causer_id : null,
      };

      await incidentApi.createIncident(payload);
      onSuccess?.();
      onClose();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl shadow-lg border border-gray-200 flex flex-col max-h-[90vh]">

        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div>
            <h3 className="font-bold text-lg text-gray-800 uppercase tracking-wide">Báo cáo Sự cố</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-black font-bold text-xl px-2">✕</button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div>
               <label className="block text-sm font-semibold text-gray-700 mb-1">Loại sự cố</label>
               <select name="type" value={form.type} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="equipment">Hỏng thiết bị</option>
                  <option value="technical">Kỹ thuật (Điện/Nước)</option>
                  <option value="facility">Cơ sở vật chất</option>
                  <option value="service">Dịch vụ</option>
                  <option value="safety">An toàn / An ninh</option>
                  <option value="other">Khác</option>
               </select>
             </div>

             <div>
               <label className="block text-sm font-semibold text-gray-700 mb-1">Mức độ nghiêm trọng</label>
               <select name="severity" value={form.severity} onChange={handleChange}
                  className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm font-medium focus:outline-none focus:border-blue-500"
                  style={{ color: form.severity === 'critical' ? '#dc2626' : form.severity === 'high' ? '#ea580c' : 'inherit' }}>
                 <option value="low">Low - Ảnh hưởng thấp</option>
                 <option value="medium">Medium - Ảnh hưởng cục bộ</option>
                 <option value="high">High - Ảnh hưởng diện rộng</option>
                 <option value="critical">Critical - Ngừng hoạt động</option>
               </select>
             </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Mô tả chi tiết <span className="text-red-500">*</span></label>
            <textarea name="description" className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:border-blue-500 text-sm min-h-[100px]"
              placeholder="Nhập chi tiết về sự cố..." value={form.description} onChange={handleChange} />
          </div>

          <div className="border-t border-gray-100"></div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
               <label className="block text-sm font-semibold text-gray-700 mb-1">Nguyên nhân từ</label>
               <select name="caused_by" value={form.caused_by} onChange={handleChange} className="w-full border border-gray-300 rounded px-3 py-2 bg-white text-sm focus:outline-none focus:border-blue-500">
                 <option value="other">Không xác định</option>
                 <option value="employee">Nhân viên</option>
                 <option value="customer">Khách hàng</option>
               </select>
            </div>

            <div className="md:col-span-2">
              {form.caused_by !== "other" && (
                <SearchableSelect
                  label={`Tìm kiếm ${form.caused_by === 'employee' ? 'Nhân viên' : 'Khách hàng'}`}
                  placeholder={form.caused_by === 'employee' ? "Chọn nhân viên..." : "Gõ Tên, SĐT hoặc CCCD..."}
                  options={getCauserOptions()}
                  value={form.causer_id}
                  onChange={(val) => setForm(prev => ({ ...prev, causer_id: val }))}
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 border border-gray-200 rounded">
            <SearchableSelect label="Vị trí / Phòng" placeholder="-- Chọn phòng --" options={getRoomOptions()} value={form.room_id} onChange={(val) => setForm(prev => ({ ...prev, room_id: val }))} />
            <SearchableSelect label="Booking liên quan" placeholder="-- Chọn mã booking --" options={getBookingOptions()} value={form.booking_id} onChange={(val) => setForm(prev => ({ ...prev, booking_id: val }))} />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded border border-gray-300 text-gray-700 font-semibold hover:bg-white transition text-sm">Hủy bỏ</button>
          <button onClick={handleSubmit} disabled={loading} className="px-6 py-2 rounded bg-blue-700 text-white font-semibold hover:bg-blue-800 transition text-sm shadow-sm">{loading ? "Đang lưu..." : "Gửi Báo Cáo"}</button>
        </div>
      </div>
    </div>
  );
}