import React, { useEffect, useState, useMemo } from "react";
import { FiPlus, FiSearch, FiEdit, FiTrash2, FiFilter, FiImage, FiList, FiChevronDown } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi";
import ServiceModal from "../components/serviceModal";

export default function ServiceListTab() {
  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

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

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa "${name}" không?`)) return;
    try {
        await serviceApi.deleteService(id);
        alert("Đã xóa thành công!");
        fetchData();
    } catch (error) {
        alert("Lỗi xóa: " + (error.response?.data?.message || error.message));
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

    result.sort((a, b) => {
        if (sortOrder === 'newest') return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        if (sortOrder === 'oldest') return new Date(a.created_at || 0) - new Date(b.created_at || 0);
        if (sortOrder === 'a-z') return a.name.localeCompare(b.name);
        if (sortOrder === 'price-asc') return a.price - b.price;
        if (sortOrder === 'price-desc') return b.price - a.price;
        return 0;
    });

    return result;
  }, [services, searchTerm, filterCategory, sortOrder]);

  const getCategoryName = (id) => {
      const cat = categories.find(c => c._id === id || c._id === id?._id);
      return cat ? cat.name : "---";
  };

  return (
    <div className="bg-white p-6 rounded-b-2xl shadow-sm border border-t-0 border-gray-100">

        <div className="flex justify-between items-center mb-6">
            <button
                onClick={handleCreate}
                className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-indigo-700 transition shadow-indigo-200 shadow-lg"
            >
                <FiPlus /> Tạo dịch vụ mới
            </button>
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
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiFilter className="text-gray-500" size={16} />
                    </div>
                    <select
                        className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                    >
                        <option value="all">Tất cả Danh mục</option>
                        {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
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
                        className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value)}
                    >
                        <option value="newest">Mới nhất</option>
                        <option value="oldest">Cũ nhất</option>
                        <option value="a-z">Tên: A - Z</option>
                        <option value="price-asc">Giá: Thấp - Cao</option>
                        <option value="price-desc">Giá: Cao - Thấp</option>
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
                        <th className="py-3 pl-4 w-16">Ảnh</th>
                        <th className="py-3">Tên Dịch vụ</th>
                        <th className="py-3">Danh mục</th>
                        <th className="py-3 text-right">Đơn giá</th>
                        <th className="py-3 text-center">Tồn kho</th>
                        <th className="py-3 text-center">Trạng thái</th>
                        <th className="py-3 text-right pr-4">Hành động</th>
                    </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                    {loading && (
                        <tr><td colSpan="7" className="text-center py-12 text-gray-400">Đang tải dữ liệu...</td></tr>
                    )}
                    {!loading && filteredServices.length === 0 && (
                        <tr><td colSpan="7" className="text-center py-12 text-gray-400 italic">
                            <div className="flex flex-col items-center gap-2">
                                <FiSearch size={24} className="opacity-50"/>
                                <span>Không tìm thấy dữ liệu nào.</span>
                            </div>
                        </td></tr>
                    )}
                    {filteredServices.map((item) => (
                        <tr key={item._id} className="border-b border-gray-50 hover:bg-gray-50 transition">
                            <td className="py-3 pl-4">
                                <div className="w-10 h-10 rounded-lg border border-gray-200 overflow-hidden bg-gray-100 flex items-center justify-center">
                                    {item.images && item.images.length > 0 ? (
                                        <img
                                            src={item.images[0].startsWith('http') ? item.images[0] : `http://localhost:3000/${item.images[0]}`}
                                            alt={item.name}
                                            className="w-full h-full object-cover"
                                        />
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
                                <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs font-semibold">
                                    {getCategoryName(item.category_id)}
                                </span>
                            </td>
                            <td className="py-3 text-right font-bold text-indigo-600">
                                {item.price?.toLocaleString()}
                                <span className="text-gray-400 font-normal text-xs ml-1">/{item.unit}</span>
                            </td>
                            <td className="py-3 text-center font-medium">
                                {item.storage_quantity > 0 ? (
                                    <span className="text-emerald-600">{item.storage_quantity}</span>
                                ) : (
                                    <span className="text-red-400">0</span>
                                )}
                            </td>
                            <td className="py-3 text-center">
                                {item.status === 'active' ? (
                                    <span className="px-2 py-1 text-xs font-bold text-green-600 bg-green-50 rounded-full">
                                        Hoạt động
                                    </span>
                                ) : (
                                    <span className="px-2 py-1 text-xs font-bold text-red-600 bg-red-50 rounded-full">
                                        Ngưng
                                    </span>
                                )}
                            </td>
                            <td className="py-3 text-right pr-4">
                                <button
                                    onClick={() => handleEdit(item)}
                                    className="text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1 rounded text-xs mr-2 font-medium"
                                >
                                    Sửa
                                </button>
                                <button
                                    onClick={() => handleDelete(item._id, item.name)}
                                    className="text-gray-400 hover:text-red-500"
                                >
                                    <FiTrash2 size={16}/>
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>

        <ServiceModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            onSuccess={fetchData}
            initialData={editingService}
        />
    </div>
  );
}