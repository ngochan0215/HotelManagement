import React, { useState, useEffect } from "react";
import { FiEdit, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import { roomApi } from "../api/roomApi";

export default function RoomCategoryTab() {
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    category_name: "", description: "", price: 0, max_adults: 1, max_children: 0, images: []
  });

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await roomApi.getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error("Lỗi tải loại phòng:", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = new FormData();
      data.append("category_name", formData.category_name);
      data.append("description", formData.description);
      data.append("price", formData.price);
      data.append("max_adults", formData.max_adults);
      data.append("max_children", formData.max_children);

      if (formData.images && formData.images.length > 0) {
        for (let i = 0; i < formData.images.length; i++) {
            data.append("images", formData.images[i]);
        }
      }

      if (editingItem) {
        await roomApi.updateCategory(editingItem._id, data);
      } else {
        await roomApi.createCategory(data);
      }

      setIsModalOpen(false);
      resetForm();
      loadCategories();
      alert("Lưu thành công!");
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Bạn có chắc muốn xóa loại phòng này?")) {
      try {
        await roomApi.deleteCategory(id);
        loadCategories();
      } catch (error) {
        alert("Không thể xóa: " + error.message);
      }
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setFormData({ category_name: "", description: "", price: 0, max_adults: 1, max_children: 0, images: [] });
  };

  const openEdit = (item) => {
    setEditingItem(item);
    setFormData({
      category_name: item.category_name,
      description: item.description,
      price: item.price,
      max_adults: item.max_adults,
      max_children: item.max_children,
      images: []
    });
    setIsModalOpen(true);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-800">Danh sách Loại phòng</h2>
        <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          <FiPlus /> Thêm loại mới
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 text-sm border-b border-gray-100">
              <th className="py-3 font-semibold">Tên loại</th>
              <th className="py-3 font-semibold">Giá (VNĐ)</th>
              <th className="py-3 font-semibold">Sức chứa</th>
              <th className="py-3 font-semibold">Mô tả</th>
              <th className="py-3 font-semibold text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {categories.map((item) => (
              <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="py-4 font-semibold text-indigo-900">{item.category_name}</td>
                <td className="py-4 font-bold text-indigo-600">{item.price?.toLocaleString()}</td>
                <td className="py-4">{item.max_adults} Lớn, {item.max_children} Trẻ</td>
                <td className="py-4 text-gray-500 truncate max-w-xs">{item.description}</td>
                <td className="py-4 text-right">
                  <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-indigo-600 mr-3"><FiEdit size={18} /></button>
                  <button onClick={() => handleDelete(item._id)} className="text-gray-400 hover:text-red-500"><FiTrash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[500px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4">
                <h3 className="font-bold text-lg">{editingItem ? "Sửa loại phòng" : "Thêm loại phòng"}</h3>
                <button onClick={() => setIsModalOpen(false)}><FiX size={24}/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="text-sm font-medium text-gray-700">Tên loại phòng</label>
                    <input type="text" required className="w-full border rounded-lg p-2 mt-1"
                        value={formData.category_name} onChange={e => setFormData({...formData, category_name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-sm font-medium text-gray-700">Giá (VNĐ)</label>
                        <input type="number" required className="w-full border rounded-lg p-2 mt-1"
                            value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700">Người lớn tối đa</label>
                        <input type="number" required className="w-full border rounded-lg p-2 mt-1"
                            value={formData.max_adults} onChange={e => setFormData({...formData, max_adults: e.target.value})} />
                    </div>
                </div>
                <div>
                     <label className="text-sm font-medium text-gray-700">Trẻ em tối đa</label>
                        <input type="number" required className="w-full border rounded-lg p-2 mt-1"
                            value={formData.max_children} onChange={e => setFormData({...formData, max_children: e.target.value})} />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Mô tả</label>
                    <textarea required className="w-full border rounded-lg p-2 mt-1 h-24"
                        value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Hình ảnh</label>
                    <input type="file" multiple accept="image/*" className="w-full mt-1 text-sm text-gray-500"
                        onChange={e => setFormData({...formData, images: e.target.files})} />
                </div>
                <button type="submit" className="w-full bg-indigo-600 text-white py-2 rounded-lg font-bold hover:bg-indigo-700">
                    {editingItem ? "Cập nhật" : "Tạo mới"}
                </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}