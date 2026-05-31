import React, { useState, useEffect, useRef } from "react";
import {
  FiEdit, FiTrash2, FiPlus, FiX, FiChevronLeft, FiChevronRight,
  FiUpload, FiImage
} from "react-icons/fi";
import { roomApi } from "../../api/roomApi.js";
import { equipmentApi } from "../../api/equipmentApi.js";
import ConfirmModal from "../../../components/confirmModal.jsx";
import Toast from "../../../components/toast.jsx";

export default function RoomCategoryTab() {
  const [categories, setCategories] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [formData, setFormData] = useState({
    category_name: "", description: "", price: 0, max_adults: 1, max_children: 0, images: []
  });

  const [imagePreviews, setImagePreviews] = useState([]);
  const fileInputRef = useRef(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [equipmentList, setEquipmentList] = useState([]);
  const [selectedEquipments, setSelectedEquipments] = useState([]);

  const [toast, setToast] = useState(null);

  const [confirmDelete, setConfirmDelete] = useState({
    open: false,
    categoryId: null,
    message: "",
    isSoftDelete: false
  });

  useEffect(() => {
    loadCategories();
    loadEquipmentCategories();
  }, []);

  useEffect(() => {
    return () => {
      imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [imagePreviews]);

  const loadCategories = async () => {
    try {
      const data = await roomApi.getAllCategories();
      // console.log("Loaded room categories:", data);
      setCategories(data);
    } catch (error) {
      console.error("Lỗi tải loại phòng:", error);
    }
  };

  const loadEquipmentCategories = async () => {
    try {
      const res = await equipmentApi.getAllCategories();
      // console.log("Loaded equipment categories:", res);
      setEquipmentList(res.categories || []);
    } catch (error) {
      console.error("Lỗi tải danh mục thiết bị:", error);
      setEquipmentList([]);
    }
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCategories = categories.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(categories.length / itemsPerPage);

  const handlePageChange = (pageNumber) => setCurrentPage(pageNumber);


  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    // Revoke previous previews
    imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
    const newPreviews = files.map(f => ({ url: URL.createObjectURL(f), file: f }));
    setImagePreviews(newPreviews);
    setFormData(prev => ({ ...prev, images: files }));
  };

  const removeImagePreview = (index) => {
    URL.revokeObjectURL(imagePreviews[index].url);
    const remaining = imagePreviews.filter((_, i) => i !== index);
    setImagePreviews(remaining);
    setFormData(prev => ({ ...prev, images: remaining.map(p => p.file) }));
    // Reset file input so the same files can be re-selected if needed
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        for (const file of formData.images) {
          data.append("images", file);
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
      setToast({ type: "success", message: "Lưu thành công!" });
    } catch (error) {
      // console.log("Lỗi lưu loại phòng:", error);
      setToast({ type: "error", message: "Lỗi: " + (error.response?.data?.message || error.message) });
    }
  };

  const handleDelete = (id) => {
    setConfirmDelete({
      open: true,
      categoryId: id,
      message: "Bạn có chắc muốn xóa loại phòng này?",
      isSoftDelete: true
    });
  };

  const executeSoftDelete = async (id) => {
    setConfirmDelete({ open: false, categoryId: null, message: "", isSoftDelete: false });
    try {
      await roomApi.deleteCategory(id);
      setToast({ type: "success", message: "Đã xóa loại phòng thành công." });
      loadCategories();
    } catch (error) {
      if (error.response?.status === 409 || error.response?.data?.code === "CATEGORY_HAS_ROOMS") {
        setConfirmDelete({
          open: true,
          categoryId: id,
          message: error.response.data.message,
          isSoftDelete: false
        });
      } else {
        setToast({ type: "error", message: error.response?.data?.message || "Xóa thất bại" });
      }
    }
  };

  const handleForceDelete = async (id) => {
    try {
      await roomApi.forceDeleteCategory(id);
      setConfirmDelete({ open: false, categoryId: null, message: "", isSoftDelete: false });
      setToast({ type: "success", message: "Đã xóa loại phòng và toàn bộ phòng liên quan." });
      loadCategories();
    } catch (error) {
      setToast({ type: "error", message: error.response?.data?.message || "Xóa thất bại" });
    }
  };

  const resetForm = () => {
    imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
    setImagePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setEditingItem(null);
    setFormData({ category_name: "", description: "", price: 0, max_adults: 1, max_children: 0, images: [] });
    setSelectedEquipments([]);
  };

  const openEdit = (item) => {
    imagePreviews.forEach(p => URL.revokeObjectURL(p.url));
    setImagePreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
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
        equipment_category_id: eq.equipment_category_id?.toString?.() || eq.equipment_category_id,
        quantity: eq.quantity
      })) || []
    );
    setIsModalOpen(true);
  };


  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-lg font-bold text-gray-800">Danh sách Loại phòng</h2>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition"
        >
          <FiPlus /> Thêm loại mới
        </button>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 text-sm border-b border-gray-100 bg-gray-50/50">
              <th className="py-3 px-2 font-semibold w-14">Ảnh</th>
              <th className="py-3 font-semibold">Tên loại</th>
              <th className="py-3 font-semibold">Giá (VNĐ)</th>
              <th className="py-3 font-semibold">Sức chứa</th>
              <th className="py-3 font-semibold">Mô tả</th>
              <th className="py-3 font-semibold">Chi tiết</th>
              <th className="py-3 font-semibold text-right px-2">Hành động</th>
            </tr>
          </thead>
          <tbody className="text-gray-700 text-sm">
            {currentCategories.map((item) => (
              <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                <td className="py-3 px-2">
                  {item.images?.[0] ? (
                    <img
                      src={item.images[0]}
                      alt={item.category_name}
                      className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-300 border border-gray-200">
                      <FiImage size={20} />
                    </div>
                  )}
                </td>
                <td className="py-3 font-semibold text-indigo-900">
                  {item.category_name}
                  {/* {item.images?.length > 1 && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">+{item.images.length - 1} ảnh</span>
                  )} */}
                </td>
                <td className="py-3 font-bold text-indigo-600">{item.price?.toLocaleString()}</td>
                <td className="py-3">{item.max_adults} lớn, {item.max_children} trẻ</td>
                <td className="py-3 text-gray-500 truncate max-w-[160px]">{item.description}</td>
                <td className="py-3">
                  <button
                    onClick={() => { setSelectedCategory(item); setIsDetailOpen(true); }}
                    className="text-indigo-600 hover:underline text-xs font-bold bg-indigo-50 px-2 py-1 rounded"
                  >
                    Chi tiết
                  </button>
                </td>
                <td className="py-3 text-right px-2">
                  <button onClick={() => openEdit(item)} className="text-gray-400 hover:text-indigo-600 mr-3"><FiEdit size={18} /></button>
                  <button onClick={() => handleDelete(item._id)} className="text-gray-400 hover:text-red-500"><FiTrash2 size={18} /></button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr><td colSpan="7" className="text-center py-6 text-gray-400">Chưa có dữ liệu</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ── */}
      {categories.length > 0 && (
        <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
          <div className="text-sm text-gray-500">
            Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, categories.length)}</b> trong tổng <b>{categories.length}</b>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiChevronLeft />
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
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
            ))}
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

      {/* ── Create / Edit Modal ── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[560px] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4 items-center">
              <h3 className="font-bold text-lg">{editingItem ? "Sửa loại phòng" : "Thêm loại phòng"}</h3>
              <button onClick={() => { setIsModalOpen(false); resetForm(); }}><FiX size={24} /></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Tên */}
              <div>
                <label className="text-sm font-medium text-gray-700">Tên loại phòng</label>
                <input
                  type="text" required
                  className="w-full border rounded-lg p-2 mt-1 outline-none focus:border-indigo-500"
                  value={formData.category_name}
                  onChange={e => setFormData({ ...formData, category_name: e.target.value })}
                />
              </div>

              {/* Giá + Người lớn */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Giá (VNĐ)</label>
                  <input
                    type="number" required min={1}
                    className="w-full border rounded-lg p-2 mt-1 outline-none focus:border-indigo-500"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Người lớn tối đa</label>
                  <input
                    type="number" required min={1}
                    className="w-full border rounded-lg p-2 mt-1 outline-none focus:border-indigo-500"
                    value={formData.max_adults}
                    onChange={e => setFormData({ ...formData, max_adults: e.target.value })}
                  />
                </div>
              </div>

              {/* Trẻ em */}
              <div>
                <label className="text-sm font-medium text-gray-700">Trẻ em tối đa</label>
                <input
                  type="number" required min={0}
                  className="w-full border rounded-lg p-2 mt-1 outline-none focus:border-indigo-500"
                  value={formData.max_children}
                  onChange={e => setFormData({ ...formData, max_children: e.target.value })}
                />
              </div>

              {/* Mô tả */}
              <div>
                <label className="text-sm font-medium text-gray-700">Mô tả</label>
                <textarea
                  required
                  className="w-full border rounded-lg p-2 mt-1 h-20 outline-none focus:border-indigo-500 resize-none"
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              {/* ── Image upload ── */}
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Hình ảnh
                  {editingItem && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">
                      (tải ảnh mới sẽ thay thế toàn bộ ảnh hiện tại)
                    </span>
                  )}
                </label>

                {/* Existing images — only shown during edit when no new files selected yet */}
                {editingItem && editingItem.images?.length > 0 && imagePreviews.length === 0 && (
                  <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-xs text-gray-500 mb-2">Ảnh hiện tại:</p>
                    <div className="flex flex-wrap gap-2">
                      {editingItem.images.map((url, i) => (
                        <img
                          key={i} src={url} alt={`current-${i}`}
                          className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* File input trigger */}
                <label className="mt-2 flex items-center gap-3 cursor-pointer border-2 border-dashed border-gray-300 rounded-lg p-3 hover:border-indigo-400 hover:bg-indigo-50/30 transition">
                  <FiUpload className="text-gray-400 shrink-0" size={18} />
                  <span className="text-sm text-gray-500">
                    {imagePreviews.length > 0
                      ? `${imagePreviews.length} ảnh đã chọn — nhấn để chọn lại`
                      : "Chọn ảnh (tối đa 10, mỗi ảnh ≤ 5 MB · jpg / png / webp)"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={handleImageChange}
                  />
                </label>

                {/* New-file previews */}
                {imagePreviews.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {imagePreviews.map((preview, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={preview.url} alt={`new-${i}`}
                          className="w-16 h-16 rounded-lg object-cover border border-indigo-200"
                        />
                        <button
                          type="button"
                          onClick={() => removeImagePreview(i)}
                          className="absolute -top-1.5 -right-1.5 bg-red-500 hover:bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none shadow"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Thiết bị mặc định */}
              <div>
                <label className="text-sm font-medium text-gray-700">Thiết bị mặc định</label>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3 bg-gray-50">
                  {equipmentList.map(eq => {
                    const selected = selectedEquipments.find(
                      i => i.equipment_category_id.toString() === eq._id.toString()
                    );
                    return (
                      <div key={eq._id} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={!!selected}
                          onChange={(e) => {
                            if (e.target.checked)
                              setSelectedEquipments([...selectedEquipments, { equipment_category_id: eq._id, quantity: 1 }]);
                            else
                              setSelectedEquipments(selectedEquipments.filter(i => i.equipment_category_id !== eq._id));
                          }}
                        />
                        <span className="flex-1 text-sm text-gray-700">{eq.name}</span>
                        {selected && (
                          <input
                            type="number" min={1}
                            className="w-16 border rounded p-1 text-sm text-center"
                            value={selected.quantity}
                            onChange={(e) =>
                              setSelectedEquipments(selectedEquipments.map(i =>
                                i.equipment_category_id === eq._id ? { ...i, quantity: Number(e.target.value) } : i
                              ))
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
              >
                {editingItem ? "Cập nhật" : "Tạo mới"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal (images + equipment) ── */}
      {isDetailOpen && selectedCategory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-[480px] max-h-[82vh] overflow-y-auto p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4 border-b pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-800">{selectedCategory.category_name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">Chi tiết loại phòng</p>
              </div>
              <button onClick={() => setIsDetailOpen(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={22} />
              </button>
            </div>

            {/* Images gallery */}
            {selectedCategory.images?.length > 0 ? (
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-600 mb-2">
                  Hình ảnh
                  <span className="ml-1.5 text-xs text-gray-400 font-normal">({selectedCategory.images.length} ảnh)</span>
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {selectedCategory.images.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url} alt={`img-${i}`}
                        className="w-full h-28 rounded-lg object-cover border border-gray-200 hover:opacity-90 transition"
                      />
                    </a>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-5 flex flex-col items-center justify-center py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200 text-gray-400">
                <FiImage size={28} className="mb-1" />
                <span className="text-xs">Chưa có hình ảnh</span>
              </div>
            )}

            {/* Equipment list */}
            <p className="text-sm font-semibold text-gray-600 mb-2">Thiết bị mặc định</p>
            {selectedCategory.default_equipments?.length > 0 ? (
              <ul className="space-y-2">
                {selectedCategory.default_equipments.map(eq => (
                  <li
                    key={eq._id}
                    className="flex justify-between items-center bg-gray-50 p-3 rounded border border-gray-100"
                  >
                    <span className="font-medium text-gray-700 text-sm">
                      {eq.equipment_category?.name || eq.equipment_category_id?.name}
                    </span>
                    <span className="text-indigo-600 font-bold text-sm">× {eq.quantity}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="italic text-gray-400 text-center py-4">Không có thiết bị mặc định</p>
            )}
          </div>
        </div>
      )}

      {confirmDelete.open && (
        <ConfirmModal
          open={confirmDelete.open}
          title="Xóa loại phòng"
          message={confirmDelete.message}
          confirmText={confirmDelete.isSoftDelete ? "Xóa" : "Xóa tất cả"}
          cancelText="Hủy"
          onConfirm={() =>
            confirmDelete.isSoftDelete
              ? executeSoftDelete(confirmDelete.categoryId)
              : handleForceDelete(confirmDelete.categoryId)
          }
          onCancel={() => setConfirmDelete({ open: false, categoryId: null, message: "", isSoftDelete: false })}
        />
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  );
}
