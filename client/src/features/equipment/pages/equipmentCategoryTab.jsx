import React, { useState, useEffect, useMemo } from "react";
import {
  FiEdit, FiTrash2, FiPlus, FiX, FiSearch, FiList, FiChevronDown, FiFilter,
  FiChevronLeft, FiChevronRight, FiZap, FiCheck
} from "react-icons/fi";
import { equipmentApi } from "../../api/equipmentApi.js";
import ConfirmModal from "../../../components/confirmModal.jsx";
import { RankBadge } from "../../../components/ui/label.jsx";
import Pagination from "../../../components/pagination.jsx";

export default function EquipmentCategoryTab() {
  const [categories, setCategories] = useState([]);
  const [allEquipments, setAllEquipments] = useState([]);

  const [searchTerm, setSearchTerm] = useState("");
  const [sortOrder, setSortOrder] = useState("a-z");
  const [filterUnit, setFilterUnit] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: "", description: "", unit: "item", price: "" });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
  
  // Auto create import ticket states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [outOfStockCategories, setOutOfStockCategories] = useState([]);
  const [allCategoriesForPreview, setAllCategoriesForPreview] = useState([]);
  const [previewItems, setPreviewItems] = useState([]);
  const [previewFormData, setPreviewFormData] = useState({
    import_date: "",
    default_quantity: 10,
    default_price_percent: 0.8
  });
  const [creating, setCreating] = useState(false);
  const [selectedCategoryToAdd, setSelectedCategoryToAdd] = useState("");

  const UNIT_MAP = { item: "Cái", box: "Bộ" };
  const formatUnit = (unit) => UNIT_MAP[unit] || unit || "Cái";

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterUnit, sortOrder]);

  const loadData = async () => {
    try {
      const [catRes, eqRes] = await Promise.all([
        equipmentApi.getAllCategories(),
        equipmentApi.getAllEquipments()
      ]);

      console.log("catRes: ", catRes);
      console.log("eqRes: ", eqRes);

      const cats = (catRes && Array.isArray(catRes.categories)) ? catRes.categories : [];
      const eqs = (eqRes && Array.isArray(eqRes.data)) ? eqRes.data : [];

      console.log("cats: ", cats);
      console.log("eqs: ", eqs);

      const processedCategories = cats.map(cat => {
        if (cat.total_quantity !== undefined) return cat;

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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCategories = filteredCategories.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  const renderPaginationButtons = () => {
    const pages = [];
    if (totalPages <= 1) return null;

    const delta = 2;
    const left = currentPage - delta;
    const right = currentPage + delta;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        range.push(i);
      }
    }

    let l;
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return (
      <div className="flex gap-2">
        <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <FiChevronLeft />
        </button>
        {rangeWithDots.map((page, index) => (
           page === '...' ? (
             <span key={`dots-${index}`} className="px-2 py-1 text-gray-400 self-center">...</span>
           ) : (
             <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`w-8 h-8 rounded-lg text-sm font-bold transition ${
                    currentPage === page
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : "border hover:bg-gray-50 text-gray-600"
                }`}
            >
                {page}
            </button>
           )
        ))}
        <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <FiChevronRight />
        </button>
      </div>
    );
  };
  // -------------------------

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

  // Auto create import ticket handlers
  const handleOpenPreview = async () => {
    try {
      const [outOfStockRes, allCatsRes] = await Promise.all([
        equipmentApi.getOutOfStockCategories(),
        equipmentApi.getAllCategories()
      ]);
      
      if (outOfStockRes.success && outOfStockRes.categories && outOfStockRes.categories.length > 0) {
        setOutOfStockCategories(outOfStockRes.categories);
        setAllCategoriesForPreview(allCatsRes.categories || []);
        
        // Tạo preview items với giá trị mặc định
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0];
        
        const items = outOfStockRes.categories.map(cat => ({
          category_id: cat._id,
          category_name: cat.name,
          category_price: cat.price,
          import_quantity: previewFormData.default_quantity,
          import_price: Math.round(cat.price * previewFormData.default_price_percent)
        }));
        
        setPreviewItems(items);
        setPreviewFormData(prev => ({ ...prev, import_date: formattedDate }));
        setShowPreviewModal(true);
      } else {
        alert("Không có thiết bị nào hết tồn kho (số lượng = 0).");
      }
    } catch (error) {
      console.error("Error fetching out of stock categories:", error);
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    }
  };

  const handleUpdatePreviewItem = (index, field, value) => {
    const updated = [...previewItems];
    if (field === 'import_quantity') {
      updated[index].import_quantity = parseInt(value) || 0;
    } else if (field === 'import_price') {
      updated[index].import_price = parseInt(value) || 0;
    }
    setPreviewItems(updated);
  };

  const handleRemovePreviewItem = (index) => {
    if (previewItems.length === 1) {
      alert("Phải có ít nhất 1 thiết bị trong phiếu nhập!");
      return;
    }
    const updated = previewItems.filter((_, i) => i !== index);
    setPreviewItems(updated);
  };

  const handleAddPreviewItem = () => {
    if (!selectedCategoryToAdd) {
      alert("Vui lòng chọn thiết bị cần thêm!");
      return;
    }
    
    // Kiểm tra xem category đã có trong danh sách chưa
    const existingIds = previewItems.map(item => item.category_id);
    if (existingIds.includes(selectedCategoryToAdd)) {
      alert("Thiết bị này đã có trong phiếu nhập!");
      return;
    }
    
    // Tìm category được chọn
    const categoryToAdd = allCategoriesForPreview.find(cat => cat._id === selectedCategoryToAdd);
    if (!categoryToAdd) {
      alert("Không tìm thấy danh mục được chọn!");
      return;
    }
    
    const newItem = {
      category_id: categoryToAdd._id,
      category_name: categoryToAdd.name,
      category_price: categoryToAdd.price,
      import_quantity: previewFormData.default_quantity,
      import_price: Math.round(categoryToAdd.price * previewFormData.default_price_percent)
    };
    
    setPreviewItems([...previewItems, newItem]);
    setSelectedCategoryToAdd(""); // Reset selection
  };

  const getAvailableCategoriesForAdd = () => {
    const existingIds = previewItems.map(item => item.category_id);
    return allCategoriesForPreview.filter(cat => !existingIds.includes(cat._id));
  };

  const handleConfirmCreate = async () => {
    if (!previewFormData.import_date) {
      alert("Vui lòng chọn ngày nhập!");
      return;
    }

    if (previewItems.length === 0) {
      alert("Không có thiết bị nào để tạo phiếu nhập!");
      return;
    }

    // Validate items
    for (let i = 0; i < previewItems.length; i++) {
      const item = previewItems[i];
      if (!item.import_quantity || item.import_quantity <= 0) {
        alert(`Thiết bị "${item.category_name}": Số lượng nhập phải > 0`);
        return;
      }
      if (!item.import_price || item.import_price <= 0) {
        alert(`Thiết bị "${item.category_name}": Giá nhập phải > 0`);
        return;
      }
    }

    setCreating(true);
    try {
      const items = previewItems.map(item => ({
        category_id: item.category_id,
        import_quantity: item.import_quantity,
        import_price: item.import_price
      }));

      const res = await equipmentApi.autoCreateImportTicket({
        import_date: previewFormData.import_date,
        items: items
      });

      if (res.success) {
        alert(res.message || `Đã tạo phiếu nhập thành công cho ${res.items_count || 0} loại thiết bị!`);
        setShowPreviewModal(false);
        setPreviewItems([]);
        loadData(); // Reload để cập nhật dữ liệu
      } else {
        alert("Lỗi: " + (res.message || "Không thể tạo phiếu nhập"));
      }
    } catch (error) {
      console.error("Error creating import ticket:", error);
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex gap-3">
          <button
              onClick={() => { setEditingItem(null); setFormData({ name: "", description: "", unit: "item", price: "" }); setIsModalOpen(true); }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-indigo-200 shadow-lg"
          >
            <FiPlus /> Tạo danh mục
          </button>
          <button
              onClick={handleOpenPreview}
              className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition shadow-emerald-200 shadow-lg"
          >
            <FiZap /> Tự động tạo phiếu nhập
          </button>
        </div>
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
            {currentCategories.length > 0 ? (
              currentCategories.map((item) => (
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

      {filteredCategories.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                <div className="text-sm text-gray-500">
                    Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredCategories.length)}</b> trong tổng <b>{filteredCategories.length}</b>
                </div>
                {renderPaginationButtons()}
            </div>
      )}


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

      {/* Preview Modal for Auto Create Import Ticket */}
      {showPreviewModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-xl text-gray-900">Preview Phiếu Nhập Thiết Bị</h3>
              <button onClick={() => setShowPreviewModal(false)} className="text-gray-400 hover:text-gray-600">
                <FiX size={24} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <div className="mb-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Ngày nhập</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:border-indigo-500"
                    value={previewFormData.import_date}
                    onChange={(e) => setPreviewFormData(prev => ({ ...prev, import_date: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-bold text-gray-900">Danh sách thiết bị ({previewItems.length} loại)</h4>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedCategoryToAdd}
                      onChange={(e) => setSelectedCategoryToAdd(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-indigo-500 min-w-[200px]"
                    >
                      <option value="">-- Chọn thiết bị --</option>
                      {getAvailableCategoriesForAdd().map(cat => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={handleAddPreviewItem}
                      disabled={!selectedCategoryToAdd}
                      className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <FiPlus size={16} />
                      Thêm
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-200 bg-gray-50">
                        <th className="py-3 pl-4">Tên thiết bị</th>
                        <th className="py-3 text-center">Giá bán</th>
                        <th className="py-3 text-center">Số lượng nhập</th>
                        <th className="py-3 text-center">Giá nhập (VNĐ)</th>
                        <th className="py-3 text-right pr-4">Thành tiền</th>
                        <th className="py-3 text-center">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 text-sm">
                      {previewItems.map((item, index) => {
                        const total = item.import_quantity * item.import_price;
                        return (
                          <tr key={`${item.category_id}-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 pl-4 font-medium">{item.category_name}</td>
                            <td className="py-3 text-center">{item.category_price.toLocaleString()} đ</td>
                            <td className="py-3 text-center">
                              <input
                                type="number"
                                min="1"
                                className="w-20 border border-gray-300 rounded px-2 py-1 text-center focus:outline-none focus:border-indigo-500"
                                value={item.import_quantity}
                                onChange={(e) => handleUpdatePreviewItem(index, 'import_quantity', e.target.value)}
                              />
                            </td>
                            <td className="py-3 text-center">
                              <input
                                type="number"
                                min="1"
                                className="w-32 border border-gray-300 rounded px-2 py-1 text-center focus:outline-none focus:border-indigo-500"
                                value={item.import_price}
                                onChange={(e) => handleUpdatePreviewItem(index, 'import_price', e.target.value)}
                              />
                            </td>
                            <td className="py-3 text-right pr-4 font-bold text-indigo-600">
                              {total.toLocaleString()} đ
                            </td>
                            <td className="py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleRemovePreviewItem(index)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded transition"
                                title="Xóa thiết bị"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-50 border-t-2 border-gray-200">
                        <td colSpan="4" className="py-3 pl-4 font-bold text-gray-900">Tổng cộng</td>
                        <td className="py-3 text-right pr-4 font-bold text-indigo-600 text-lg">
                          {previewItems.reduce((sum, item) => sum + (item.import_quantity * item.import_price), 0).toLocaleString()} đ
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3 bg-gray-50">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition"
                disabled={creating}
              >
                Hủy
              </button>
              <button
                onClick={handleConfirmCreate}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Đang tạo...</span>
                  </>
                ) : (
                  <>
                    <FiCheck size={18} />
                    <span>Xác nhận tạo phiếu nhập</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}