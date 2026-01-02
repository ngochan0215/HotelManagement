import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO, isWithinInterval, isBefore, isAfter } from "date-fns";
import {
  FiPlus, FiSearch, FiTag, FiCalendar, FiPercent, FiEdit, FiTrash2, FiFilter, FiChevronDown, FiLoader, FiX, FiLayers, FiType
} from "react-icons/fi";

import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";
import ConfirmModal from "../../../components/confirmModal";
import Toast from "../../../components/toast";
import { StatusPill } from "../../../components/ui/label";
import { discountApi } from "../../api/discountApi";

const SCOPE_MAP = {
  booking: "Đặt phòng (Tổng)",
  room: "Giá phòng",
  service: "Dịch vụ",
  customer: "Khách hàng"
};

const TYPE_MAP = {
  seasonal: "Theo mùa",
  first_booking: "Đặt lần đầu",
  loyalty: "Khách thân thiết",
  promo_code: "Mã giảm giá"
};

export default function DiscountPage() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterScope, setFilterScope] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [toast, setToast] = useState(null);

  const [confirmState, setConfirmState] = useState({
    open: false, title: "", message: "", onConfirm: null
  });

  const [editingDiscount, setEditingDiscount] = useState(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    begin_date: "",
    end_date: "",
    percentage: 10,
    scope: "booking",
    type: "seasonal"
  });

  useEffect(() => {
    fetchDiscounts();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const fetchDiscounts = async () => {
    setLoading(true);
    try {
      const res = await discountApi.getAllDiscounts();
      setDiscounts(res.discounts || []);
    } catch (error) {
      console.error(error);
      showToast("Lỗi tải danh sách khuyến mãi", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingDiscount(null);
    setFormData({
      name: "",
      description: "",
      begin_date: format(new Date(), "yyyy-MM-dd"),
      end_date: format(new Date(), "yyyy-MM-dd"),
      percentage: 10,
      scope: "booking",
      type: "seasonal"
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      name: discount.name,
      description: discount.description || "",
      begin_date: discount.begin_date ? format(parseISO(discount.begin_date), "yyyy-MM-dd") : "",
      end_date: discount.end_date ? format(parseISO(discount.end_date), "yyyy-MM-dd") : "",
      percentage: discount.percentage,
      scope: discount.scope,
      type: discount.type
    });
    setIsModalOpen(true);
  };

  const handleDeleteAction = (id) => {
    setConfirmState({
      open: true,
      title: "Xóa chương trình khuyến mãi?",
      message: "Hành động này không thể hoàn tác. Bạn có chắc chắn muốn xóa không?",
      onConfirm: async () => {
        try {
          await discountApi.deleteDiscount(id);
          showToast("Đã xóa khuyến mãi thành công.", "success");
          fetchDiscounts();
          setConfirmState(prev => ({ ...prev, open: false }));
        } catch (error) {
          showToast(error.response?.data?.message || error.message, "error");
        }
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    try {
      if (editingDiscount) {
        await discountApi.updateDiscount(editingDiscount._id, formData);
        showToast("Cập nhật khuyến mãi thành công!", "success");
      } else {
        await discountApi.createDiscount(formData);
        showToast("Tạo khuyến mãi mới thành công!", "success");
      }
      setIsModalOpen(false);
      fetchDiscounts();
    } catch (error) {
      showToast(error.response?.data?.message || error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusInfo = (begin, end) => {
    const now = new Date();
    const start = parseISO(begin);
    const finish = parseISO(end);

    if (isAfter(now, finish)) return { label: "Đã kết thúc", color: "gray", status: "expired" };
    if (isBefore(now, start)) return { label: "Sắp diễn ra", color: "blue", status: "upcoming" };
    return { label: "Đang chạy", color: "emerald", status: "active" };
  };

  const filteredDiscounts = useMemo(() => {
    return discounts.filter(d => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm || d.name.toLowerCase().includes(searchLower) || (d.description && d.description.toLowerCase().includes(searchLower));

      const matchType = filterType === "all" || d.type === filterType;
      const matchScope = filterScope === "all" || d.scope === filterScope;

      const { status } = getStatusInfo(d.begin_date, d.end_date);
      const matchStatus = filterStatus === "all" || status === filterStatus;

      return matchSearch && matchType && matchScope && matchStatus;
    });
  }, [discounts, searchTerm, filterType, filterScope, filterStatus]);

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-7xl mx-auto space-y-6">

          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    Quản lý Khuyến mãi
                </h1>
                <p className="text-gray-500 text-sm mt-1">Thiết lập các chương trình giảm giá và ưu đãi.</p>
            </div>
            <button onClick={handleOpenCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm">
              <FiPlus size={20} /> Tạo Khuyến Mãi
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
                    {[
                        { id: 'all', label: 'Tất cả' },
                        { id: 'active', label: 'Đang chạy' },
                        { id: 'upcoming', label: 'Sắp tới' },
                        { id: 'expired', label: 'Đã hết' }
                    ].map(tab => (
                        <button key={tab.id} onClick={() => setFilterStatus(tab.id)} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${filterStatus === tab.id ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col lg:flex-row gap-4 justify-between">
                    <div className="relative w-full lg:w-96">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input
                            type="text"
                            placeholder="Tìm tên chương trình..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-1">
                        {/* Type Filter */}
                        <div className="relative min-w-[180px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">

                            </div>
                            <select
                                className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option value="all">Tất cả Loại</option>
                                {Object.entries(TYPE_MAP).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <FiChevronDown className="text-gray-400" size={16} />
                            </div>
                        </div>

                        <div className="relative min-w-[180px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">

                            </div>
                            <select
                                className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                                value={filterScope}
                                onChange={(e) => setFilterScope(e.target.value)}
                            >
                                <option value="all">Tất cả Phạm vi</option>
                                {Object.entries(SCOPE_MAP).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <FiChevronDown className="text-gray-400" size={16} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 bg-gray-50/50">
                    <th className="py-3 pl-4">Tên chương trình</th>
                    <th className="py-3 text-center">Mức giảm</th>
                    <th className="py-3">Thời gian áp dụng</th>
                    <th className="py-3">Loại & Phạm vi</th>
                    <th className="py-3 text-center">Trạng thái</th>
                    <th className="py-3 text-right pr-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                  {loading ? <tr><td colSpan="6" className="text-center py-8 text-gray-500">Đang tải dữ liệu...</td></tr> :
                   filteredDiscounts.length === 0 ? <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có khuyến mãi nào phù hợp.</td></tr> :
                   filteredDiscounts.map((d, index) => {
                    const statusInfo = getStatusInfo(d.begin_date, d.end_date);
                    const isEditable = statusInfo.status !== 'active';

                    return (
                      <tr key={d._id || index} className="border-b border-gray-50 hover:bg-gray-50 transition group align-top">

                        <td className="py-4 pl-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-600">
                                    <FiTag size={18} />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 line-clamp-1" title={d.name}>{d.name}</div>
                                    <div className="text-xs text-gray-500 line-clamp-1" title={d.description}>{d.description || "Không có mô tả"}</div>
                                </div>
                            </div>
                        </td>

                        <td className="py-4 text-center">
                            <div className="inline-flex items-center gap-1 font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md text-sm">
                                <FiPercent size={12}/> {d.percentage}
                            </div>
                        </td>

                        <td className="py-4 text-xs text-gray-600">
                            <div className="flex items-center gap-2 mb-1"><FiCalendar className="text-gray-400" size={14}/> {format(parseISO(d.begin_date), "dd/MM/yyyy")}</div>
                            <div className="flex items-center gap-2"><FiCalendar className="text-gray-400" size={14}/> {format(parseISO(d.end_date), "dd/MM/yyyy")}</div>
                        </td>

                        <td className="py-4 text-xs space-y-1">
                             <div className="font-medium text-gray-700">{TYPE_MAP[d.type]}</div>
                             <div className="text-indigo-600">{SCOPE_MAP[d.scope]}</div>
                        </td>

                        <td className="py-4 text-center">
                            <StatusPill
                                label={statusInfo.label}
                                color={statusInfo.color}
                                iconType={statusInfo.status === 'active' ? 'success' : 'neutral'}
                            />
                        </td>

                        <td className="py-4 text-right pr-4">
                            <div className="flex justify-end gap-2">
                                <button
                                    onClick={() => handleOpenEdit(d)}
                                    disabled={!isEditable}
                                    className={`p-2 rounded ${!isEditable ? 'text-gray-300 bg-gray-100 cursor-not-allowed' : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'}`}
                                    title={!isEditable ? "Không thể sửa khi đang chạy" : "Sửa thông tin"}
                                >
                                    <FiEdit size={16}/>
                                </button>
                                <button
                                    onClick={() => handleDeleteAction(d._id)}
                                    disabled={!isEditable}
                                    className={`p-2 rounded ${!isEditable ? 'text-gray-300 bg-gray-100 cursor-not-allowed' : 'text-red-500 bg-red-50 hover:bg-red-100'}`}
                                    title={!isEditable ? "Không thể xóa khi đang chạy" : "Xóa khuyến mãi"}
                                >
                                    <FiTrash2 size={16}/>
                                </button>
                            </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[600px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4 items-center border-b border-gray-100 pb-2">
                <h3 className="font-bold text-lg text-gray-800">{editingDiscount ? "Cập nhật Khuyến mãi" : "Tạo Khuyến mãi mới"}</h3>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="hover:bg-gray-100 p-1 rounded-full"><FiX size={24}/></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tên chương trình <span className="text-red-500">*</span></label>
                    <input type="text" required
                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                        placeholder="VD: Khuyến mãi mùa hè 2025"
                        value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                         <label className="block text-sm font-medium text-gray-700 mb-1">Phần trăm giảm (%) <span className="text-red-500">*</span></label>
                         <div className="relative">
                            <input type="number" min="1" max="100" required
                                className="w-full border border-gray-300 rounded-lg p-2.5 pl-8 outline-none focus:border-indigo-500 font-bold text-indigo-600"
                                value={formData.percentage} onChange={e => setFormData({...formData, percentage: e.target.value})} />
                            <FiPercent className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14}/>
                         </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Loại khuyến mãi</label>
                        <select className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                            value={formData.type} onChange={e => setFormData({...formData, type: e.target.value})}>
                            {Object.entries(TYPE_MAP).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu <span className="text-red-500">*</span></label>
                        <input type="date" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                            value={formData.begin_date} onChange={e => setFormData({...formData, begin_date: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày kết thúc <span className="text-red-500">*</span></label>
                        <input type="date" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                            value={formData.end_date} onChange={e => setFormData({...formData, end_date: e.target.value})} />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phạm vi áp dụng</label>
                    <select className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                        value={formData.scope} onChange={e => setFormData({...formData, scope: e.target.value})}>
                        {Object.entries(SCOPE_MAP).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả chi tiết</label>
                    <textarea
                        rows={3}
                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                        placeholder="Nhập điều kiện áp dụng, chi tiết chương trình..."
                        value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})}
                    />
                </div>

                <div className="pt-2">
                     <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full text-white py-3 rounded-lg font-bold transition shadow-lg flex items-center justify-center gap-2 ${submitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'}`}
                     >
                        {submitting ? (
                            <> <FiLoader className="animate-spin" /> Đang xử lý... </>
                        ) : (
                            editingDiscount ? "Cập nhật Chương trình" : "Tạo Chương trình"
                        )}
                     </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {confirmState.open && (
        <ConfirmModal
            open={confirmState.open}
            title={confirmState.title}
            message={confirmState.message}
            confirmText="Đồng ý Xóa"
            cancelText="Hủy bỏ"
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
        />
      )}

      {toast && (
        <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}