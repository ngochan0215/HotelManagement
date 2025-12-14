import React, { useState, useEffect } from "react";
import { FiEdit, FiTrash2, FiPlus, FiX } from "react-icons/fi";
import { roomApi } from "../../api/roomApi";
import { equipmentApi } from "../../api/equipmentApi";
import ConfirmModal from "../../../components/confirmModal";

export default function RoomCategoryTab() {
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [formData, setFormData] = useState({
    category_name: "", description: "", price: 0, max_adults: 1, max_children: 0, images: []
  });

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipments, setSelectedEquipments] = useState([]);

  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    categoryId: null,
    message: ""
  });

  useEffect(() => {
    loadCategories();
    loadEquipmentCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const data = await roomApi.getAllCategories();
      setCategories(data);
    } catch (error) {
      console.error("Lỗi tải loại phòng:", error);
    }
  };

  const loadEquipmentCategories = async () => {
    const data = await equipmentApi.getAllCategories();
    setEquipmentList(data);
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
      data.append("default_equipments", JSON.stringify(selectedEquipments));

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

  // xóa lần đầu (không gọi force)
  const handleDelete = async (id) => {
    try {
      if (window.confirm("Bạn có chắc muốn xóa loại phòng này?")) {
        await roomApi.deleteCategory(id);
        alert("Đã xóa loại phòng thành công.");
        loadCategories();
      }
    } catch (error) {
      if (error.response?.status === 409 || error.response?.data?.code === "CATEGORY_HAS_ROOMS") {
        setConfirmDelete({
          open: true,
          categoryId: id,
          message: error.response.data.message
        });
      } else {
        alert(error.response?.data?.message || "Xóa thất bại");
      }
    }
};

  // xóa sau khi có force
  const handleForceDelete = async (id) => {
    try {
      await roomApi.forceDeleteCategory(id);
      alert("Đã xóa loại phòng và toàn bộ phòng liên quan");
      setConfirmDelete({ open: false, categoryId: null, message: "" });
      loadCategories();
    } catch (error) {
      alert(error.response?.data?.message || "Xóa thất bại");
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

    setSelectedEquipments(
      item.default_equipments?.map(eq => ({
        equipment_category_id: eq.equipment_category_id._id,
        quantity: eq.quantity
      })) || []
    );

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
              <th className="py-3 font-semibold">Thiết bị mặc định</th>
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
                <td className="py-4">
                <button
                  onClick={() => {
                    setSelectedCategory(item);
                    setIsDetailOpen(true);
                  }}
                  className="text-indigo-600 hover:underline text-sm font-medium"
                >
                  Xem chi tiết
                </button>
              </td>

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
                        <input type="number" required min={1} step={1} className="w-full border rounded-lg p-2 mt-1"
                            value={formData.price} onChange={e => setFormData({...formData, price: e.target.value})} />
                    </div>
                     <div>
                        <label className="text-sm font-medium text-gray-700">Người lớn tối đa</label>
                        <input type="number" required min={1} step={1} className="w-full border rounded-lg p-2 mt-1"
                            value={formData.max_adults} onChange={e => setFormData({...formData, max_adults: e.target.value})} />
                    </div>
                </div>
                <div>
                     <label className="text-sm font-medium text-gray-700">Trẻ em tối đa</label>
                        <input type="number" required min={0} step={1} className="w-full border rounded-lg p-2 mt-1"
                            value={formData.max_children} onChange={e => setFormData({...formData, max_children: e.target.value})} />
                </div>
                <div>
                    <label className="text-sm font-medium text-gray-700">Mô tả</label>
                    <textarea required className="w-full border rounded-lg p-2 mt-1 h-24"
                        value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Thiết bị mặc định</label>
                  <div className="mt-2 space-y-2 max-h-48 overflow-y-auto border rounded-lg p-3">
                    {equipmentList.map(eq => {
                      const selected = selectedEquipments.find(
                        i => i.equipment_category_id === eq._id
                      );
                      console.log("equipmentList:", equipmentList);

                      return (
                        <div key={eq._id} className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={!!selected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedEquipments(prev => [
                                  ...prev,
                                  { equipment_category_id: eq._id, quantity: 1 }
                                ]);
                              } else {
                                setSelectedEquipments(prev =>
                                  prev.filter(i => i.equipment_category_id !== eq._id)
                                );
                              }
                            }}
                          />

                          <span className="flex-1 text-gray-700">
                            {eq.name}
                          </span>

                          {selected && (
                            <input
                              type="number"
                              min={1}
                              className="w-20 border rounded-lg p-1"
                              value={selected.quantity}
                              onChange={(e) => {
                                const qty = Number(e.target.value);
                                setSelectedEquipments(prev =>
                                  prev.map(i =>
                                    i.equipment_category_id === eq._id
                                      ? { ...i, quantity: qty }
                                      : i
                                  )
                                );
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
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

      {isDetailOpen && selectedCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[450px] max-h-[80vh] overflow-y-auto p-6">
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">
                Thiết bị mặc định – {selectedCategory.category_name}
              </h3>
              <button onClick={() => setIsDetailOpen(false)}>
                <FiX size={22} />
              </button>
            </div>

            {selectedCategory.default_equipments?.length > 0 ? (
              <ul className="space-y-3">
                {selectedCategory.default_equipments.map(eq => (
                  <li
                    key={eq._id}
                    className="flex justify-between items-center bg-gray-50 p-3 rounded-lg"
                  >
                    <span className="font-medium text-gray-700">
                      {eq.equipment_category_id?.name}
                    </span>
                    <span className="text-indigo-600 font-bold">
                      × {eq.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="italic text-gray-400">
                Không có thiết bị mặc định
              </p>
            )}
          </div>
        </div>
      )}

      {confirmDelete.open && (
        <ConfirmModal
          open={confirmDelete.open}
          title="Xóa loại phòng"
          message={confirmDelete.message}
          confirmText="Xóa tất cả"
          cancelText="Hủy"
          onConfirm={() => handleForceDelete(confirmDelete.categoryId)}
          onCancel={() => setConfirmDelete({ open: false })}
        />
      )}

    </div>
  );
}