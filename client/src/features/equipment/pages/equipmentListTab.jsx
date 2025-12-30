import React, { useState, useEffect } from "react";
import { FiEdit, FiTrash2, FiX, FiSearch } from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi";
import ConfirmModal from "../../../components/confirmModal";
import { StatusPill } from "../../../components/ui/label";

const CONDITION_MAP = {
  new: { label: "Mới 100%", color: "emerald" },
  good: { label: "Tốt", color: "blue" },
  maintenance: { label: "Bảo trì", color: "yellow" },
  broken: { label: "Hỏng", color: "red" }
};

const STATUS_MAP = {
  "in-stock": { label: "Trong kho", color: "gray", icon: "info" },
  "installing": { label: "Đang lắp", color: "blue", icon: "wait" },
  "in-use": { label: "Đang dùng", color: "indigo", icon: "success" },
  "maintenance": { label: "Bảo trì", color: "yellow", icon: "warning" },
  "lost": { label: "Thất lạc", color: "red", icon: "error" },
  "disposed": { label: "Đã hủy", color: "red", icon: "error" }
};

export default function EquipmentListTab() {
  const [equipments, setEquipments] = useState([]);
  const [editingItem, setEditingItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ condition: "", status: "", note: "" });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await equipmentApi.getAllEquipments();
      setEquipments((res && Array.isArray(res.equipments)) ? res.equipments : []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      await equipmentApi.updateEquipment(editingItem._id, formData);
      setIsModalOpen(false);
      loadData();
      alert("Cập nhật thành công!");
    } catch (error) {
      alert("Lỗi: " + error.message);
    }
  };

  const handleDelete = async () => {
    try {
      await equipmentApi.deleteEquipment(confirmDelete.id);
      loadData();
      setConfirmDelete({ open: false });
    } catch (error) {
      alert("Lỗi xóa: " + error.message);
    }
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({ condition: item.condition, status: item.status, note: item.note || "" });
    setIsModalOpen(true);
  };

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-lg font-bold text-gray-800">Kho Thiết bị Chi tiết</h2>
            <p className="text-xs text-gray-500 italic">*Thiết bị mới được thêm thông qua Phiếu Nhập.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 bg-gray-50/50">
              <th className="py-3 pl-4">Mã TB</th>
              <th className="py-3">Tên thiết bị</th>
              <th className="py-3">Vị trí</th>
              <th className="py-3">Tình trạng</th>
              <th className="py-3">Trạng thái</th>
              <th className="py-3">Ghi chú</th>
              <th className="py-3 text-right pr-4">Hành động</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {equipments.length === 0 ?
                <tr><td colSpan="7" className="text-center py-8 text-gray-400">Kho trống</td></tr> :
                equipments.map((item) => {
                    const cond = CONDITION_MAP[item.condition] || CONDITION_MAP.good;
                    const st = STATUS_MAP[item.status] || STATUS_MAP["in-stock"];
                    const displayId = item.code ? item.code : item._id.slice(-6).toUpperCase();

                    return (
                    <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="py-4 pl-4 font-mono font-bold text-gray-500 text-xs">
                            #{displayId}
                        </td>

                        <td className="py-4 font-medium text-gray-900">
                            {item.category_id?.name || "---"}
                        </td>
                        <td className="py-4 text-gray-600">
                            {item.room_id ? (
                                <span className="flex items-center gap-1 font-bold text-indigo-600">
                                    P.{item.room_id.room_number}
                                </span>
                            ) : (
                                <span className="text-gray-400 italic">Kho</span>
                            )}
                        </td>
                        <td className="py-4"><StatusPill label={cond.label} color={cond.color} /></td>
                        <td className="py-4"><StatusPill label={st.label} color={st.color} iconType={st.icon} /></td>
                        <td className="py-4 text-gray-500 truncate max-w-xs text-xs">{item.note}</td>
                        <td className="py-4 text-right pr-4">
                            <button onClick={() => openEdit(item)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-xs mr-2 font-medium">Sửa</button>
                            <button onClick={() => setConfirmDelete({ open: true, id: item._id })} className="text-gray-400 hover:text-red-500"><FiTrash2 size={16}/></button>
                        </td>
                    </tr>
                    );
                })
            }
          </tbody>
        </table>
      </div>
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px]">
            <div className="flex justify-between mb-4">
                <h3 className="font-bold text-lg">Cập nhật trạng thái</h3>
                <button onClick={() => setIsModalOpen(false)}><FiX size={24}/></button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium mb-1">Tình trạng vật lý</label>
                    <select className="w-full border rounded-lg p-2.5 bg-white outline-none focus:border-indigo-500" value={formData.condition} onChange={e => setFormData({...formData, condition: e.target.value})}>
                        {Object.keys(CONDITION_MAP).map(k => <option key={k} value={k}>{CONDITION_MAP[k].label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Trạng thái lưu trú</label>
                    <select className="w-full border rounded-lg p-2.5 bg-white outline-none focus:border-indigo-500" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                        {Object.keys(STATUS_MAP).map(k => <option key={k} value={k}>{STATUS_MAP[k].label}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-sm font-medium mb-1">Ghi chú</label>
                    <textarea className="w-full border rounded-lg p-2.5 outline-none focus:border-indigo-500" value={formData.note} onChange={e => setFormData({...formData, note: e.target.value})} />
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700">Lưu thay đổi</button>
            </form>
          </div>
        </div>
      )}

      {confirmDelete.open && (<ConfirmModal open={confirmDelete.open} title="Xóa thiết bị" message="Xác nhận xóa thiết bị này khỏi hệ thống?" confirmText="Xóa" cancelText="Hủy" onConfirm={handleDelete} onCancel={() => setConfirmDelete({ open: false })} />)}
    </div>
  );
}