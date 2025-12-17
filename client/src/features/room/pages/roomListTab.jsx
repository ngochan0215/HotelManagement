import React, { useState, useEffect } from "react";
import { FiEdit, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import { roomApi } from "../../api/roomApi";

const STATUS_MAP = {
  available: { label: "Trống", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  booked: { label: "Đã đặt", color: "bg-blue-100 text-blue-700 border-blue-200" },
  occupied: { label: "Đang ở", color: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  cleaning: { label: "Dọn dẹp", color: "bg-amber-100 text-amber-700 border-amber-200" },
  maintenance: { label: "Bảo trì", color: "bg-rose-100 text-rose-700 border-rose-200" },
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

  // --- HÀM FETCH DATA THÔNG MINH (TỰ ĐỘNG NHẬN DIỆN CẤU TRÚC) ---
  const fetchData = async () => {
    try {
      const [roomsRes, catsRes] = await Promise.all([
        roomApi.getAllRooms(),
        roomApi.getAllCategories()
      ]);

      console.log("👉 API Rooms trả về:", roomsRes); // Check log xem data thực tế
      console.log("👉 API Categories trả về:", catsRes);

      // 1. XỬ LÝ DỮ LIỆU PHÒNG
      if (Array.isArray(roomsRes)) {
        setRooms(roomsRes); // Trường hợp 1: Trả về mảng trực tiếp [..]
      } else if (roomsRes && Array.isArray(roomsRes.data)) {
        setRooms(roomsRes.data); // Trường hợp 2: { data: [..] }
      } else if (roomsRes && Array.isArray(roomsRes.rooms)) {
        setRooms(roomsRes.rooms); // Trường hợp 3: { rooms: [..] }
      } else {
        console.warn("⚠️ Không tìm thấy mảng phòng trong response:", roomsRes);
        setRooms([]);
      }

      // 2. XỬ LÝ DỮ LIỆU LOẠI PHÒNG
      if (Array.isArray(catsRes)) {
        setCategories(catsRes);
      } else if (catsRes && Array.isArray(catsRes.data)) {
        setCategories(catsRes.data);
      } else if (catsRes && Array.isArray(catsRes.categories)) { // Hoặc key là categories
        setCategories(catsRes.categories);
      } else {
        setCategories([]);
      }

    } catch (error) {
      console.error("❌ Lỗi tải dữ liệu:", error);
      setRooms([]); // Fallback về mảng rỗng để không crash
    }
  };

  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   try {
  //     if (editingItem) {
  //       await roomApi.updateRoom(editingItem._id, formData);
  //     } else {
  //       await roomApi.createRoom(formData);
  //     }
  //     setIsModalOpen(false);
  //     setFormData({ room_number: "", category_id: "", room_status: "available" });
  //     setEditingItem(null);
  //     fetchData();
  //     alert("Thành công!");
  //   } catch (error) {
  //     alert("Lỗi: " + (error.response?.data?.message || error.message));
  //   }
  // };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = { ...formData };

    console.log("PAYLOAD IN HANDLESUBMIT: ", payload);
    if (["cleaning", "maintenance"].includes(formData.room_status)) {
      if (!formData.start_time || !formData.end_time) {
        return alert("Vui lòng chọn thời gian bắt đầu và kết thúc!");
      }

      if (new Date(formData.end_time) <= new Date(formData.start_time)) {
        return alert("Thời gian kết thúc phải sau thời gian bắt đầu!");
      }
    } else {
      // Không gửi timeline nếu không cần
      delete payload.start_time;
      delete payload.end_time;
    }

    console.log("editingItem: ", editingItem);
    try {
      if (editingItem) {
        console.log("I AM HERE");
        await roomApi.updateRoom(editingItem._id, payload);
      } else {
        await roomApi.createRoom(payload);
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({
        room_number: "",
        category_id: "",
        room_status: "available",
        start_time: "",
        end_time: "",
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

  // const openEdit = (item) => {
  //   setEditingItem(item);
  //   setFormData({
  //     room_number: item.room_number,
  //     category_id: item.category_id?._id || item.category_id || "",
  //     room_status: item.room_status,
  //     start_time: item.start_time || "",
  //     end_time: item.start_time || "",
  //   });
  //   setIsModalOpen(true);
  // };

//   const openEdit = async (item) => {
//   try {
//     const res = await roomApi.getRoomById(item._id);
//     const room = res.room || res.data?.room;
//     const log = room.roomStatusLog || room?.roomStatusLog;

//     setEditingItem(room);

//     setFormData({
//       room_number: room.room_number,
//       category_id: room.category_id?._id || room.category_id || "",
//       room_status: room.room_status,
//       start_time: log?.start_time ? log.start_time.slice(0, 16) : "",
//       end_time: log?.end_time ? log.end_time.slice(0, 16) : "",
//     });

//     setIsModalOpen(true);
//   } catch (error) {
//     alert("Không tải được dữ liệu phòng!");
//     console.error(error);
//   }
// };

const openEdit = async (item) => {
  try {
    const res = await roomApi.getRoomById(item._id);

    // CHỐT CHẶN DATA Ở ĐÂY
    const data = res.data || res;
    const room = data.room;
    const log = data.roomStatusLog;

    if (!room) {
      alert("Không tìm thấy dữ liệu phòng!");
      return;
    }

    setEditingItem(room);

    setFormData({
      room_number: room.room_number,
      category_id: room.category_id?._id || room.category_id || "",
      room_status: room.room_status,
      start_time: log?.start_time ? log.start_time.slice(0, 16) : "",
      end_time: log?.end_time ? log.end_time.slice(0, 16) : "",
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
              // Tự chọn loại phòng đầu tiên nếu có
              const firstCatId = categories.length > 0 ? categories[0]._id : "";
              setFormData({ room_number: "", category_id: "", room_status: "available" });
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
                ? new Date(room.roomStatusLog.start_time).toLocaleString()
                : "—";
              const end_time = room.roomStatusLog?.end_time
                ? new Date(room.roomStatusLog.end_time).toLocaleString()
                : "—";

              // Tìm tên loại phòng an toàn
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
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
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
              <td colSpan="4" className="text-center py-8 text-gray-400">
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
                        placeholder="VD: 101"
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

                {["cleaning", "maintenance"].includes(formData.room_status) && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Thời gian bắt đầu
                      </label>
                      <input
                        type="datetime-local"
                        required
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={formData.start_time}
                        onChange={(e) =>
                          setFormData({ ...formData, start_time: e.target.value })
                        }
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Thời gian kết thúc
                      </label>
                      <input
                        type="datetime-local"
                        required
                        className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={formData.end_time}
                        onChange={(e) =>
                          setFormData({ ...formData, end_time: e.target.value })
                        }
                      />
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