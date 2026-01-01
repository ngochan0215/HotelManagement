import React, { useEffect, useState } from "react";
import { equipmentApi } from "../../api/equipmentApi";
import axios from "axios";
import { FiX, FiPlus, FiTrash2, FiCheckSquare, FiMapPin, FiCalendar } from "react-icons/fi";

export default function AddInstallTicketModal({ onClose, onSuccess }) {
  const [rooms, setRooms] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    room_id: "",
    install_date: new Date().toISOString().split("T")[0],
    items: [{ category_id: "", quantity: 1 }]
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catRes, roomRes] = await Promise.all([
            equipmentApi.getAllCategories(),
            axios.get("http://localhost:3000/room/all", {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            })
        ]);
        setCategories(catRes.categories || []);
        setRooms(roomRes.data?.rooms || roomRes.data || []);
      } catch (error) {
        console.error("Lỗi tải dữ liệu:", error);
      }
    };
    loadData();
  }, []);

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index][field] = value;
    setFormData({ ...formData, items: newItems });
  };

  const addItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { category_id: "", quantity: 1 }]
    });
  };

  const removeItem = (index) => {
    if (formData.items.length === 1) return;
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData({ ...formData, items: newItems });
  };

  const getStock = (catId) => {
    const cat = categories.find(c => c._id === catId);
    return cat ? cat.storage_quantity : 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
        if (!formData.room_id) { alert("Chưa chọn phòng!"); setLoading(false); return; }
        for (let item of formData.items) {
            if (!item.category_id) { alert("Vui lòng chọn thiết bị!"); setLoading(false); return; }
            const stock = getStock(item.category_id);
            if (Number(item.quantity) > stock) {
                alert(`Lỗi: Thiết bị "${categories.find(c => c._id === item.category_id)?.name}" chỉ còn tồn ${stock}, bạn nhập ${item.quantity}.`);
                setLoading(false);
                return;
            }
        }

        const payload = {
            ...formData,
            items: formData.items.map(i => ({ ...i, quantity: Number(i.quantity) }))
        };

        await equipmentApi.createInstallTicket(payload);
        onSuccess();
        onClose();
    } catch (err) {
        alert("Lỗi server: " + (err.response?.data?.message || err.message));
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in p-4">
      <div className="bg-white rounded-xl w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-orange-50 rounded-t-xl">
            <div>
                <h2 className="text-xl font-bold text-gray-800">Tạo Phiếu Lắp Đặt</h2>
                <p className="text-sm text-gray-500">Điều chuyển thiết bị từ kho vào phòng</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><FiX size={20}/></button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
            <form id="install-form" onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border">
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                            <FiMapPin className="text-orange-500"/> Chọn Phòng Lắp Đặt
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                            value={formData.room_id}
                            onChange={(e) => setFormData({...formData, room_id: e.target.value})}
                            required
                        >
                            <option value="">-- Chọn phòng --</option>
                            {rooms.map(r => (
                                <option key={r._id} value={r._id}>Phòng {r.room_number} - {r.type || 'Standard'}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1">
                            <FiCalendar className="text-orange-500"/> Ngày Thực Hiện
                        </label>
                        <input
                            type="date"
                            className="w-full border border-gray-300 rounded-lg p-2.5 focus:ring-2 focus:ring-orange-500 outline-none bg-white"
                            value={formData.install_date}
                            onChange={(e) => setFormData({...formData, install_date: e.target.value})}
                            required
                        />
                    </div>
                </div>

                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-sm font-bold text-gray-700">Danh sách thiết bị xuất kho</label>
                        <button type="button" onClick={addItem} className="text-sm text-orange-600 font-semibold hover:bg-orange-50 px-3 py-1 rounded transition-colors flex items-center gap-1">
                            <FiPlus /> Thêm thiết bị
                        </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 font-semibold">
                                <tr>
                                    <th className="px-4 py-3 w-[50%]">Tên thiết bị (Tồn kho)</th>
                                    <th className="px-4 py-3 w-[20%]">Số lượng lắp</th>
                                    <th className="px-4 py-3 w-[20%]">Đơn vị</th>
                                    <th className="px-4 py-3 w-[10%] text-center">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {formData.items.map((item, index) => {
                                    const selectedCat = categories.find(c => c._id === item.category_id);
                                    const stock = selectedCat ? selectedCat.storage_quantity : 0;
                                    const isError = item.category_id && item.quantity > stock;

                                    return (
                                        <tr key={index} className="hover:bg-gray-50">
                                            <td className="px-4 py-2">
                                                <select
                                                    className="w-full border rounded p-2 focus:ring-2 focus:ring-orange-500 outline-none"
                                                    value={item.category_id}
                                                    onChange={(e) => handleItemChange(index, "category_id", e.target.value)}
                                                    required
                                                >
                                                    <option value="">-- Chọn thiết bị --</option>
                                                    {categories.map(c => (
                                                        <option key={c._id} value={c._id} disabled={c.storage_quantity <= 0}>
                                                            {c.name} (Tồn: {c.storage_quantity})
                                                        </option>
                                                    ))}
                                                </select>
                                                {isError && <p className="text-xs text-red-500 mt-1">Vượt quá tồn kho ({stock})</p>}
                                            </td>
                                            <td className="px-4 py-2">
                                                <input
                                                    type="number" min="1" max={stock || 999}
                                                    className={`w-full border rounded p-2 text-center font-bold ${isError ? 'border-red-500 text-red-600' : ''}`}
                                                    value={item.quantity}
                                                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                                                    required
                                                />
                                            </td>
                                            <td className="px-4 py-2 text-gray-500">
                                                {selectedCat?.unit || "-"}
                                            </td>
                                            <td className="px-4 py-2 text-center">
                                                {formData.items.length > 1 && (
                                                    <button type="button" onClick={() => removeItem(index)} className="text-red-400 hover:text-red-600 p-2">
                                                        <FiTrash2 size={16}/>
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </form>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <button onClick={onClose} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Hủy bỏ</button>
            <button
                type="submit" form="install-form" disabled={loading}
                className="px-6 py-2 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2 shadow-lg shadow-orange-200"
            >
                {loading ? "Đang tạo..." : <><FiCheckSquare /> Tạo Phiếu</>}
            </button>
        </div>
      </div>
    </div>
  );
}