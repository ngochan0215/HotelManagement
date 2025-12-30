import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  FiPlus, FiSearch, FiUser, FiPhone, FiMapPin, FiCreditCard, FiX, FiMail, FiEdit, FiTrash2, FiLock, FiFilter, FiList, FiChevronDown, FiStar, FiLoader
} from "react-icons/fi";

import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";
import ConfirmModal from "../../../components/confirmModal";
import Toast from "../../../components/toast";
import { customerApi } from "../../api/customerApi";

const LOYALTY_MAP = {
  bronze: { label: "Đồng", color: "bg-orange-50 text-orange-700 border-orange-200" },
  silver: { label: "Bạc", color: "bg-gray-50 text-gray-700 border-gray-200" },
  gold: { label: "Vàng", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  platinum: { label: "Bạch Kim", color: "bg-purple-50 text-purple-700 border-purple-200" }
};

const COUNTRIES = [
  "Vietnam", "USA", "UK", "Japan", "South Korea", "China",
  "France", "Germany", "Australia", "Canada", "Singapore", "Thailand", "Other"
];

export default function CustomerPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterLoyalty, setFilterLoyalty] = useState("all");
  const [filterNationality, setFilterNationality] = useState("all");
  const [sortOrder, setSortOrder] = useState("a-z");

  const [toast, setToast] = useState(null);

  const [confirmState, setConfirmState] = useState({
    open: false, title: "", message: "", onConfirm: null
  });

  const [editingCustomer, setEditingCustomer] = useState(null);

  const [formData, setFormData] = useState({
    email: "", full_name: "", date_birth: "",
    phone_number: "", nationality: "Vietnam", CCCD: ""
  });

  useEffect(() => {
    fetchCustomers();
  }, []);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const res = await customerApi.getAllCustomers();
      setCustomers(res.customers || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingCustomer(null);
    setFormData({
      email: "", full_name: "", date_birth: "",
      phone_number: "", nationality: "Vietnam", CCCD: ""
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      email: customer.user_id?.email || "",
      full_name: customer.full_name,
      date_birth: customer.date_birth ? format(parseISO(customer.date_birth), "yyyy-MM-dd") : "",
      phone_number: customer.phone_number,
      nationality: customer.nationality || "Vietnam",
      CCCD: customer.CCCD
    });
    setIsModalOpen(true);
  };

  const handleDeleteAction = (id) => {
    setConfirmState({
      open: true,
      title: "Khóa tài khoản khách hàng?",
      message: "Bạn có chắc muốn KHÓA khách hàng này không? Họ sẽ không thể đặt phòng mới.",
      onConfirm: async () => {
        try {
          await customerApi.deleteCustomer(id);
          showToast("Đã khóa khách hàng thành công.", "success");
          fetchCustomers();
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
      if (editingCustomer) {
        const payload = { ...formData };
        await customerApi.updateCustomer(editingCustomer._id, payload);
        showToast("Cập nhật thông tin thành công!", "success");
      } else {
        const randomPart = Math.floor(1000 + Math.random() * 9000);
        const autoPassword = `Customer@${randomPart}`;
        const payload = { ...formData, password: autoPassword };
        await customerApi.createCustomer(payload);
        showToast("Thêm khách hàng mới thành công!", "success");
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (error) {
      showToast(error.response?.data?.message || error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    let result = customers.filter(c => {
      const matchLoyalty = filterLoyalty === "all" || c.loyalty === filterLoyalty;
      const matchNation = filterNationality === "all" || c.nationality === filterNationality;
      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm ||
        c.full_name?.toLowerCase().includes(searchLower) ||
        c.phone_number?.includes(searchLower) ||
        c.CCCD?.includes(searchLower);
      return matchLoyalty && matchNation && matchSearch;
    });

    result.sort((a, b) => {
        const nameA = a.full_name?.toLowerCase() || "";
        const nameB = b.full_name?.toLowerCase() || "";
        return sortOrder === "a-z" ? nameA.localeCompare(nameB, 'vi') : nameB.localeCompare(nameA, 'vi');
    });

    return result;
  }, [customers, filterLoyalty, filterNationality, searchTerm, sortOrder]);

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-7xl mx-auto space-y-6">

          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                    Quản lý Khách hàng
                </h1>
                <p className="text-gray-500 text-sm mt-1">Lưu trữ thông tin khách lưu trú.</p>
            </div>
            <button onClick={handleOpenCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm">
              <FiPlus size={20} /> Thêm Khách Mới
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
                    {['all', 'bronze', 'silver', 'gold', 'platinum'].map(l => (
                        <button key={l} onClick={() => setFilterLoyalty(l)} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${filterLoyalty === l ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {l === 'all' ? 'Tất cả' : LOYALTY_MAP[l]?.label}
                        </button>
                    ))}
                </div>

                {/* Filter & Search */}
                <div className="flex flex-col lg:flex-row gap-4 justify-between">
                    <div className="relative w-full lg:w-96">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input
                            type="text"
                            placeholder="Tìm tên, SĐT, CCCD..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-1">
                        <div className="relative min-w-[200px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiFilter className="text-gray-500" size={16} />
                            </div>
                            <select
                                className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                                value={filterNationality}
                                onChange={(e) => setFilterNationality(e.target.value)}
                            >
                                <option value="all">Tất cả Quốc tịch</option>
                                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <FiChevronDown className="text-gray-400" size={16} />
                            </div>
                        </div>

                        <div className="relative min-w-[160px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiList className="text-gray-500" size={16} />
                            </div>
                            <select
                                className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                                value={sortOrder}
                                onChange={(e) => setSortOrder(e.target.value)}
                            >
                                <option value="a-z">Tên: A - Z</option>
                                <option value="z-a">Tên: Z - A</option>
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
                    <th className="py-3 pl-4">Họ và Tên</th>
                    <th className="py-3">Liên hệ</th>
                    <th className="py-3">Thông tin định danh</th>
                    <th className="py-3 text-center">Hạng & Điểm</th>
                    <th className="py-3 text-center">Trạng thái</th>
                    <th className="py-3 text-right pr-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                  {loading ? <tr><td colSpan="6" className="text-center py-8 text-gray-500">Đang tải dữ liệu...</td></tr> :
                   filteredCustomers.length === 0 ? <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có khách hàng phù hợp.</td></tr> :
                   filteredCustomers.map((c, index) => {
                    const key = c._id || index;
                    const loyalty = LOYALTY_MAP[c.loyalty] || LOYALTY_MAP.bronze;
                    const isActive = c.status === 'active';

                    return (
                      <tr key={key} className={`border-b border-gray-50 hover:bg-gray-50 transition group align-top ${!isActive ? 'opacity-60 bg-gray-50' : ''}`}>

                        <td className="py-4 pl-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-200 text-gray-500'}`}>
                                    {c.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{c.full_name}</div>
                                    <div className="text-xs text-gray-500">{c.user_id?.email || "No Email"}</div>
                                </div>
                            </div>
                        </td>

                        <td className="py-4">
                            <div className="flex flex-col gap-1">
                                <span className="flex items-center gap-2 font-medium text-gray-700"><FiPhone className="text-gray-400" size={14}/> {c.phone_number}</span>
                            </div>
                        </td>

                        <td className="py-4 text-xs text-gray-600 space-y-1">
                            <div className="flex items-center gap-2"><FiCreditCard size={14}/> {c.CCCD}</div>
                            <div className="flex items-center gap-2"><FiMapPin size={14}/> {c.nationality}</div>
                        </td>

                        <td className="py-4 text-center">
                            <div className="flex flex-col items-center gap-1">
                                <span className={`inline-block w-24 py-1 text-xs font-bold uppercase rounded border ${loyalty.color}`}>
                                    {loyalty.label}
                                </span>
                                <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                    <FiStar className="text-yellow-500" size={12}/>
                                    {c.points ? c.points.toLocaleString() : 0} điểm
                                </div>
                            </div>
                        </td>

                        <td className="py-4 text-center">
                            <span className={`inline-block w-24 py-1 text-xs font-bold rounded border ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                {isActive ? 'Active' : 'Locked'}
                            </span>
                        </td>

                        <td className="py-4 text-right pr-4">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenEdit(c)} className="p-2 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100" title="Sửa thông tin">
                                    <FiEdit size={16}/>
                                </button>
                                {isActive ? (
                                    <button onClick={() => handleDeleteAction(c._id)} className="p-2 text-red-500 bg-red-50 rounded hover:bg-red-100" title="Khóa khách hàng">
                                        <FiLock size={16}/>
                                    </button>
                                ) : (
                                    <button className="p-2 text-gray-400 bg-gray-100 rounded cursor-not-allowed" title="Đã khóa">
                                        <FiLock size={16}/>
                                    </button>
                                )}
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
                <h3 className="font-bold text-lg text-gray-800">{editingCustomer ? "Cập nhật Khách hàng" : "Thêm Khách hàng mới"}</h3>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="hover:bg-gray-100 p-1 rounded-full"><FiX size={24}/></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                    <input type="email" required
                        className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                        placeholder="VD: khachhang@gmail.com"
                        value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Họ và Tên <span className="text-red-500">*</span></label>
                    <input type="text" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                        value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                        <input type="text" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                            value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CCCD / CMND <span className="text-red-500">*</span></label>
                        <input type="text" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                            value={formData.CCCD} onChange={e => setFormData({...formData, CCCD: e.target.value})} />
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh <span className="text-red-500">*</span></label>
                        <input type="date" required className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                            value={formData.date_birth} onChange={e => setFormData({...formData, date_birth: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Quốc tịch</label>
                        <select className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                            value={formData.nationality} onChange={e => setFormData({...formData, nationality: e.target.value})}>
                            {COUNTRIES.map((nation) => (<option key={nation} value={nation}>{nation}</option>))}
                        </select>
                    </div>
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
                            editingCustomer ? "Lưu Thay Đổi" : "Lưu Thông Tin"
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
            confirmText="Đồng ý"
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