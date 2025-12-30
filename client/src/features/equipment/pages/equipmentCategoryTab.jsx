import React, { useState, useEffect } from "react";
import { FiEdit, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi";
import ConfirmModal from "../../../components/confirmModal";
import { RankBadge } from "../../../components/ui/label";

export default function EquipmentCategoryTab() {
  const [categories, setCategories] = useState([]);
  const [allEquipments, setAllEquipments] = useState([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", unit: "cái" });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [catRes, eqRes] = await Promise.all([
        equipmentApi.getAllCategories(),
        equipmentApi.getAllEquipments()
      ]);

      const cats = (catRes && Array.isArray(catRes.categories)) ? catRes.categories : [];
      const eqs = (eqRes && Array.isArray(eqRes.equipments)) ? eqRes.equipments : [];
      const processedCategories = cats.map(cat => {
        if (cat.total_count !== undefined) return cat;
        const items = eqs.filter(e => e.category_id?._id === cat._id || e.category_id === cat._id);

        return {
            ...cat,
            total_count: items.length,
            in_stock_count: items.filter(e => e.status === 'in-stock').length,
            in_use_count: items.filter(e => e.status === 'in-use').length,
            broken_count: items.filter(e => ['maintenance', 'disposed', 'lost'].includes(e.status) || e.condition === 'broken').length
        };
      });

      setCategories(processedCategories);
      setAllEquipments(eqs);

    } catch (error) {
      console.error("Lỗi tải dữ liệu:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingItem) {
        await equipmentApi.updateCategory(editingItem._id, formData);
      } else {
        await equipmentApi.createCategory(formData);
      }
      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: "", description: "", unit: "cái" });
      loadData();
      alert("Thành công!");
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async () => {
    try {
      await equipmentApi.deleteCategory(confirmDelete.id);
      loadData();
      setConfirmDelete({ open: false, id: null });
    } catch (error) {
      alert("Không thể xóa danh mục này (có thể đang có thiết bị sử dụng).");
    }
  };

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <div>
            <h2 className="text-lg font-bold text-gray-800">Danh mục Thiết bị</h2>
            <p className="text-sm text-gray-500">Quản lý các loại tài sản và thống kê tồn kho.</p>
        </div>
        <button
            onClick={() => { setEditingItem(null); setFormData({ name: "", description: "", unit: "cái" }); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          <FiPlus /> Tạo danh mục
        </button>
      </div>

      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 bg-gray-50/50">
            <th className="py-3 pl-4">Tên danh mục</th>
            <th className="py-3 text-center">Đơn vị</th>
            <th className="py-3 text-center text-blue-600">Tổng</th>
            <th className="py-3 text-center text-emerald-600">Trong kho</th>
            <th className="py-3 text-center text-indigo-600">Đang dùng</th>
            <th className="py-3 text-center text-red-600">Sửa chữa</th>
            <th className="py-3 text-right pr-4">Hành động</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 text-sm">
          {categories.length > 0 ? (
            categories.map((item) => (
              <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="py-4 pl-4 font-bold text-indigo-900">{item.name}</td>
                <td className="py-4 text-center">
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{item.unit || "Cái"}</span>
                </td>

                <td className="py-4 text-center font-bold">{item.total_count || 0}</td>
                <td className="py-4 text-center font-bold text-emerald-600">{item.in_stock_count || 0}</td>
                <td className="py-4 text-center font-bold text-indigo-600">{item.in_use_count || 0}</td>
                <td className="py-4 text-center font-bold text-red-500">{item.broken_count || 0}</td>

                <td className="py-4 text-right pr-4">
                  <button onClick={() => { setEditingItem(item); setFormData({name: item.name, description: item.description, unit: item.unit}); setIsModalOpen(true); }}
                    className="text-indigo-600 hover:text-indigo-800 mr-3"><FiEdit size={18}/></button>
                  <button onClick={() => setConfirmDelete({ open: true, id: item._id })} className="text-gray-400 hover:text-red-500"><FiTrash2 size={18}/></button>
                </td>
              </tr>
            ))
          ) : (
            <tr><td colSpan="8" className="text-center py-8 text-gray-400 italic">Chưa có danh mục nào.</td></tr>
          )}
        </tbody>
      </table>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px]">
            <div className="flex justify-between mb-4">
                <h3 className="font-bold text-lg">{editingItem ? "Sửa danh mục" : "Thêm danh mục"}</h3>
                <button onClick={() => setIsModalOpen(false)}><FiX size={24}/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Tên</label><input type="text" required className="w-full border rounded p-2" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Đơn vị</label><input type="text" className="w-full border rounded p-2" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Mô tả</label><textarea className="w-full border rounded p-2 h-20" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded font-bold">Lưu</button>
            </form>
          </div>
        </div>
      )}
      {confirmDelete.open && (<ConfirmModal open={confirmDelete.open} title="Xóa danh mục" message="Bạn chắc chắn muốn xóa?" confirmText="Xóa" cancelText="Hủy" onConfirm={handleDelete} onCancel={() => setConfirmDelete({ open: false })} />)}
    </div>
  );
}