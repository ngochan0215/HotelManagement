import React, { useState, useEffect, useMemo } from "react";
import { FiEdit, FiTrash2, FiPlus, FiX, FiSearch, FiList, FiChevronDown, FiFilter } from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi.js";
import ConfirmModal from "../../../components/confirmModal.jsx";
import { RankBadge } from "../../../components/ui/label.jsx";

export default function EquipmentCategoryTab() {
  const [categories, setCategories] = useState([]);
  const [allEquipments, setAllEquipments] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("a-z");
  const [filterUnit, setFilterUnit] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", unit: "item", price: "" });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });

  const UNIT_MAP = { item: "Cái", box: "Bộ" };
  const formatUnit = (unit) => UNIT_MAP[unit] || unit || "Cái";

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

  const filteredCategories = useMemo(() => {
    let result = [...categories];
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(c => c.name.toLowerCase().includes(lower));
    }
    if (filterUnit !== 'all') {
        result = result.filter(c => c.unit === filterUnit);
    }
    result.sort((a, b) => {
        if (sortOrder === 'a-z') return a.name.localeCompare(b.name);
        if (sortOrder === 'z-a') return b.name.localeCompare(a.name);
        if (sortOrder === 'most-total') return (b.total_count || 0) - (a.total_count || 0);
        if (sortOrder === 'least-total') return (a.total_count || 0) - (b.total_count || 0);
        return 0;
    });

    return result;
  }, [categories, searchTerm, filterUnit, sortOrder]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = { ...formData };

      if (editingItem) {
        await equipmentApi.updateCategory(editingItem._id, payload);
      } else {
        await equipmentApi.createCategory(payload);
      }

      setIsModalOpen(false);
      setEditingItem(null);
      setFormData({ name: "", description: "", unit: "item", price: "" });
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
        alert("Xóa danh mục thành công!");
      } catch (error) {
        alert("Không thể xóa danh mục này (có thể đang có thiết bị sử dụng).");
      }
    };

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <button
            onClick={() => { setEditingItem(null); setFormData({ name: "", description: "", unit: "item", price: "" }); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-indigo-200 shadow-lg"
        >
          <FiPlus /> Tạo danh mục
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 justify-between mb-6">
          <div className="relative w-full lg:w-96">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
              <input
                  type="text"
                  placeholder="Tìm tên danh mục..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
              />
          </div>

          <div className="flex gap-3 overflow-x-auto pb-1">
              <div className="relative min-w-[150px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiFilter className="text-gray-500" size={16} />
                  </div>
                  <select
                      className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 cursor-pointer hover:border-indigo-300 transition"
                      value={filterUnit}
                      onChange={e => setFilterUnit(e.target.value)}
                  >
                      <option value="all">Tất cả Đơn vị</option>
                      <option value="item">Cái</option>
                      <option value="box">Bộ</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <FiChevronDown className="text-gray-400" size={16} />
                  </div>
              </div>

              <div className="relative min-w-[180px]">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FiList className="text-gray-500" size={16} />
                  </div>
                  <select
                      className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 cursor-pointer hover:border-indigo-300 transition"
                      value={sortOrder}
                      onChange={e => setSortOrder(e.target.value)}
                  >
                      <option value="a-z">Tên: A - Z</option>
                      <option value="z-a">Tên: Z - A</option>
                      <option value="most-total">Số lượng: Nhiều nhất</option>
                      <option value="least-total">Số lượng: Ít nhất</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      <FiChevronDown className="text-gray-400" size={16} />
                  </div>
              </div>
          </div>
      </div>

      <div className="overflow-x-auto min-h-[400px]">
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
            {filteredCategories.length > 0 ? (
              filteredCategories.map((item) => (
                <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                  <td className="py-4 pl-4 font-bold text-indigo-900">{item.name}</td>
                  <td className="py-4 text-center">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                        {formatUnit(item.unit) || "Cái"}
                      </span>
                  </td>

                  <td className="py-4 text-center font-bold">{item.total_count || 0}</td>
                  <td className="py-4 text-center font-bold text-emerald-600">{item.in_stock_count || 0}</td>
                  <td className="py-4 text-center font-bold text-indigo-600">{item.in_use_count || 0}</td>
                  <td className="py-4 text-center font-bold text-red-500">{item.broken_count || 0}</td>

                  <td className="py-4 text-right pr-4">
                    <button onClick={() => { setEditingItem(item); setFormData({name: item.name, description: item.description, unit: item.unit, price: item.price }); setIsModalOpen(true); }}
                      className="text-indigo-600 hover:text-indigo-800 mr-3"><FiEdit size={18}/></button>
                    <button onClick={() => setConfirmDelete({ open: true, id: item._id })} className="text-gray-400 hover:text-red-500"><FiTrash2 size={18}/></button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="8" className="text-center py-12 text-gray-400">
                    <div className="flex flex-col items-center gap-2">
                        <FiSearch size={24} className="opacity-50"/>
                        <span>Không tìm thấy danh mục nào.</span>
                    </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[400px]">
            <div className="flex justify-between mb-4">
                <h3 className="font-bold text-lg">{editingItem ? "Sửa danh mục" : "Thêm danh mục"}</h3>
                <button onClick={() => setIsModalOpen(false)}><FiX size={24}/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div><label className="block text-sm font-medium mb-1">Tên</label><input type="text" required className="w-full border rounded-lg p-2.5 outline-none focus:border-indigo-500" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} /></div>
                <div>
                  <label className="block text-sm font-medium mb-1">Đơn vị</label>
                  <select
                    className="w-full border rounded-lg p-2.5 bg-white outline-none focus:border-indigo-500"
                    value={formData.unit}
                    onChange={e => setFormData({ ...formData, unit: e.target.value })}
                  >
                    <option value="item">Cái</option>
                    <option value="box">Bộ</option>
                  </select>
                </div>
                <div><label className="block text-sm font-medium mb-1">Giá trị (VNĐ)</label><input type="number" required className="w-full border rounded-lg p-2.5 outline-none focus:border-indigo-500" value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Mô tả</label><textarea className="w-full border rounded-lg p-2.5 h-24 outline-none focus:border-indigo-500" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700">Lưu</button>
            </form>
          </div>
        </div>
      )}
      {confirmDelete.open && (<ConfirmModal open={confirmDelete.open} title="Xóa danh mục" message="Bạn chắc chắn muốn xóa?" confirmText="Xóa" cancelText="Hủy" onConfirm={handleDelete} onCancel={() => setConfirmDelete({ open: false })} />)}
    </div>
  );
}