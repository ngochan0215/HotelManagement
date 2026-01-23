import React, { useState, useEffect } from "react";
import { FiTrash2, FiPlus, FiX, FiAlertCircle, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import { roomApi } from "../../api/roomApi.js";
import dayjs from "dayjs";
import { StatusPill } from "../../../components/ui/label.jsx";

const STATUS_MAP = {
  reserved:    { label: "Đang giữ", color: "orange" },
  available:   { label: "Trống",    color: "emerald" },
  booked:      { label: "Đã đặt",   color: "blue" },
  occupied:    { label: "Đang ở",   color: "indigo" },
  cleaning:    { label: "Dọn dẹp",  color: "orange" },
  maintenance: { label: "Bảo trì",  color: "red" },
};

const MANUAL_STATUSES = ["available", "cleaning", "maintenance"];

export default function RoomListTab() {
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // --- STATE PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7; // Hiển thị 10 phòng mỗi trang

  const [formData, setFormData] = useState({
    room_number: "", category_id: "", room_status: "available", start_time: "", end_time: ""
  });

  const isTimeRequired = ["maintenance", "cleaning"].includes(formData.room_status);
  const isStatusLocked = editingItem && ["occupied", "booked", "reserved"].includes(editingItem.room_status);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [roomsRes, catsRes] = await Promise.all([
        roomApi.getAllRooms(),
        roomApi.getAllCategories()
      ]);

      if (roomsRes && Array.isArray(roomsRes.rooms)) {
        setRooms(roomsRes.rooms);
      } else {
        setRooms([]);
      }

      if (Array.isArray(catsRes)) {
        setCategories(catsRes);
      } else {
        setCategories([]);
      }

    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
      setRooms([]);
    }
  };

  // --- TÍNH TOÁN PHÂN TRANG ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  // Kiểm tra rooms có phải mảng không trước khi slice
  const safeRooms = Array.isArray(rooms) ? rooms : [];
  const currentRooms = safeRooms.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(safeRooms.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData };

    if (isTimeRequired) {
        if (!payload.start_time || !payload.end_time) {
            alert("Vui lòng nhập đầy đủ Thời gian bắt đầu và Kết thúc cho trạng thái này!");
            return;
        }
        if (new Date(payload.end_time) <= new Date(payload.start_time)) {
            alert("Thời gian kết thúc phải sau thời gian bắt đầu!");
            return;
        }
    } else {
        payload.start_time = null;
        payload.end_time = null;
    }

    try {
      if (editingItem) {
        await roomApi.updateRoom(editingItem._id, payload);
      } else {
        await roomApi.createRoom(payload);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({
        room_number: "", category_id: "", room_status: "available", start_time: "", end_time: "",
      });
      fetchData();
      alert("Thành công!");
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id, status) => {
    if (["occupied", "booked"].includes(status)) {
        alert("Không thể xóa phòng đang có khách hoặc đã được đặt trước!");
        return;
    }
    if (window.confirm("Xóa phòng này?")) {
      try {
        await roomApi.deleteRoom(id);
        fetchData();
      } catch (error) {
        alert("Lỗi xóa: " + error.message);
      }
    }
  };

  const openEdit = async (item) => {
    try {
      const res = await roomApi.getRoomById(item._id);
      const data = res.data || res;
      const room = data.room;
      const log = Array.isArray(room.roomStatusLog) ? room.roomStatusLog[0] : null;

      if (!room) {
        alert("Không tìm thấy dữ liệu phòng!");
        return;
      }
      setEditingItem(room);
      setFormData({
        room_number: room.room_number,
        category_id: room.category_id?._id || "",
        room_status: log?.status || room.room_status,
        start_time: log?.start_time ? dayjs(log.start_time).format("YYYY-MM-DDTHH:mm") : "",
        end_time: log?.end_time ? dayjs(log.end_time).format("YYYY-MM-DDTHH:mm") : "",
      });

      setIsModalOpen(true);
    } catch (error) {
      console.error(error);
      alert("Không tải được dữ liệu phòng!");
    }
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-800">Danh sách Phòng</h2>
        <button
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
              const firstCatId = categories.length > 0 ? categories[0]._id : "";
              setFormData({ room_number: "", category_id: firstCatId, room_status: "available", start_time: "", end_time: "" });
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          <FiPlus /> Thêm phòng mới
        </button>
      </div>

      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 text-sm border-b border-gray-100 bg-gray-50/50">
              <th className="py-3 font-semibold pl-4">Số phòng</th>
              <th className="py-3 font-semibold">Loại phòng</th>
              <th className="py-3 font-semibold">Trạng thái</th>
              <th className="py-3 font-semibold">Bắt đầu</th>
              <th className="py-3 font-semibold">Kết thúc</th>
              <th className="py-3 font-semibold text-right pr-4">Hành động</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {currentRooms.length > 0 ? (
              currentRooms.map((room) => {
                const displayStatus = room.roomStatusLog?.status || room.room_status || "available";
                const statusInfo = STATUS_MAP[displayStatus] || STATUS_MAP.available;

                const start_time = room.roomStatusLog?.start_time
                  ? new Date(room.roomStatusLog.start_time).toLocaleString("vi-VN") : "—";
                const end_time = room.roomStatusLog?.end_time
                  ? new Date(room.roomStatusLog.end_time).toLocaleString("vi-VN") : "—";

                let catName = "---";
                if (room.category_id && room.category_id.category_name) {
                  catName = room.category_id.category_name;
                } else if (categories.length > 0) {
                  const foundCat = categories.find(c => c._id === room.category_id);
                  if (foundCat) catName = foundCat.category_name;
                }

                return (
                  <tr key={room._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                    <td className="py-4 pl-4">
                        <span className="font-bold bg-gray-100 px-2 py-1 rounded text-gray-800">{room.room_number}</span>
                    </td>
                    <td className="py-4 font-medium text-gray-600">{catName}</td>
                    <td className="py-4">
                      <StatusPill label={statusInfo.label} color={statusInfo.color} />
                    </td>
                    <td className="py-4 font-medium text-gray-600 text-xs">{start_time}</td>
                    <td className="py-4 font-medium text-gray-600 text-xs">{end_time}</td>
                    <td className="py-4 text-right pr-4">
                      <button onClick={() => openEdit(room)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-xs mr-2 font-medium">Cập nhật</button>
                      <button onClick={() => handleDelete(room._id, room.room_status)} className="text-gray-400 hover:text-red-500"><FiTrash2 size={16}/></button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-8 text-gray-400">
                   {rooms === null ? "Đang tải dữ liệu..." : "Chưa có dữ liệu phòng nào."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* --- PHÂN TRANG UI --- */}
      {safeRooms.length > 0 && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
            <div className="text-sm text-gray-500">
                Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, safeRooms.length)}</b> trong tổng <b>{safeRooms.length}</b>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FiChevronLeft />
                </button>
                {/* Chỉ hiển thị tối đa 5 trang gần nhất nếu quá nhiều trang, ở đây làm đơn giản */}
                {Array.from({ length: totalPages }, (_, i) => {
                    // Logic ẩn bớt trang nếu quá nhiều (optional enhancement)
                    if (totalPages > 8 && Math.abs(currentPage - (i + 1)) > 2 && i !== 0 && i !== totalPages - 1) {
                         if (Math.abs(currentPage - (i + 1)) === 3) return <span key={i} className="px-1 text-gray-400">...</span>;
                         return null;
                    }
                    return (
                        <button
                            key={i + 1}
                            onClick={() => handlePageChange(i + 1)}
                            className={`w-8 h-8 rounded-lg text-sm font-bold transition ${
                                currentPage === i + 1
                                ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                                : "border hover:bg-gray-50 text-gray-600"
                            }`}
                        >
                            {i + 1}
                        </button>
                    );
                })}
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <FiChevronRight />
                </button>
            </div>
        </div>
      )}

      {/* --- MODAL GIỮ NGUYÊN --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[450px] shadow-2xl animate-fade-in">
            <div className="flex justify-between mb-4 items-center border-b pb-2">
                <h3 className="font-bold text-lg text-gray-800">{editingItem ? "Cập nhật phòng" : "Thêm phòng mới"}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={24}/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                {/* Form fields giữ nguyên */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số phòng</label>
                    <input type="text" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={formData.room_number} onChange={e => setFormData({...formData, room_number: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại phòng</label>
                    <select required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        value={formData.category_id} onChange={e => setFormData({...formData, category_id: e.target.value})}>
                        <option value="">-- Chọn loại phòng --</option>
                        {categories.map(cat => (
                            <option key={cat._id} value={cat._id}>{cat.category_name}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                    <select required disabled={isStatusLocked}
                        className={`w-full border rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white ${isStatusLocked ? 'bg-gray-100 text-gray-500 cursor-not-allowed' : 'border-gray-300'}`}
                        value={formData.room_status} onChange={e => setFormData({...formData, room_status: e.target.value})}>
                        {Object.entries(STATUS_MAP).map(([key, val]) => {
                            if (editingItem && !MANUAL_STATUSES.includes(key) && key !== formData.room_status) return null;
                            return <option key={key} value={key}>{val.label}</option>
                        })}
                    </select>
                    {isStatusLocked && (
                        <div className="flex items-start gap-2 mt-2 text-xs text-orange-600 bg-orange-50 p-2 rounded border border-orange-100">
                            <FiAlertCircle className="mt-0.5 shrink-0" size={14}/>
                            <span>Phòng đang có khách hoặc đã đặt. Vui lòng thực hiện <b>Check-out/Hủy</b> tại trang Đặt phòng để chuyển về trạng thái Trống.</span>
                        </div>
                    )}
                </div>

                {isTimeRequired && !isStatusLocked && (
                  <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">Cài đặt thời gian {STATUS_MAP[formData.room_status]?.label}</p>
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Thời gian bắt đầu <span className="text-red-500">*</span></label>
                      <input type="datetime-local" required={isTimeRequired} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"
                        value={formData.start_time || ""} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Kết thúc dự kiến <span className="text-red-500">*</span></label>
                      <input type="datetime-local" required={isTimeRequired} className="w-full border border-gray-300 rounded-lg p-2.5 outline-none bg-white"
                        value={formData.end_time || ""} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
                    </div>
                  </div>
                )}

                <div className="pt-2">
                  <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                      {editingItem ? "Lưu thay đổi" : "Tạo phòng"}
                  </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}