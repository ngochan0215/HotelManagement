import React, { useState, useEffect, useMemo } from "react";
import { FiTrash2, FiPlus, FiX, FiAlertCircle, FiChevronLeft, FiChevronRight, FiSettings, FiCheckCircle, FiArrowUp, FiArrowDown, FiFilter } from "react-icons/fi";
import { roomApi } from "../../api/roomApi.js";
import { equipmentApi } from "../../api/equipmentApi.js";
import dayjs from "dayjs";
import { StatusPill } from "../../../components/ui/label.jsx";

const STATUS_MAP = {
  new:         { label: "Mới tạo",  color: "blue" },
  reserved:    { label: "Đang giữ", color: "orange" },
  available:   { label: "Trống",    color: "emerald" },
  booked:      { label: "Đã đặt",   color: "blue" },
  occupied:    { label: "Đang ở",   color: "indigo" },
  cleaning:    { label: "Dọn dẹp",  color: "orange" },
  maintenance: { label: "Bảo trì",  color: "red" },
};

const MANUAL_STATUSES = ["available", "cleaning", "maintenance", "new"];

export default function RoomListTab() {
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const renderUnit = (unit) => {
    switch (unit) {
      case "piece", "item": return "Cái"; 
      case "set", "box": return "Bộ";
      case "packet": return "Gói";
      default: return unit;
    }
  };

  // --- STATE PHÂN TRANG ---
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7; // Hiển thị 10 phòng mỗi trang

  const [formData, setFormData] = useState({
    room_number: "", category_id: "", room_status: "new", start_time: "", end_time: ""
  });

  const [showInstallPreview, setShowInstallPreview] = useState(false);
  const [defaultEquipments, setDefaultEquipments] = useState([]);
  const [loadingEquipments, setLoadingEquipments] = useState(false);
  const [newRoomId, setNewRoomId] = useState(null); // Lưu room_id sau khi tạo phòng
  const [suggestedRoomNumber, setSuggestedRoomNumber] = useState(""); // Số phòng được gợi ý
  
  // --- STATE SẮP XẾP ---
  const [sortBy, setSortBy] = useState(null); // "status" | "category" | null
  const [sortOrder, setSortOrder] = useState("asc"); // "asc" | "desc"

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

      // Nếu đang có category được chọn và không phải đang edit, gợi ý lại số phòng
      if (formData.category_id && !editingItem) {
        setTimeout(() => suggestRoomNumber(formData.category_id), 100);
      }

    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
      setRooms([]);
    }
  };

  // --- LOGIC SẮP XẾP ---
  const sortedRooms = useMemo(() => {
    if (!Array.isArray(rooms)) return [];
    
    let sorted = [...rooms];
    
    if (sortBy === "status") {
      sorted.sort((a, b) => {
        const statusA = a.roomStatusLog?.status || a.room_status || "new";
        const statusB = b.roomStatusLog?.status || b.room_status || "new";
        const labelA = STATUS_MAP[statusA]?.label || statusA;
        const labelB = STATUS_MAP[statusB]?.label || statusB;
        
        if (sortOrder === "asc") {
          return labelA.localeCompare(labelB, "vi");
        } else {
          return labelB.localeCompare(labelA, "vi");
        }
      });
    } else if (sortBy === "category") {
      sorted.sort((a, b) => {
        const catA = a.category_id?.category_name || "";
        const catB = b.category_id?.category_name || "";
        
        if (sortOrder === "asc") {
          return catA.localeCompare(catB, "vi");
        } else {
          return catB.localeCompare(catA, "vi");
        }
      });
    }
    
    return sorted;
  }, [rooms, sortBy, sortOrder]);

  // --- TÍNH TOÁN PHÂN TRANG ---
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  // Kiểm tra rooms có phải mảng không trước khi slice
  const safeRooms = sortedRooms;
  const currentRooms = safeRooms.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(safeRooms.length / itemsPerPage);
  
  // Reset về trang 1 khi sort thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy, sortOrder]);

  const handlePageChange = (page) => setCurrentPage(page);
  
  // Hàm xử lý sort
  const handleSort = (field) => {
    if (sortBy === field) {
      // Nếu đang sort theo field này, đảo ngược thứ tự
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      // Nếu chưa sort theo field này, set sortBy và mặc định asc
      setSortBy(field);
      setSortOrder("asc");
    }
  };
  
  // Hàm reset sort
  const handleResetSort = () => {
    setSortBy(null);
    setSortOrder("asc");
  };

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
        setIsModalOpen(false);
        setEditingItem(null);
        setFormData({
          room_number: "", category_id: "", room_status: "new", start_time: "", end_time: "",
        });
        setSuggestedRoomNumber("");
        fetchData();
        alert("Thành công!");
      } else {
        // Tạo phòng mới
        const res = await roomApi.createRoom(payload);
        setIsModalOpen(false);
        setFormData({
          room_number: "", category_id: "", room_status: "new", start_time: "", end_time: "",
        });
        setSuggestedRoomNumber("");
        fetchData();
        alert("Thành công!");
      }
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  const handlePreviewInstallTicket = async (categoryId, roomId = null) => {
    if (!categoryId) {
      alert("Vui lòng chọn loại phòng trước!");
      return;
    }

    // Nếu có roomId được truyền vào, dùng nó
    // Nếu không, dùng room_id từ editingItem
    const targetRoomId = roomId || (editingItem && editingItem._id);
    
    if (!targetRoomId) {
      alert("Không tìm thấy thông tin phòng. Vui lòng chọn phòng từ danh sách hoặc tạo phòng trước!");
      return;
    }

    setLoadingEquipments(true);
    try {
      const res = await roomApi.getDefaultEquipmentsByCategory(categoryId);
      if (res.success && res.default_equipments && res.default_equipments.length > 0) {
        setDefaultEquipments(res.default_equipments);
        setNewRoomId(targetRoomId);
        setShowInstallPreview(true);
      } else {
        alert("Loại phòng này không có thiết bị mặc định nào. Không thể tạo phiếu lắp đặt tự động.");
      }
    } catch (error) {
      alert("Lỗi khi lấy danh sách thiết bị mặc định: " + (error.response?.data?.message || error.message));
    } finally {
      setLoadingEquipments(false);
    }
  };

  const handleCreateInstallTicket = async () => {
    if (!newRoomId) {
      alert("Không tìm thấy thông tin phòng!");
      return;
    }

    if (defaultEquipments.length === 0) {
      alert("Không có thiết bị nào để lắp đặt!");
      return;
    }

    try {
      // Tạo install_date xa xa (30 ngày sau) hoặc null
      const installDate = new Date();
      installDate.setDate(installDate.getDate() + 30);
      installDate.setHours(0, 0, 0, 0);

      const items = defaultEquipments.map(de => ({
        category_id: de.equipment_category_id._id || de.equipment_category_id,
        quantity: de.quantity
      }));

      const payload = {
        room_id: newRoomId,
        install_date: installDate.toISOString(),
        items: items,
        type: 'install'
      };

      await equipmentApi.createInstallTicket(payload);
      alert("Tạo phiếu lắp đặt tự động thành công!");
      setShowInstallPreview(false);
      setDefaultEquipments([]);
      setNewRoomId(null);
      setFormData({
        room_number: "", category_id: "", room_status: "new", start_time: "", end_time: "",
      });
      setSuggestedRoomNumber("");
      fetchData();
    } catch (error) {
      alert("Lỗi khi tạo phiếu lắp đặt: " + (error.response?.data?.message || error.message));
    }
  };

  // Helper function để lấy prefix cho category
  const getCategoryPrefix = (categoryName) => {
    // Mapping cố định cho các loại phòng đã có
    const categoryPrefixMap = {
      "phòng tiêu chuẩn": 1,
      "phòng deluxe": 2,
      "phòng gia đình": 3,
      "phòng tổng thống": 4,
      "phòng truyền thống": 5,
      // Thêm các biến thể tên có thể có
      "tiêu chuẩn": 1,
      "deluxe": 2,
      "gia đình": 3,
      "tổng thống": 4,
      "truyền thống": 5,
    };

    const categoryNameLower = (categoryName || "").toLowerCase().trim();
    
    if (categoryPrefixMap[categoryNameLower]) {
      // Nếu có trong mapping cố định, dùng số đó
      return categoryPrefixMap[categoryNameLower];
    } else {
      // Nếu không có trong mapping, tìm đầu số lớn nhất đã được sử dụng
      // Lấy tất cả phòng và tìm đầu số lớn nhất
      let maxPrefix = 5; // Bắt đầu từ 6 cho loại phòng mới
      
      rooms.forEach(room => {
        const roomNumStr = room.room_number?.toString().trim() || "";
        if (roomNumStr) {
          const firstDigit = parseInt(roomNumStr.charAt(0));
          if (!isNaN(firstDigit) && firstDigit > maxPrefix) {
            maxPrefix = firstDigit;
          }
        }
      });
      
      // Prefix cho loại phòng mới = maxPrefix + 1
      return maxPrefix + 1;
    }
  };

  // Hàm gợi ý số phòng dựa trên category
  const suggestRoomNumber = (categoryId) => {
    if (!categoryId || !categories.length) {
      setSuggestedRoomNumber("");
      return;
    }

    // Tìm category trong danh sách
    const category = categories.find(cat => cat._id === categoryId);
    if (!category) {
      setSuggestedRoomNumber("");
      return;
    }

    // Xác định prefix cho category này
    const prefix = getCategoryPrefix(category.category_name);
    const prefixStr = prefix.toString();

    // Lấy tất cả phòng của category này
    const roomsInCategory = rooms.filter(room => {
      const roomCategoryId = room.category_id?._id || room.category_id;
      return roomCategoryId === categoryId;
    });

    // Đếm số phòng trong category
    const roomCount = roomsInCategory.length;

    // Tìm số phòng lớn nhất trong category này (bắt đầu bằng prefix)
    let maxRoomNumber = 0;
    roomsInCategory.forEach(room => {
      const roomNumStr = room.room_number?.toString().trim() || "";
      if (roomNumStr && roomNumStr.startsWith(prefixStr)) {
        // Lấy phần sau prefix (ví dụ: "401" -> "01", "402" -> "02", "410" -> "10")
        const suffixStr = roomNumStr.substring(prefixStr.length);
        if (suffixStr) {
          const suffix = parseInt(suffixStr);
          if (!isNaN(suffix)) {
            // Tính số phòng đầy đủ (prefix + suffix)
            const fullRoomNumber = parseInt(roomNumStr);
            if (!isNaN(fullRoomNumber) && fullRoomNumber > maxRoomNumber) {
              maxRoomNumber = fullRoomNumber;
            }
          }
        }
      }
    });

    // Gợi ý số phòng tiếp theo
    // Nếu có phòng trong category, gợi ý số tiếp theo sau số lớn nhất
    // Nếu không có phòng nào, bắt đầu từ prefix + 01
    let suggestedNumber;
    if (maxRoomNumber > 0) {
      // Tăng dần từng đơn vị từ số phòng lớn nhất
      suggestedNumber = (maxRoomNumber + 1).toString();
    } else {
      // Chưa có phòng nào, bắt đầu từ prefix + 01
      suggestedNumber = `${prefix}01`;
    }

    setSuggestedRoomNumber(suggestedNumber);
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
      // Không gợi ý số phòng khi đang edit
      setSuggestedRoomNumber("");

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
        <div className="flex items-center gap-3">
          {/* Buttons Sort */}
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-1 border border-gray-200">
            <button
              onClick={() => handleSort("status")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition ${
                sortBy === "status"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              title="Sắp xếp theo trạng thái"
            >
              <FiFilter size={14} />
              Trạng thái
              {sortBy === "status" && (
                sortOrder === "asc" ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />
              )}
            </button>
            <button
              onClick={() => handleSort("category")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition ${
                sortBy === "category"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
              title="Sắp xếp theo loại phòng"
            >
              <FiFilter size={14} />
              Loại phòng
              {sortBy === "category" && (
                sortOrder === "asc" ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />
              )}
            </button>
            {sortBy && (
              <button
                onClick={handleResetSort}
                className="px-3 py-1.5 rounded text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
                title="Bỏ sắp xếp"
              >
                <FiX size={14} />
              </button>
            )}
          </div>
          <button
              onClick={() => {
                setEditingItem(null);
                setIsModalOpen(true);
                const firstCatId = categories.length > 0 ? categories[0]._id : "";
                setFormData({ room_number: "", category_id: firstCatId, room_status: "new", start_time: "", end_time: "" });
                // Gợi ý số phòng cho category đầu tiên
                if (firstCatId) {
                  setTimeout(() => suggestRoomNumber(firstCatId), 100);
                }
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
          >
            <FiPlus /> Thêm phòng mới
          </button>
        </div>
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
                const displayStatus = room.roomStatusLog?.status || room.room_status || "new";
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
                      <div className="flex items-center justify-end gap-2">
                        {room.room_status === "new" && (
                          <button 
                            onClick={() => {
                              if (room.category_id?._id || room.category_id) {
                                const categoryId = room.category_id._id || room.category_id;
                                setEditingItem(room);
                                handlePreviewInstallTicket(categoryId, room._id);
                              } else {
                                alert("Phòng này chưa có loại phòng. Vui lòng cập nhật loại phòng trước!");
                              }
                            }}
                            className="text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1 rounded text-xs font-medium flex items-center gap-1"
                            title="Tạo phiếu lắp đặt tự động"
                          >
                            <FiSettings size={14}/>
                            Tạo phiếu lắp đặt
                          </button>
                        )}
                        <button onClick={() => openEdit(room)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-xs font-medium">Cập nhật</button>
                        <button onClick={() => handleDelete(room._id, room.room_status)} className="text-gray-400 hover:text-red-500"><FiTrash2 size={16}/></button>
                      </div>
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
                    <label className="block text-sm font-medium text-gray-700 mb-1">Loại phòng</label>
                    <select required className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                        value={formData.category_id} 
                        onChange={e => {
                          const newCategoryId = e.target.value;
                          setFormData({...formData, category_id: newCategoryId});
                          // Gợi ý số phòng khi chọn category
                          if (!editingItem) {
                            suggestRoomNumber(newCategoryId);
                            // Tự động điền số phòng được gợi ý
                            if (newCategoryId) {
                              setTimeout(() => {
                                suggestRoomNumber(newCategoryId);
                              }, 100);
                            }
                          }
                        }}>
                        <option value="">-- Chọn loại phòng --</option>
                        {categories.map((cat) => {
                          const prefixDisplay = getCategoryPrefix(cat.category_name);
                          return (
                            <option key={cat._id} value={cat._id}>
                              {cat.category_name} {!editingItem && `(Đầu số: ${prefixDisplay})`}
                            </option>
                          );
                        })}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Số phòng
                      {suggestedRoomNumber && !editingItem && (
                        <span className="ml-2 text-xs text-indigo-600 font-normal">
                          (Gợi ý: {suggestedRoomNumber})
                        </span>
                      )}
                    </label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        required 
                        className="flex-1 border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={formData.room_number} 
                        onChange={e => setFormData({...formData, room_number: e.target.value})} 
                        placeholder={suggestedRoomNumber && !editingItem ? suggestedRoomNumber : "Nhập số phòng"}
                      />
                      {suggestedRoomNumber && !editingItem && (
                        <button
                          type="button"
                          onClick={() => setFormData({...formData, room_number: suggestedRoomNumber})}
                          className="px-4 py-2.5 bg-indigo-100 text-indigo-700 rounded-lg font-medium hover:bg-indigo-200 transition text-sm whitespace-nowrap"
                          title="Sử dụng số phòng được gợi ý"
                        >
                          Dùng gợi ý
                        </button>
                      )}
                    </div>
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

                {formData.category_id && editingItem && editingItem._id && editingItem.room_status === "new" && (
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <button
                      type="button"
                      onClick={() => handlePreviewInstallTicket(formData.category_id, editingItem._id)}
                      disabled={loadingEquipments || !formData.category_id}
                      className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2 rounded-lg font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiSettings size={18}/>
                      {loadingEquipments ? "Đang tải..." : "Tự động tạo phiếu lắp đặt"}
                    </button>
                    <p className="text-xs text-blue-700 mt-2 text-center">
                      Tạo phiếu lắp đặt các thiết bị mặc định cho phòng mới tạo
                    </p>
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

      {/* Preview Modal cho phiếu lắp đặt tự động */}
      {showInstallPreview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl animate-fade-in max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-100 bg-indigo-50 rounded-t-xl">
              <h3 className="font-bold text-lg text-indigo-800 flex items-center gap-2">
                <FiSettings size={20}/> Xem trước phiếu lắp đặt tự động
              </h3>
              <button 
                onClick={() => {
                  setShowInstallPreview(false);
                  setDefaultEquipments([]);
                  if (newRoomId) {
                    setNewRoomId(null);
                    fetchData();
                  }
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={24}/>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Hệ thống sẽ tự động tạo phiếu lắp đặt với các thiết bị mặc định sau:
                </p>
                <p className="text-xs text-gray-500 italic">
                  Ngày lắp đặt: {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN')} (7 ngày sau)
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 border-b border-gray-200">
                    <tr>
                      <th className="py-3 px-4 text-left font-bold text-gray-700">Thiết bị</th>
                      <th className="py-3 px-4 text-center font-bold text-gray-700">Số lượng</th>
                      <th className="py-3 px-4 text-right font-bold text-gray-700">Đơn vị</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {defaultEquipments.map((de, index) => {
                      const eqCategory = de.equipment_category_id;
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="py-3 px-4 font-medium text-gray-800">
                            {eqCategory?.name || "N/A"}
                          </td>
                          <td className="py-3 px-4 text-center font-bold text-indigo-600">
                            {de.quantity}
                          </td>
                          <td className="py-3 px-4 text-right text-gray-600">
                            {renderUnit(eqCategory?.unit) || "N/A"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {defaultEquipments.length === 0 && (
                <div className="text-center py-8 text-gray-400">
                  Không có thiết bị mặc định nào
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex gap-3 bg-gray-50 rounded-b-xl">
              <button
                onClick={() => {
                  setShowInstallPreview(false);
                  setDefaultEquipments([]);
                  if (newRoomId) {
                    setNewRoomId(null);
                    fetchData();
                  }
                }}
                className="flex-1 py-2.5 rounded-lg border border-gray-300 font-bold text-gray-600 hover:bg-white transition"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateInstallTicket}
                className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
              >
                <FiCheckCircle size={18}/>
                Xác nhận tạo phiếu
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}