import React, { useState, useEffect } from "react";
import { FiEdit, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import { roomApi } from "../../api/roomApi";
import dayjs from "dayjs";

import { StatusPill } from "../../../components/ui/label";
const STATUS_MAP = {
  available:   { label: "Trống",    color: "emerald" },
  booked:      { label: "Đã đặt",   color: "blue" },
  occupied:    { label: "Đang ở",   color: "indigo" },
  cleaning:    { label: "Dọn dẹp",  color: "orange" },
  maintenance: { label: "Bảo trì",  color: "red" },
};

export default function RoomListTab() {
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    room_number: "", category_id: "", room_status: "available", start_time: "", end_time: ""
  });

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...formData };

    if (!formData.start_time || !formData.end_time) {
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

  const handleDelete = async (id) => {
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
      const log = room.roomStatusLog;

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
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-800">Danh sách Phòng</h2>
        <button
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
              const firstCatId = categories.length > 0 ? categories[0]._id : "";
              setFormData({ room_number: "", category_id: firstCatId, room_status: "available" });
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          <FiPlus /> Thêm phòng mới
        </button>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-gray-500 text-sm border-b border-gray-100">
            <th className="py-3 font-semibold pl-4">Số phòng</th>
            <th className="py-3 font-semibold">Loại phòng</th>
            <th className="py-3 font-semibold">Trạng thái</th>
            <th className="py-3 font-semibold">Bắt đầu</th>
            <th className="py-3 font-semibold">Kết thúc</th>
            <th className="py-3 font-semibold text-right pr-4">Hành động</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 text-sm">
          {Array.isArray(rooms) && rooms.length > 0 ? (
            rooms.map((room) => {
              const statusInfo = STATUS_MAP[room.room_status] || STATUS_MAP.available;
              const start_time = room.roomStatusLog?.start_time
                ? new Date(room.roomStatusLog.start_time).toLocaleString() : "—";
              const end_time = room.roomStatusLog?.end_time
                ? new Date(room.roomStatusLog.end_time).toLocaleString() : "—";

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
                    <StatusPill
                        label={statusInfo.label}
                        color={statusInfo.color}
                    />
                  </td>

                  <td className="py-4 font-medium text-gray-600">{start_time}</td>
                  <td className="py-4 font-medium text-gray-600">{end_time}</td>
                  <td className="py-4 text-right pr-4">
                    <button onClick={() => openEdit(room)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-xs mr-2 font-medium">Cập nhật</button>
                    <button onClick={() => handleDelete(room._id)} className="text-gray-400 hover:text-red-500"><FiTrash2 size={16}/></button>
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
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px] shadow-2xl">
            <div className="flex justify-between mb-4 items-center">
                <h3 className="font-bold text-lg text-gray-800">{editingItem ? "Cập nhật phòng" : "Thêm phòng mới"}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600"><FiX size={24}/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Số phòng</label>
                    <input type="text" required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
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
                    <select required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        value={formData.room_status} onChange={e => setFormData({...formData, room_status: e.target.value})}>
                        {Object.entries(STATUS_MAP).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>
                </div>

                {editingItem && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian bắt đầu</label>
                      <input type="datetime-local" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none"
                        value={formData.start_time || ""} onChange={(e) => setFormData({ ...formData, start_time: e.target.value })} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Thời gian kết thúc</label>
                      <input type="datetime-local" className="w-full border border-gray-300 rounded-lg p-2.5 outline-none"
                        value={formData.end_time || ""} onChange={(e) => setFormData({ ...formData, end_time: e.target.value })} />
                    </div>
                  </>
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