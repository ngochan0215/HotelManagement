import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  FiPlus, FiSearch, FiTag, FiCalendar, FiPercent, FiEdit, FiTrash2, FiChevronDown, FiLoader, FiX, FiDollarSign, FiHash, FiEye, FiInfo,
  FiChevronLeft, FiChevronRight
} from "react-icons/fi";

import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import Toast from "../../../components/toast.jsx";
import { StatusPill } from "../../../components/ui/label.jsx";
import { discountApi } from "../../api/discountApi.js";
import { roomApi } from "../../api/roomApi.js";

const DISCOUNT_TYPE_MAP = {
  PERCENT: "Phần trăm",
  FIXED: "Số tiền cố định"
};

const RULE_TYPE_MAP = {
  NONE: "Không có điều kiện",
  MIN_BOOKING_VALUE: "Giá trị đơn hàng tối thiểu",
  FIRST_BOOKING: "Đặt phòng lần đầu",
  SEASONAL: "Theo mùa",
  HOLIDAY: "Ngày lễ"
};

const CUSTOMER_TIER_MAP = {
  bronze: "Đồng",
  silver: "Bạc",
  gold: "Vàng",
  platinum: "Bạch kim",
};

const DAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

export default function DiscountPage() {
  const [discounts, setDiscounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingDiscount, setViewingDiscount] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const [toast, setToast] = useState(null);

  const [confirmState, setConfirmState] = useState({
    open: false, title: "", message: "", onConfirm: null
  });

  const [editingDiscount, setEditingDiscount] = useState(null);
  const [roomCategories, setRoomCategories] = useState([]);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    description: "",
    discount: {
      type: "PERCENT",
      value: 10,
      max_discount: null
    },
    conditions: {
      rule_type: "NONE",
      min_order_value: null,
      days_of_week: [],
      hours_range: {
        from: null,
        to: null
      },
      customer_tiers: [],
      room_category_ids: []
    },
    begin_date: "",
    end_date: "",
    priority: 1
  });

  useEffect(() => {
    fetchDiscounts();
    fetchRoomCategories();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterType, filterStatus]);

  const fetchRoomCategories = async () => {
    try {
      const data = await roomApi.getAllCategories();
      setRoomCategories(data || []);
    } catch (error) {
      console.error("Lỗi tải danh sách loại phòng:", error);
      setRoomCategories([]);
    }
  };

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
    const today = format(new Date(), "yyyy-MM-dd");
    setFormData({
      code: "",
      name: "",
      description: "",
      discount: {
        type: "PERCENT",
        value: 10,
        max_discount: null
      },
      conditions: {
        rule_type: "NONE",
        min_order_value: null,
        days_of_week: [],
        hours_range: {
          from: null,
          to: null
        },
        customer_tiers: [],
        room_category_ids: []
      },
      begin_date: today,
      end_date: today,
      priority: 1
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (discount) => {
    setEditingDiscount(discount);
    setFormData({
      code: discount.code || "",
      name: discount.name || "",
      description: discount.description || "",
      discount: {
        type: discount.discount?.type || "PERCENT",
        value: discount.discount?.value || 10,
        max_discount: discount.discount?.max_discount || null
      },
      conditions: {
        rule_type: discount.conditions?.rule_type || "NONE",
        min_order_value: discount.conditions?.min_order_value || null,
        days_of_week: discount.conditions?.days_of_week || [],
        hours_range: discount.conditions?.hours_range || { from: null, to: null },
        customer_tiers: discount.conditions?.customer_tiers || [],
        room_category_ids: discount.conditions?.room_category_ids?.map(id => String(id)) || []
      },
      begin_date: discount.begin_date ? format(parseISO(discount.begin_date), "yyyy-MM-dd") : "",
      end_date: discount.end_date ? format(parseISO(discount.end_date), "yyyy-MM-dd") : "",
      priority: discount.priority || 1
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
      // Chuẩn bị dữ liệu để gửi
      const submitData = {
        code: formData.code.trim().toUpperCase(),
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        discount: {
          type: formData.discount.type,
          value: Number(formData.discount.value),
          max_discount: formData.discount.type === "PERCENT" && formData.discount.max_discount
            ? Number(formData.discount.max_discount)
            : undefined
        },
        begin_date: formData.begin_date,
        end_date: formData.end_date,
        priority: Number(formData.priority) || 1
      };

      const conditions = { rule_type: formData.conditions.rule_type };
      if (formData.conditions.rule_type === "MIN_BOOKING_VALUE" && formData.conditions.min_order_value) {
        conditions.min_order_value = Number(formData.conditions.min_order_value);
      }
      if (formData.conditions.days_of_week && formData.conditions.days_of_week.length > 0) {
        conditions.days_of_week = formData.conditions.days_of_week;
      }
      if (formData.conditions.hours_range?.from != null && formData.conditions.hours_range?.to != null) {
        conditions.hours_range = {
          from: Number(formData.conditions.hours_range.from),
          to: Number(formData.conditions.hours_range.to)
        };
      }
      if (formData.conditions.customer_tiers && formData.conditions.customer_tiers.length > 0) {
        conditions.customer_tiers = formData.conditions.customer_tiers;
      }
      if (formData.conditions.room_category_ids && formData.conditions.room_category_ids.length > 0) {
        conditions.room_category_ids = formData.conditions.room_category_ids;
      }

      if (Object.keys(conditions).length > 1 || conditions.rule_type !== "NONE") {
        submitData.conditions = conditions;
      }

      if (editingDiscount) {
        await discountApi.updateDiscount(editingDiscount._id, submitData);
        showToast("Cập nhật khuyến mãi thành công!", "success");
      } else {
        await discountApi.createDiscount(submitData);
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

  const getStatusInfo = (discount) => {
    if (discount.status) {
      const statusMap = {
        upcoming: { label: "Sắp diễn ra", color: "blue", status: "upcoming" },
        ongoing: { label: "Đang chạy", color: "emerald", status: "active" },
        finished: { label: "Đã kết thúc", color: "gray", status: "expired" }
      };
      return statusMap[discount.status] || statusMap.upcoming;
    }

    const now = new Date();
    const begin = discount.begin_date ? parseISO(discount.begin_date) : null;
    const end = discount.end_date ? parseISO(discount.end_date) : null;

    if (!begin || !end) return { label: "Không xác định", color: "gray", status: "unknown" };

    if (now > end) return { label: "Đã kết thúc", color: "gray", status: "expired" };
    if (now < begin) return { label: "Sắp diễn ra", color: "blue", status: "upcoming" };
    return { label: "Đang chạy", color: "emerald", status: "active" };
  };

  const formatDiscountValue = (discount) => {
    if (!discount || !discount.type) return "N/A";
    if (discount.type === "PERCENT") {
      return `${discount.value}%${discount.max_discount ? ` (tối đa ${discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`;
    }
    return `${discount.value.toLocaleString("vi-VN")}đ`;
  };

  const formatConditions = (conditions) => {
    if (!conditions || !conditions.rule_type || conditions.rule_type === "NONE") {
      // Kiểm tra xem có điều kiện nào khác không
      const hasOtherConditions = 
        (conditions?.min_order_value) ||
        (conditions?.days_of_week && conditions.days_of_week.length > 0) ||
        (conditions?.hours_range?.from != null && conditions?.hours_range?.to != null) ||
        (conditions?.customer_tiers && conditions.customer_tiers.length > 0) ||
        (conditions?.room_category_ids && conditions.room_category_ids.length > 0);
      
      if (!hasOtherConditions) {
        return "Áp dụng cho tất cả";
      }
    }
    
    const parts = [];
    if (conditions.rule_type && conditions.rule_type !== "NONE") {
      parts.push(RULE_TYPE_MAP[conditions.rule_type] || conditions.rule_type);
    }
    if (conditions.min_order_value) {
      parts.push(`Tối thiểu ${conditions.min_order_value.toLocaleString("vi-VN")}đ`);
    }
    if (conditions.days_of_week && conditions.days_of_week.length > 0) {
      const days = conditions.days_of_week.map(d => DAY_NAMES[d]).join(", ");
      parts.push(`Ngày: ${days}`);
    }
    if (conditions.hours_range?.from != null && conditions.hours_range?.to != null) {
      parts.push(`Giờ: ${conditions.hours_range.from}:00 - ${conditions.hours_range.to}:00`);
    }
    if (conditions.customer_tiers && conditions.customer_tiers.length > 0) {
      const tiers = conditions.customer_tiers.map(t => CUSTOMER_TIER_MAP[t] || t).join(", ");
      parts.push(`Hạng: ${tiers}`);
    }
    if (conditions.room_category_ids && conditions.room_category_ids.length > 0) {
      const categoryNames = conditions.room_category_ids
        .map(id => {
          const category = roomCategories.find(cat => String(cat._id) === String(id));
          return category?.category_name || id;
        })
        .join(", ");
      parts.push(`Loại phòng: ${categoryNames}`);
    }
    
    return parts.length > 0 ? parts.join(" | ") : "Áp dụng cho tất cả";
  };

  const filteredDiscounts = useMemo(() => {
    return discounts.filter(d => {
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm ||
        d.name?.toLowerCase().includes(searchLower) ||
        d.code?.toLowerCase().includes(searchLower) ||
        (d.description && d.description.toLowerCase().includes(searchLower));

      const matchType = filterType === "all" || d.discount?.type === filterType;

      const statusInfo = getStatusInfo(d);
      const matchStatus = filterStatus === "all" || statusInfo.status === filterStatus;

      return matchSearch && matchType && matchStatus;
    });
  }, [discounts, searchTerm, filterType, filterStatus]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentDiscounts = filteredDiscounts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredDiscounts.length / itemsPerPage);

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
                            placeholder="Tìm theo tên, mã khuyến mãi..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-1">
                        <div className="relative min-w-[180px]">
                            <select
                                className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                            >
                                <option value="all">Tất cả Loại</option>
                                {Object.entries(DISCOUNT_TYPE_MAP).map(([key, label]) => (
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
                    <th className="py-3 pl-4">Mã & Tên</th>
                    <th className="py-3 text-center">Mức giảm</th>
                    <th className="py-3">Thời gian</th>
                    <th className="py-3 text-center">Trạng thái</th>
                    <th className="py-3 text-right pr-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                  {loading ? <tr><td colSpan="7" className="text-center py-8 text-gray-500">Đang tải dữ liệu...</td></tr> :
                   currentDiscounts.length === 0 ? <tr><td colSpan="7" className="text-center py-8 text-gray-400 italic">Chưa có khuyến mãi nào phù hợp.</td></tr> :
                   currentDiscounts.map((d, index) => {
                    const statusInfo = getStatusInfo(d);
                    const isEditable = statusInfo.status !== 'active';

                    return (
                      <tr key={d._id || index} className="border-b border-gray-50 hover:bg-gray-50 transition group align-top">

                        <td className="py-4 pl-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center bg-indigo-50 text-indigo-600">
                                    <FiTag size={18} />
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900 line-clamp-1" title={d.name}>
                                      {d.code && <span className="text-indigo-600 font-mono text-xs mr-2">{d.code}</span>}
                                      {d.name}
                                    </div>
                                    <div className="text-xs text-gray-500 line-clamp-1" title={d.description}>{d.description || "Không có mô tả"}</div>
                                </div>
                            </div>
                        </td>

                        <td className="py-4 text-center">
                            <div className="inline-flex items-center gap-1 font-bold text-red-500 bg-red-50 px-2 py-1 rounded-md text-sm">
                                {d.discount?.type === "PERCENT" ? <FiPercent size={12}/> : <FiDollarSign size={12}/>}
                                {formatDiscountValue(d.discount)}
                            </div>
                        </td>

                        <td className="py-4 text-xs text-gray-600">
                            <div className="flex items-center gap-2 mb-1">
                              <FiCalendar className="text-gray-400" size={14}/>
                              {d.begin_date ? format(parseISO(d.begin_date), "dd/MM/yyyy") : "N/A"}
                            </div>
                            <div className="flex items-center gap-2">
                              <FiCalendar className="text-gray-400" size={14}/>
                              {d.end_date ? format(parseISO(d.end_date), "dd/MM/yyyy") : "N/A"}
                            </div>
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
                                  onClick={() => {
                                    setViewingDiscount(d);
                                    setIsDetailModalOpen(true);
                                  }}
                                  className="p-1.5 rounded text-indigo-600 bg-indigo-50 hover:bg-indigo-100 transition flex-shrink-0"
                                  title="Xem chi tiết điều kiện"
                                >
                                  <FiEye size={14}/>
                                </button>
                                <button
                                    onClick={() => handleOpenEdit(d)}
                                    className="p-2 rounded text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                                    title="Sửa thông tin"
                                >
                                    <FiEdit size={16}/>
                                </button>
                                <button
                                    onClick={() => handleDeleteAction(d._id)}
                                    className="p-2 rounded text-red-500 bg-red-50 hover:bg-red-100"
                                    title="Xóa khuyến mãi"
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

            {filteredDiscounts.length > 0 && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                    <div className="text-sm text-gray-500">
                        Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredDiscounts.length)}</b> trong tổng <b>{filteredDiscounts.length}</b>
                    </div>
                    {renderPaginationButtons()}
                </div>
            )}

          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-4xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                        <FiTag className="text-white" size={20}/>
                    </div>
                    <h3 className="font-bold text-xl text-gray-800">{editingDiscount ? "Cập nhật Khuyến mãi" : "Tạo Khuyến mãi mới"}</h3>
                </div>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="hover:bg-white/80 p-2 rounded-full transition"><FiX size={24} className="text-gray-600"/></button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Section 1: Thông tin cơ bản */}
                <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                            <FiInfo className="text-white" size={16}/>
                        </div>
                        <h4 className="font-bold text-lg text-gray-800">Thông tin cơ bản</h4>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Mã khuyến mãi <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 font-mono uppercase bg-white"
                                    placeholder="VD: SUMMER2025"
                                    value={formData.code}
                                    onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                />
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Tên chương trình <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    required
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                    placeholder="VD: Khuyến mãi mùa hè 2025"
                                    value={formData.name}
                                    onChange={e => setFormData({...formData, name: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-200">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả</label>
                            <textarea
                                rows={3}
                                className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white resize-none"
                                placeholder="Nhập mô tả chi tiết về chương trình khuyến mãi..."
                                value={formData.description}
                                onChange={e => setFormData({...formData, description: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* Section 2: Thông tin giảm giá */}
                <div className="bg-red-50/50 rounded-xl p-5 border border-red-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                            <FiPercent className="text-white" size={16}/>
                        </div>
                        <h4 className="font-bold text-lg text-gray-800">Thông tin giảm giá</h4>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3 border border-red-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Loại giảm giá <span className="text-red-500">*</span></label>
                                <select
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white font-medium"
                                    value={formData.discount.type}
                                    onChange={e => setFormData({
                                        ...formData,
                                        discount: { ...formData.discount, type: e.target.value, max_discount: e.target.value === "FIXED" ? null : formData.discount.max_discount }
                                    })}
                                >
                                    {Object.entries(DISCOUNT_TYPE_MAP).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-red-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {formData.discount.type === "PERCENT" ? "Phần trăm (%)" : "Số tiền (đ)"} <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        max={formData.discount.type === "PERCENT" ? "100" : undefined}
                                        required
                                        className="w-full border-2 border-gray-200 rounded-lg p-2.5 pl-10 outline-none focus:border-indigo-500 font-bold text-red-600 bg-white"
                                        value={formData.discount.value}
                                        onChange={e => setFormData({
                                            ...formData,
                                            discount: { ...formData.discount, value: e.target.value }
                                        })}
                                    />
                                    {formData.discount.type === "PERCENT" ? (
                                        <FiPercent className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                    ) : (
                                        <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                    )}
                                </div>
                            </div>
                        </div>
                        {formData.discount.type === "PERCENT" && (
                            <div className="bg-white rounded-lg p-3 border border-red-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Số tiền giảm tối đa (đ) <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        min="1"
                                        required
                                        className="w-full border-2 border-gray-200 rounded-lg p-2.5 pl-10 outline-none focus:border-indigo-500 bg-white"
                                        placeholder="VD: 100000"
                                        value={formData.discount.max_discount || ""}
                                        onChange={e => setFormData({
                                            ...formData,
                                            discount: { ...formData.discount, max_discount: e.target.value || null }
                                        })}
                                    />
                                    <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Section 3: Điều kiện áp dụng */}
                <div className="bg-green-50/50 rounded-xl p-5 border border-green-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                            <FiInfo className="text-white" size={16}/>
                        </div>
                        <h4 className="font-bold text-lg text-gray-800">Điều kiện áp dụng</h4>
                    </div>
                    <div className="space-y-4">
                        <div className="bg-white rounded-lg p-3 border border-green-200">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Loại điều kiện</label>
                            <select
                                className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white font-medium"
                                value={formData.conditions.rule_type}
                                onChange={e => setFormData({
                                    ...formData,
                                    conditions: { ...formData.conditions, rule_type: e.target.value }
                                })}
                            >
                                {Object.entries(RULE_TYPE_MAP).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>

                        {formData.conditions.rule_type === "MIN_BOOKING_VALUE" && (
                            <div className="bg-white rounded-lg p-3 border border-green-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Giá trị đơn hàng tối thiểu (đ)</label>
                                <input
                                    type="number"
                                    min="0"
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                    placeholder="VD: 500000"
                                    value={formData.conditions.min_order_value || ""}
                                    onChange={e => setFormData({
                                        ...formData,
                                        conditions: { ...formData.conditions, min_order_value: e.target.value || null }
                                    })}
                                />
                            </div>
                        )}

                        <div className="bg-white rounded-lg p-3 border border-green-200">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Ngày trong tuần áp dụng
                                <span className="text-xs text-gray-500 ml-2 font-normal">(Không chọn = áp dụng mọi ngày)</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {DAY_NAMES.map((day, index) => (
                                    <label key={index} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.conditions.days_of_week.includes(index)}
                                            onChange={e => {
                                                const newDays = e.target.checked
                                                    ? [...formData.conditions.days_of_week, index]
                                                    : formData.conditions.days_of_week.filter(d => d !== index);
                                                setFormData({
                                                    ...formData,
                                                    conditions: { ...formData.conditions, days_of_week: newDays }
                                                });
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">{day}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg p-3 border border-green-200">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Khung giờ áp dụng
                                <span className="text-xs text-gray-500 ml-2 font-normal">(Để trống = áp dụng mọi giờ)</span>
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Giờ bắt đầu (0-23)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                    placeholder="VD: 9"
                                    value={formData.conditions.hours_range?.from || ""}
                                    onChange={e => setFormData({
                                        ...formData,
                                        conditions: {
                                            ...formData.conditions,
                                            hours_range: {
                                                ...formData.conditions.hours_range,
                                                from: e.target.value ? Number(e.target.value) : null
                                            }
                                        }
                                    })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Giờ kết thúc (0-23)</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                    placeholder="VD: 18"
                                    value={formData.conditions.hours_range?.to || ""}
                                    onChange={e => setFormData({
                                        ...formData,
                                        conditions: {
                                            ...formData.conditions,
                                            hours_range: {
                                                ...formData.conditions.hours_range,
                                                to: e.target.value ? Number(e.target.value) : null
                                            }
                                        }
                                    })}
                                />
                            </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg p-3 border border-green-200">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Hạng khách hàng áp dụng
                                <span className="text-xs text-gray-500 ml-2 font-normal">(Không chọn = áp dụng cho tất cả)</span>
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(CUSTOMER_TIER_MAP).map(([key, label]) => (
                                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.conditions.customer_tiers.includes(key)}
                                            onChange={e => {
                                                const newTiers = e.target.checked
                                                    ? [...formData.conditions.customer_tiers, key]
                                                    : formData.conditions.customer_tiers.filter(t => t !== key);
                                                setFormData({
                                                    ...formData,
                                                    conditions: { ...formData.conditions, customer_tiers: newTiers }
                                                });
                                            }}
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className="text-sm text-gray-700">{label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg p-3 border border-green-200">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Loại phòng áp dụng
                                <span className="text-xs text-gray-500 ml-2 font-normal">(Không chọn = áp dụng cho tất cả loại phòng)</span>
                            </label>
                            <div className="max-h-40 overflow-y-auto border-2 border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                                {roomCategories.length === 0 ? (
                                    <p className="text-sm text-gray-500">Đang tải danh sách loại phòng...</p>
                                ) : (
                                    roomCategories.map((category) => (
                                        <label key={category._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                                            <input
                                                type="checkbox"
                                                checked={formData.conditions.room_category_ids.includes(String(category._id))}
                                                onChange={e => {
                                                    const categoryId = String(category._id);
                                                    const newCategories = e.target.checked
                                                        ? [...formData.conditions.room_category_ids, categoryId]
                                                        : formData.conditions.room_category_ids.filter(id => id !== categoryId);
                                                    setFormData({
                                                        ...formData,
                                                        conditions: { ...formData.conditions, room_category_ids: newCategories }
                                                    });
                                                }}
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                            <span className="text-sm text-gray-700 flex-1">
                                                {category.category_name}
                                                {category.price && (
                                                    <span className="text-xs text-gray-500 ml-2">
                                                        ({category.price.toLocaleString("vi-VN")}đ)
                                                    </span>
                                                )}
                                            </span>
                                        </label>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Section 4: Thời gian & Ưu tiên */}
                <div className="bg-purple-50/50 rounded-xl p-5 border border-purple-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                            <FiCalendar className="text-white" size={16}/>
                        </div>
                        <h4 className="font-bold text-lg text-gray-800">Thời gian & Ưu tiên</h4>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày bắt đầu <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    required
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                    value={formData.begin_date}
                                    onChange={e => setFormData({...formData, begin_date: e.target.value})}
                                />
                            </div>
                            <div className="bg-white rounded-lg p-3 border border-purple-200">
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Ngày kết thúc <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    required
                                    className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                    value={formData.end_date}
                                    onChange={e => setFormData({...formData, end_date: e.target.value})}
                                />
                            </div>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-purple-200">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Độ ưu tiên (số càng cao càng ưu tiên)</label>
                            <input
                                type="number"
                                min="1"
                                className="w-full border-2 border-gray-200 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                value={formData.priority}
                                onChange={e => setFormData({...formData, priority: e.target.value})}
                            />
                        </div>
                    </div>
                </div>

                {/* Submit Button */}
                <div className="pt-4 border-t border-gray-200">
                     <button
                        type="submit"
                        disabled={submitting}
                        className={`w-full text-white py-3.5 rounded-xl font-bold transition shadow-lg flex items-center justify-center gap-2 ${submitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-indigo-200'}`}
                     >
                        {submitting ? (
                            <> <FiLoader className="animate-spin" /> Đang xử lý... </>
                        ) : (
                            editingDiscount ? "Cập nhật Khuyến mãi" : "Tạo Khuyến mãi"
                        )}
                     </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Xem Chi Tiết */}
      {isDetailModalOpen && viewingDiscount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                        <FiEye className="text-white" size={20}/>
                    </div>
                    <div>
                        <h3 className="font-bold text-xl text-gray-800">Chi tiết Khuyến mãi</h3>
                        <p className="text-sm text-gray-500">{viewingDiscount.code}</p>
                    </div>
                </div>
                <button onClick={() => setIsDetailModalOpen(false)} className="hover:bg-white/80 p-2 rounded-full transition">
                    <FiX size={24} className="text-gray-600"/>
                </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Thông tin cơ bản */}
                <div className="bg-blue-50/50 rounded-xl p-5 border border-blue-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
                            <FiInfo className="text-white" size={16}/>
                        </div>
                        <h4 className="font-bold text-lg text-gray-800">Thông tin cơ bản</h4>
                    </div>
                    <div className="space-y-3">
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <div className="text-xs text-gray-500 mb-1">Mã khuyến mãi</div>
                            <div className="font-mono font-bold text-indigo-600 text-lg">{viewingDiscount.code}</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                            <div className="text-xs text-gray-500 mb-1">Tên chương trình</div>
                            <div className="font-semibold text-gray-800 text-lg">{viewingDiscount.name}</div>
                        </div>
                        {viewingDiscount.description && (
                            <div className="bg-white rounded-lg p-4 border border-blue-200">
                                <div className="text-xs text-gray-500 mb-1">Mô tả</div>
                                <div className="text-gray-700">{viewingDiscount.description}</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Thông tin giảm giá */}
                <div className="bg-red-50/50 rounded-xl p-5 border border-red-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center">
                            <FiPercent className="text-white" size={16}/>
                        </div>
                        <h4 className="font-bold text-lg text-gray-800">Thông tin giảm giá</h4>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-red-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Loại giảm giá:</span>
                            <span className="font-semibold text-gray-800">{DISCOUNT_TYPE_MAP[viewingDiscount.discount?.type] || "N/A"}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Giá trị:</span>
                            <span className="font-bold text-red-600 text-lg">
                                {viewingDiscount.discount?.type === "PERCENT"
                                    ? `${viewingDiscount.discount?.value}%`
                                    : `${viewingDiscount.discount?.value?.toLocaleString("vi-VN")}đ`
                                }
                            </span>
                        </div>
                        {viewingDiscount.discount?.max_discount && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                <span className="text-sm text-gray-600">Giảm tối đa:</span>
                                <span className="font-semibold text-gray-800">{viewingDiscount.discount.max_discount.toLocaleString("vi-VN")}đ</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Điều kiện áp dụng */}
                <div className="bg-green-50/50 rounded-xl p-5 border border-green-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center">
                            <FiInfo className="text-white" size={16}/>
                        </div>
                        <h4 className="font-bold text-lg text-gray-800">Điều kiện áp dụng</h4>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-green-200 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Loại điều kiện:</span>
                            <span className="font-semibold text-gray-800">
                                {RULE_TYPE_MAP[viewingDiscount.conditions?.rule_type] || "Không có"}
                            </span>
                        </div>

                        {viewingDiscount.conditions?.min_order_value && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                <span className="text-sm text-gray-600">Giá trị đơn hàng tối thiểu:</span>
                                <span className="font-semibold text-gray-800">
                                    {viewingDiscount.conditions.min_order_value.toLocaleString("vi-VN")}đ
                                </span>
                            </div>
                        )}

                        {viewingDiscount.conditions?.days_of_week && viewingDiscount.conditions.days_of_week.length > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                                <div className="text-sm text-gray-600 mb-2">Ngày trong tuần:</div>
                                <div className="flex flex-wrap gap-2">
                                    {viewingDiscount.conditions.days_of_week.map(day => (
                                        <span key={day} className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
                                            {DAY_NAMES[day]}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {viewingDiscount.conditions?.hours_range?.from != null && viewingDiscount.conditions?.hours_range?.to != null && (
                            <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                                <span className="text-sm text-gray-600">Khung giờ:</span>
                                <span className="font-semibold text-gray-800">
                                    {viewingDiscount.conditions.hours_range.from}:00 - {viewingDiscount.conditions.hours_range.to}:00
                                </span>
                            </div>
                        )}

                        {viewingDiscount.conditions?.customer_tiers && viewingDiscount.conditions.customer_tiers.length > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                                <div className="text-sm text-gray-600 mb-2">Hạng khách hàng:</div>
                                <div className="flex flex-wrap gap-2">
                                    {viewingDiscount.conditions.customer_tiers.map(tier => (
                                        <span key={tier} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                                            {CUSTOMER_TIER_MAP[tier] || tier}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {viewingDiscount.conditions?.room_category_ids && viewingDiscount.conditions.room_category_ids.length > 0 && (
                            <div className="pt-2 border-t border-gray-200">
                                <div className="text-sm text-gray-600 mb-2">Loại phòng:</div>
                                <div className="flex flex-wrap gap-2">
                                    {viewingDiscount.conditions.room_category_ids.map(catId => {
                                        const category = roomCategories.find(cat => String(cat._id) === String(catId));
                                        return (
                                            <span key={catId} className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                                {category?.category_name || catId}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {(!viewingDiscount.conditions ||
                          (!viewingDiscount.conditions.min_order_value &&
                           (!viewingDiscount.conditions.days_of_week || viewingDiscount.conditions.days_of_week.length === 0) &&
                           (!viewingDiscount.conditions.hours_range || !viewingDiscount.conditions.hours_range.from) &&
                           (!viewingDiscount.conditions.customer_tiers || viewingDiscount.conditions.customer_tiers.length === 0) &&
                           (!viewingDiscount.conditions.room_category_ids || viewingDiscount.conditions.room_category_ids.length === 0) &&
                           viewingDiscount.conditions.rule_type === "NONE")) && (
                            <div className="text-center py-4 text-gray-500 italic">
                                Áp dụng cho tất cả (không có điều kiện)
                            </div>
                        )}
                    </div>
                </div>

                {/* Thời gian & Ưu tiên */}
                <div className="bg-purple-50/50 rounded-xl p-5 border border-purple-100">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="w-8 h-8 rounded-lg bg-purple-500 flex items-center justify-center">
                            <FiCalendar className="text-white" size={16}/>
                        </div>
                        <h4 className="font-bold text-lg text-gray-800">Thời gian & Ưu tiên</h4>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-purple-200 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Ngày bắt đầu</div>
                                <div className="font-semibold text-gray-800">
                                    {viewingDiscount.begin_date ? format(parseISO(viewingDiscount.begin_date), "dd/MM/yyyy") : "N/A"}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-gray-500 mb-1">Ngày kết thúc</div>
                                <div className="font-semibold text-gray-800">
                                    {viewingDiscount.end_date ? format(parseISO(viewingDiscount.end_date), "dd/MM/yyyy") : "N/A"}
                                </div>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Độ ưu tiên:</span>
                                <span className="font-bold text-indigo-600 text-lg">{viewingDiscount.priority || 1}</span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-gray-200">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-600">Trạng thái:</span>
                                <StatusPill
                                    label={getStatusInfo(viewingDiscount).label}
                                    color={getStatusInfo(viewingDiscount).color}
                                    iconType={getStatusInfo(viewingDiscount).status === 'active' ? 'success' : 'neutral'}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
                <button
                    onClick={() => {
                        setIsDetailModalOpen(false);
                        handleOpenEdit(viewingDiscount);
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition flex items-center gap-2"
                >
                    <FiEdit size={16}/>
                    Chỉnh sửa
                </button>
                <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition"
                >
                    Đóng
                </button>
            </div>
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