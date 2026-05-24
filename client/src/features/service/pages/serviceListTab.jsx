import React, { useEffect, useState, useMemo } from "react";
import {
  FiPlus, FiSearch, FiEdit, FiTrash2, FiFilter, FiImage, FiList, FiChevronDown,
  FiChevronLeft, FiChevronRight, FiZap, FiCheck, FiX
} from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import ServiceModal from "../components/serviceModal.jsx";
import ServiceCategorySection from "../components/serviceCategorySection.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import Toast from "../../../components/toast.jsx";

export default function ServiceListTab() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const [previewItems, setPreviewItems] = useState([]);
  const [outOfStockServices, setOutOfStockServices] = useState([]);
  const [creating, setCreating] = useState(false);

  const [previewFormData, setPreviewFormData] = useState({
    import_date: "",
    default_quantity: 20,
    default_price_percent: 0.8
  });
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({ open: false, title: "", message: "", onConfirm: null });

  const { user } = useAuth();
  let userId = user?._id;
  if (!userId && user?.token) {
    try { userId = jwtDecode(user.token).userId; } catch (err) {}
  }
  if (!userId) 
    return alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại!");
  const userRole = (user?.role || localStorage.getItem("role") || "").toLowerCase();
  const isManager = userRole === "manager" || userRole === "admin";
  
  useEffect(() => {
    console.log("🔍 Debug ServiceListTab:");
    console.log("- user?.role:", user?.role);
    console.log("- localStorage role:", localStorage.getItem("role"));
    console.log("- isManager:", isManager);
  }, [user, isManager]);
  
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterCategory, filterStatus, sortOrder]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [srvRes, catRes] = await Promise.all([
        serviceApi.getAllServices(),
        serviceApi.getAllCategories()
      ]);
      setServices(srvRes.services || []);
      setCategories(catRes.categories || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingService(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item) => {
    setEditingService(item);
    setIsModalOpen(true);
  };

  const handleDelete = (id, name) => {
    setConfirmState({
      open: true,
      title: "Xóa dịch vụ",
      message: `Bạn có chắc chắn muốn xóa "${name}" không?`,
      onConfirm: async () => {
        setConfirmState(s => ({ ...s, open: false }));
        try {
          await serviceApi.deleteService(id);
          setToast({ type: "success", message: "Đã xóa thành công!" });
          fetchData();
        } catch (error) {
          setToast({ type: "error", message: "Lỗi xóa: " + (error.response?.data?.message || error.message) });
        }
      }
    });
  };

  // Auto create import ticket handlers
  const handleOpenPreview = async () => {
    try {
      const res = await serviceApi.getOutOfStockServices();
      if (res.success && res.services && res.services.length > 0) {
        setOutOfStockServices(res.services);
        
        // Tạo preview items với giá trị mặc định
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const formattedDate = tomorrow.toISOString().split('T')[0];
        
        const items = res.services.map(service => ({
          service_id: service._id,
          service_name: service.name,
          service_price: service.price,
          service_unit: service.unit,
          import_quantity: previewFormData.default_quantity,
          import_price: Math.round(service.price * previewFormData.default_price_percent)
        }));
        
        setPreviewItems(items);
        setPreviewFormData(prev => ({ ...prev, import_date: formattedDate }));
        setShowPreviewModal(true);
      } else {
        setToast({ type: "info", message: "Không có sản phẩm nào hết tồn kho (số lượng = 0)." });
      }
    } catch (error) {
      console.error("Error fetching out of stock services:", error);
      setToast({ type: "error", message: "Lỗi: " + (error.response?.data?.message || error.message) });
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
    const updated = [...previewItems];
    updated.splice(index, 1);
    setPreviewItems(updated);
  };

  const handleConfirmCreate = async () => {
    if (!previewFormData.import_date) {
      setToast({ type: "error", message: "Vui lòng chọn ngày nhập!" });
      return;
    }

    if (previewItems.length === 0) {
      setToast({ type: "error", message: "Không có sản phẩm nào để tạo phiếu nhập!" });
      return;
    }

    for (let i = 0; i < previewItems.length; i++) {
      const item = previewItems[i];
      if (!item.import_quantity || item.import_quantity <= 0) {
        setToast({ type: "error", message: `Sản phẩm "${item.service_name}": Số lượng nhập phải > 0` });
        return;
      }
      if (!item.import_price || item.import_price <= 0) {
        setToast({ type: "error", message: `Sản phẩm "${item.service_name}": Giá nhập phải > 0` });
        return;
      }
    }

    setCreating(true);
    try {
      const goods_list = previewItems.map(item => ({
        service_id: item.service_id,
        import_quantity: item.import_quantity,
        import_price: item.import_price
      }));

      const res = await serviceApi.autoCreateGoodTicket({
        import_date: previewFormData.import_date,
        goods_list: goods_list
      });

      if (res.success) {
        setToast({ type: "success", message: res.message || `Đã tạo phiếu nhập thành công cho ${res.items_count || 0} loại sản phẩm!` });
        setShowPreviewModal(false);
        setPreviewItems([]);
        fetchData();
      } else {
        setToast({ type: "error", message: "Lỗi: " + (res.message || "Không thể tạo phiếu nhập") });
      }
    } catch (error) {
      console.error("Error creating import ticket:", error);
      setToast({ type: "error", message: "Lỗi: " + (error.response?.data?.message || error.message) });
    } finally {
      setCreating(false);
    }
  };

  const filteredServices = useMemo(() => {
    let result = [...services];

    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        result = result.filter(item =>
            item.name.toLowerCase().includes(lower)
        );
    }

    if (filterCategory !== "all") {
        result = result.filter(item => {
            const catId = item.category_id?._id || item.category_id;
            return catId === filterCategory;
        });
    }

    if (filterStatus !== "all") {
        result = result.filter(item => item.status === filterStatus);
    }

    result.sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        if (sortOrder === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        if (sortOrder === 'a-z') return a.name.localeCompare(b.name);
        if (sortOrder === 'price-asc') return a.price - b.price;
        if (sortOrder === 'price-desc') return b.price - a.price;
        return 0;
    });

    return result;
  }, [services, searchTerm, filterCategory, filterStatus, sortOrder]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentServices = filteredServices.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredServices.length / itemsPerPage);

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

  const getCategoryName = (id) => {
      const cat = categories.find(c => c._id === id || c._id === id?._id);
      return cat ? cat.name : "---";
  };

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100">
        <ServiceCategorySection categories={categories} canManage={isManager} onRefresh={fetchData} />

        <div className="flex justify-between items-center mb-6">
            {isManager ? (
                <div className="flex gap-3 flex-wrap">
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-indigo-200 shadow-lg whitespace-nowrap"
                    >
                        <FiPlus /> Tạo dịch vụ mới
                    </button>
                    <button
                        onClick={handleOpenPreview}
                        className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition shadow-emerald-200 shadow-lg whitespace-nowrap"
                    >
                        <FiZap /> Tự động tạo phiếu nhập
                    </button>
                </div>
            ) : (
                <div></div>
            )}
        </div>

        <div className="flex flex-col lg:flex-row gap-4 justify-between mb-6">
            <div className="relative w-full lg:w-96">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                    type="text"
                    placeholder="Tìm tên dịch vụ, món ăn..."
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex gap-3 overflow-x-auto pb-1">
                <div className="relative min-w-[200px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiFilter className="text-gray-500" size={16} /></div>
                    <select className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                        <option value="all">Tất cả Danh mục</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><FiChevronDown className="text-gray-400" size={16} /></div>
                </div>

                <div className="flex flex-wrap gap-2 bg-gray-100 p-1 rounded-lg">
                    <button 
                        onClick={() => setFilterStatus("all")} 
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                            filterStatus === "all" 
                                ? "bg-white text-indigo-600 shadow-sm" 
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Tất cả
                    </button>
                    <button 
                        onClick={() => setFilterStatus("active")} 
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                            filterStatus === "active" 
                                ? "bg-white text-green-600 shadow-sm" 
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Hoạt động
                    </button>
                    <button 
                        onClick={() => setFilterStatus("inactive")} 
                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all whitespace-nowrap ${
                            filterStatus === "inactive" 
                                ? "bg-white text-red-600 shadow-sm" 
                                : "text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        Ngưng
                    </button>
                </div>

                <div className="relative min-w-[180px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FiList className="text-gray-500" size={16} /></div>
                    <select className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
                        <option value="newest">Mới nhất</option>
                        <option value="oldest">Cũ nhất</option>
                        <option value="a-z">Tên: A - Z</option>
                        <option value="price-asc">Giá: Thấp - Cao</option>
                        <option value="price-desc">Giá: Cao - Thấp</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none"><FiChevronDown className="text-gray-400" size={16} /></div>
                </div>
            </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 bg-gray-50/50">
                        <th className="py-3 pl-4 w-16">Ảnh</th>
                        <th className="py-3">Tên Dịch vụ</th>
                        <th className="py-3">Danh mục</th>
                        <th className="py-3 text-right">Đơn giá</th>
                        <th className="py-3 text-center">Tồn kho</th>
                        <th className="py-3 text-center">Trạng thái</th>
                        {isManager && <th className="py-3 text-right pr-4">Hành động</th>}
                    </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                    {loading && <tr><td colSpan={isManager ? 7 : 6} className="text-center py-12 text-gray-400">Đang tải dữ liệu...</td></tr>}
                    {!loading && filteredServices.length === 0 && (
                        <tr><td colSpan={isManager ? 7 : 6} className="text-center py-12 text-gray-400 italic">
                            <div className="flex flex-col items-center gap-2">
                                <FiSearch size={24} className="opacity-50"/>
                                <span>Không tìm thấy dữ liệu nào.</span>
                            </div>
                        </td></tr>
                    )}
                    {currentServices.map((item) => (
                        <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                            <td className="py-3 pl-4">
                                <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                                    {item.images && item.images.length > 0 ? (
                                        <img src={item.images[0].startsWith('http') ? item.images[0] : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/${item.images[0]}`} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <FiImage className="text-gray-400" size={16}/>
                                    )}
                                </div>
                            </td>
                            <td className="py-3 font-bold text-gray-800">
                                {item.name}
                                <div className="text-xs text-gray-400 font-normal truncate max-w-[150px]">{item.description}</div>
                            </td>
                            <td className="py-3 text-gray-600">
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">{getCategoryName(item.category_id)}</span>
                            </td>
                            <td className="py-3 text-right font-bold text-indigo-600">
                                {item.price?.toLocaleString()}<span className="text-gray-400 font-normal text-xs ml-1">/{item.unit}</span>
                            </td>
                            <td className="py-3 text-center font-medium">
                                {item.storage_quantity > 0 ? <span className="text-emerald-600">{item.storage_quantity}</span> : <span className="text-red-400">0</span>}
                            </td>
                            <td className="py-3 text-center">
                                {item.status === 'active' ? <span className="px-2 py-1 text-xs font-bold text-green-600 bg-green-50 rounded-full">Hoạt động</span> : <span className="px-2 py-1 text-xs font-bold text-red-600 bg-red-50 rounded-full">Ngưng</span>}
                            </td>
                            {isManager && (
                                <td className="py-3 text-right pr-4">
                                    <button onClick={() => handleEdit(item)} className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-xs mr-2 font-medium">Sửa</button>
                                    <button onClick={() => handleDelete(item._id, item.name)} className="text-gray-400 hover:text-red-500"><FiTrash2 size={16}/></button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        {filteredServices.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                <div className="text-sm text-gray-500">
                    Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredServices.length)}</b> trong tổng <b>{filteredServices.length}</b>
                </div>
                {renderPaginationButtons()}
            </div>
        )}

        {isManager && (
            <ServiceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} onSuccess={fetchData} initialData={editingService} />
        )}

        {confirmState.open && (
          <ConfirmModal
            open={confirmState.open}
            title={confirmState.title}
            message={confirmState.message}
            confirmText="Xác nhận"
            cancelText="Hủy"
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(s => ({ ...s, open: false }))}
          />
        )}
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

        {/* Preview Modal for Auto Create Import Ticket */}
        {showPreviewModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="font-bold text-xl text-gray-900">Preview Phiếu Nhập Sản Phẩm</h3>
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
                  <h4 className="font-bold text-gray-900 mb-3">Danh sách sản phẩm hết tồn kho ({previewItems.length} loại)</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-200 bg-gray-50">
                          <th className="py-3 pl-4">Tên sản phẩm</th>
                          <th className="py-3 text-center">Đơn vị</th>
                          <th className="py-3 text-center">Giá bán</th>
                          <th className="py-3 text-center">Số lượng nhập</th>
                          <th className="py-3 text-center">Giá nhập (VNĐ)</th>
                          <th className="py-3 text-right pr-4">Thành tiền</th>
                        </tr>
                      </thead>
                      <tbody className="text-gray-700 text-sm">
                        {previewItems.map((item, index) => {
                          const total = item.import_quantity * item.import_price;
                          const unitMap = {
                            'hour': 'Giờ',
                            'day': 'Ngày',
                            'item': 'Cái',
                            'can': 'Lon',
                            'bottle': 'Chai',
                            'portion': 'Phần',
                            'ticket': 'Vé'
                          };
                          return (
                            <tr key={item.service_id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-3 pl-4 font-medium">{item.service_name}</td>
                              <td className="py-3 text-center text-gray-600">
                                {unitMap[item.service_unit] || item.service_unit}
                              </td>
                              <td className="py-3 text-center">{item.service_price.toLocaleString()} đ</td>
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
                                  onClick={() => handleRemovePreviewItem(index)}
                                  className="text-red-500 hover:text-red-700 hover:bg-red-50 p-2 rounded transition"
                                  title="Xóa sản phẩm này"
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
                          <td colSpan="6" className="py-3 pl-4 font-bold text-gray-900">Tổng cộng</td>
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