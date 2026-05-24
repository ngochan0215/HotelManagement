import React, { useState } from "react";
import { FiPlus, FiEdit, FiTrash2 } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import ServiceCategoryModal from "./serviceCategoryModal.jsx";

export default function ServiceCategorySection({ categories = [], canManage = false, onRefresh }) {
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const handleCreateCategory = () => {
    setEditingCategory(null);
    setIsCategoryModalOpen(true);
  };

  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setIsCategoryModalOpen(true);
  };

  const handleDeleteCategory = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa danh mục "${name}" không?`)) return;

    try {
      await serviceApi.deleteCategory(id);
      alert("Đã xóa danh mục thành công!");
      onRefresh?.();
    } catch (error) {
      alert("Lỗi xóa danh mục: " + (error.response?.data?.message || error.message));
    }
  };

  return (
    <>
      <div className="mb-6 w-full rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50/70 to-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-gray-900">Danh mục dịch vụ</h2>
              <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2.5 py-1 rounded-full">
                {categories.length} danh mục
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Phân nhóm dịch vụ/sản phẩm để dễ lọc, quản lý kho và phiếu sử dụng.
            </p>
          </div>

          {canManage && (
            <button
              onClick={handleCreateCategory}
              className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition shadow-sm whitespace-nowrap self-start lg:self-auto"
            >
              <FiPlus size={16} /> Thêm danh mục
            </button>
          )}
        </div>

        <div className="p-5">
          {categories.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-center">
              <p className="text-sm font-semibold text-gray-600">Chưa có danh mục dịch vụ nào.</p>
              <p className="text-xs text-gray-400 mt-1">Thêm danh mục để phân loại dịch vụ/sản phẩm.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {categories.map((category) => (
                <div
                  key={category._id}
                  className="rounded-xl border border-gray-200 bg-gray-50/70 hover:bg-white hover:border-indigo-200 hover:shadow-sm transition p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-gray-900 truncate">{category.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mt-1 leading-6">
                        {category.description || "Chưa có mô tả cho danh mục này."}
                      </p>
                    </div>

                    {canManage && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-indigo-600 bg-white border border-indigo-100 hover:bg-indigo-50 font-semibold text-sm transition"
                          title="Sửa danh mục"
                        >
                          <FiEdit size={14} /> Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category._id, category.name)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-red-600 bg-white border border-red-100 hover:bg-red-50 font-semibold text-sm transition"
                          title="Xóa danh mục"
                        >
                          <FiTrash2 size={14} /> Xóa
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <ServiceCategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSuccess={onRefresh}
        initialData={editingCategory}
      />
    </>
  );
}
