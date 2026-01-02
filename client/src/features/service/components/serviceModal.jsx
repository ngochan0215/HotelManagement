import React, { useState, useEffect } from "react";
import { FiX, FiSave, FiImage, FiChevronDown } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi";

export default function ServiceModal({ isOpen, onClose, onSuccess, initialData }) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [previewImages, setPreviewImages] = useState([]);

  const [formData, setFormData] = useState({
    name: "",
    category_id: "",
    unit: "item",
    price: 0,
    description: "",
    status: "active"
  });

  const unitOptions = [
      { value: 'item', label: 'Cái / Chiếc' },
      { value: 'can', label: 'Lon' },
      { value: 'bottle', label: 'Chai' },
      { value: 'box', label: 'Hộp' },
      { value: 'portion', label: 'Phần / Suất' },
      { value: 'hour', label: 'Giờ' },
      { value: 'day', label: 'Ngày' },
      { value: 'ticket', label: 'Vé' }
  ];

  useEffect(() => {
    if (isOpen) {
      fetchCategories();
      if (initialData) {
        setFormData({
          name: initialData.name || "",
          category_id: initialData.category_id?._id || initialData.category_id || "",
          unit: initialData.unit || "item",
          price: initialData.price || 0,
          description: initialData.description || "",
          status: initialData.status || "active"
        });
        setPreviewImages(initialData.images || []);
      } else {
        resetForm();
      }
    }
  }, [isOpen, initialData]);

  const fetchCategories = async () => {
    try {
      const res = await serviceApi.getAllCategories();
      setCategories(res.categories || []);
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category_id: "",
      unit: "item",
      price: 0,
      description: "",
      status: "active"
    });
    setSelectedFiles([]);
    setPreviewImages([]);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setSelectedFiles(files);
    const previews = files.map(file => URL.createObjectURL(file));
    setPreviewImages(previews);
  };

  const handleSubmit = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
          const data = new FormData();

          data.append("name", formData.name.trim());
          data.append("category_id", formData.category_id);
          data.append("unit", formData.unit);
          const priceValue = Math.round(Number(formData.price));
          data.append("price", priceValue);
          data.append("description", formData.description || "");
          data.append("status", formData.status);

          if (!initialData) {
              data.append("storage_quantity", 0);
          }

          if (selectedFiles.length > 0) {
              selectedFiles.forEach((file) => {
                  data.append("image", file);
              });
          }

          if (initialData) {
              await serviceApi.updateService(initialData._id, data);
              alert("Cập nhật thành công!");
          } else {
              await serviceApi.createService(data);
              alert("Thêm mới thành công!");
          }
          onSuccess();
          onClose();
      } catch (error) {
          console.error("Submit Error:", error.response?.data);
          alert("Lỗi: " + (error.response?.data?.message || error.message));
      } finally {
          setLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-fade-in">

        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-lg text-gray-800">
                {initialData ? "Cập Nhật Dịch Vụ" : "Thêm Dịch Vụ Mới"}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full text-gray-500 transition">
                <FiX size={20} />
            </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">

            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Tên Dịch vụ <span className="text-red-500">*</span></label>
                    <input
                        type="text"
                        required
                        placeholder="Ví dụ: Coca Cola, Giặt ủi..."
                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Danh mục <span className="text-red-500">*</span></label>
                    <div className="relative">
                        <select
                            required
                            className="w-full appearance-none border border-gray-300 rounded-lg p-2.5 pr-10 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white cursor-pointer transition"
                            value={formData.category_id}
                            onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                        >
                            <option value="">-- Chọn danh mục --</option>
                            {categories.map(cat => (
                                <option key={cat._id} value={cat._id}>{cat.name}</option>
                            ))}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-5">
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Giá bán (VNĐ) <span className="text-red-500">*</span></label>
                    <input
                        type="number"
                        min="0"
                        required
                        placeholder="0"
                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium transition"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                    />
                </div>

                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Đơn vị tính</label>
                    <div className="relative">
                        <select
                            className="w-full appearance-none border border-gray-300 rounded-lg p-2.5 pr-10 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white cursor-pointer transition"
                            value={formData.unit}
                            onChange={(e) => setFormData({...formData, unit: e.target.value})}
                        >
                            {unitOptions.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
                        </select>
                        <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"/>
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Hình ảnh (Tối đa 5)</label>
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
                            <FiImage className="text-indigo-500" size={24}/>
                        </div>
                        <p className="text-sm font-medium text-gray-700">Kéo thả hoặc click để chọn ảnh</p>
                        <p className="text-xs text-gray-400 mt-1">PNG, JPG, WEBP (Max 5MB)</p>
                    </div>
                </div>
                {previewImages.length > 0 && (
                    <div className="flex gap-3 mt-4 overflow-x-auto pb-2 scrollbar-thin">
                        {previewImages.map((src, idx) => (
                            <div key={idx} className="w-20 h-20 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0 relative group shadow-sm">
                                <img src={src.startsWith('http') || src.startsWith('blob') ? src : `http://localhost:3000/${src}`} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Mô tả chi tiết</label>
                <textarea
                    className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 h-24 resize-none transition"
                    placeholder="Nhập mô tả về sản phẩm/dịch vụ..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                ></textarea>
            </div>

            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg border border-gray-100">
                <label className="text-sm font-bold text-gray-700">Trạng thái:</label>
                <div className="relative w-48">
                    <select
                        className="w-full appearance-none border border-gray-300 rounded-md py-1.5 pl-3 pr-8 text-sm bg-white focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                        value={formData.status}
                        onChange={(e) => setFormData({...formData, status: e.target.value})}
                    >
                        <option value="active">Hoạt động</option>
                        <option value="inactive">Ngưng hoạt động</option>
                    </select>
                    <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14}/>
                </div>
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
                    className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition flex items-center gap-2 shadow-md shadow-indigo-200 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {loading ? "Đang lưu..." : <><FiSave /> Lưu lại</>}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
}