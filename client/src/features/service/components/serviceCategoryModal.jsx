import React, { useEffect, useState } from "react";
import { FiX, FiSave, FiImage } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";

export default function ServiceCategoryModal({ isOpen, onClose, onSuccess, initialData }) {
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    if (!isOpen) return;

    if (initialData) {
      setFormData({
        name: initialData.name || "",
        description: initialData.description || "",
      });
      setPreviewImages(initialData.images || []);
    } else {
      setFormData({ name: "", description: "" });
      setSelectedFiles([]);
      setPreviewImages([]);
    }
  }, [isOpen, initialData]);

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setPreviewImages(files.map((file) => URL.createObjectURL(file)));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert("Vui lòng nhập tên danh mục!");
      return;
    }

    setLoading(true);

    try {
      const data = new FormData();
      data.append("name", formData.name.trim());
      data.append("description", formData.description || "");

      selectedFiles.forEach((file) => data.append("image", file));

      if (initialData?._id) {
        await serviceApi.updateCategory(initialData._id, data);
        alert("Cập nhật danh mục thành công!");
      } else {
        await serviceApi.createCategory(data);
        alert("Thêm danh mục thành công!");
      }

      onSuccess?.();
      onClose?.();
    } catch (error) {
      console.error("Category Submit Error:", error.response?.data || error);
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">
            {initialData ? "Cập Nhật Danh Mục Dịch Vụ" : "Thêm Danh Mục Dịch Vụ"}
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition">
            <FiX size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              Tên danh mục <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Ví dụ: Dịch vụ ăn uống, Dịch vụ giải trí..."
              className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả</label>
            <textarea
              className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none transition"
              placeholder="Nhập mô tả danh mục..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hình ảnh danh mục</label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 hover:border-indigo-300 transition relative">
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center">
                <div className="bg-indigo-50 p-3 rounded-full mb-2">
                  <FiImage className="text-indigo-500" size={24} />
                </div>
                <p className="text-sm font-medium text-gray-700">Click để chọn ảnh</p>
                <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP</p>
              </div>
            </div>

            {previewImages.length > 0 && (
              <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                {previewImages.map((src, idx) => (
                  <div key={idx} className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 shadow-sm">
                    <img
                      src={src.startsWith("http") || src.startsWith("blob") ? src : `${import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"}/${src}`}
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition shadow-sm"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition shadow-sm flex items-center gap-2 disabled:opacity-60"
            >
              <FiSave />
              {loading ? "Đang lưu..." : "Lưu danh mục"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
