import React, { useState, useEffect, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  FiPlus, FiSearch, FiPhone, FiCreditCard, FiX, FiEdit, FiTrash2, FiLock, FiFilter, FiList, FiChevronDown, FiDollarSign, FiLoader,
  FiUserPlus, FiUserCheck, FiEye, FiEyeOff,
  FiChevronLeft, FiChevronRight
} from "react-icons/fi";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import Toast from "../../../components/toast.jsx";
import { employeeApi } from "../../api/employeeApi.js";
import { RankBadge, StatusPill } from "../../../components/ui/label.jsx";

const POSITION_MAP = {
  manager:          { label: "Quản lý", color: "purple" },
  receptionist:     { label: "Lễ tân", color: "blue" },
  technician:       { label: "Kỹ thuật", color: "gray" },
  customer_service: { label: "CSKH", color: "pink" },
  housekeeper:      { label: "Buồng phòng", color: "orange" }
};

const STATUS_MAP = {
  working: { label: "Đang làm việc", color: "emerald", icon: "success" },
  resign:  { label: "Đã nghỉ việc", color: "red", icon: "error" }
};

export default function EmployeePage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPosition, setFilterPosition] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortOrder, setSortOrder] = useState("a-z");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({
    open: false, title: "", message: "", onConfirm: null
  });
  const [accountModal, setAccountModal] = useState({
      open: false,
      type: "create",
      employee: null
    });
  const [accForm, setAccForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    email: "", password: "", full_name: "", date_birth: "",
    phone_number: "", CCCD: "", position: "receptionist",
    fixed_salary: "", status: "working"
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterPosition, filterStatus, sortOrder]);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await employeeApi.getAllEmployees();
      setEmployees(res.employees || []);
    } catch (error) { console.error(error); }
    finally { setLoading(false); }
  };

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormData({
      email: "", password: "", full_name: "", date_birth: "",
      phone_number: "", CCCD: "", position: "receptionist",
      fixed_salary: "", status: "working"
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp) => {
    setEditingEmployee(emp);
    setFormData({
      email: emp.user?.email || "",
      password: "",
      full_name: emp.full_name,
      date_birth: emp.date_birth ? format(parseISO(emp.date_birth), "yyyy-MM-dd") : "",
      phone_number: emp.phone_number,
      CCCD: emp.CCCD,
      position: emp.position,
      fixed_salary: emp.fixed_salary,
      status: emp.status
    });
    setIsModalOpen(true);
  };

  const handleResignAction = (id) => {
    setConfirmState({
      open: true,
      title: "Xác nhận nghỉ việc?",
      message: "Bạn có chắc muốn cập nhật trạng thái nhân viên này thành 'Đã nghỉ việc'? Họ sẽ không thể đăng nhập hệ thống nữa.",
      onConfirm: async () => {
        try {
          await employeeApi.updateEmployee(id, { status: 'resign' });
          showToast("Đã cập nhật trạng thái thành công.", "success");
          fetchEmployees();
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
      if (editingEmployee) {
        const payload = {
            position: formData.position,
            fixed_salary: formData.fixed_salary,
            status: formData.status
        };
        await employeeApi.updateEmployee(editingEmployee._id, payload);
        showToast("Cập nhật thông tin thành công!", "success");
      } else {
        await employeeApi.createEmployee(formData);
        showToast("Thêm nhân viên mới thành công!", "success");
      }
      setIsModalOpen(false);
      fetchEmployees();
    } catch (error) {
      showToast(error.response?.data?.message || error.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
  };
  const handleAccountClick = (emp) => {
      const hasAccount = !!emp.user_id;
      setAccForm({
          email: emp.user?.email ?? "",
          password: ""
      });
      setAccountModal({
          open: true,
          type: hasAccount ? "view" : "create",
          employee: emp
      });
      setShowPass(false);
    };

    const handleAccountSubmit = async (e) => {
      e.preventDefault();
      if (submitting) return;

      if (!accForm.email || (!accForm.password && accountModal.type === 'create')) {
          showToast("Vui lòng nhập đầy đủ thông tin", "error");
          return;
      }

      setSubmitting(true);
      try {
          if (accountModal.type === 'create') {
              await employeeApi.createAccountForExisting(accountModal.employee._id, accForm);
              showToast("Đã tạo tài khoản thành công!", "success");
          } else {
              if (accForm.password) {
                // console.log("Resetting password for employee ID with password:", accountModal.employee._id, accForm.password);
                  await employeeApi.resetPassword(accountModal.employee._id, accForm.password);
                  showToast("Đã cập nhật mật khẩu mới!", "success");
              } else {
                  showToast("Không có thay đổi nào.", "info");
              }
          }
          setAccountModal({ ...accountModal, open: false });
          fetchEmployees();
      } catch (error) {
          showToast(error.response?.data?.message || "Có lỗi xảy ra", "error");
      } finally {
          setSubmitting(false);
      }
    };

  const filteredEmployees = useMemo(() => {
    let result = employees.filter(e => {
      const matchPos = filterPosition === "all" || e.position === filterPosition;
      const matchStatus = filterStatus === "all" || e.status === filterStatus;

      const searchLower = searchTerm.toLowerCase();
      const matchSearch = !searchTerm ||
        e.full_name?.toLowerCase().includes(searchLower) ||
        e.phone_number?.includes(searchLower) ||
        e.CCCD?.includes(searchLower) ||
        e.user?.email?.toLowerCase().includes(searchLower);

      return matchPos && matchStatus && matchSearch;
    });

    result.sort((a, b) => {
        const nameA = a.full_name?.toLowerCase() || "";
        const nameB = b.full_name?.toLowerCase() || "";
        return sortOrder === "a-z" ? nameA.localeCompare(nameB, 'vi') : nameB.localeCompare(nameA, 'vi');
    });

    return result;
  }, [employees, filterPosition, filterStatus, searchTerm, sortOrder]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentEmployees = filteredEmployees.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredEmployees.length / itemsPerPage);

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

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                     Quản lý Nhân viên
                </h1>
                <p className="text-gray-500 text-sm mt-1">Danh sách nhân viên và phân quyền hệ thống.</p>
            </div>
            <button onClick={handleOpenCreate} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm">
              <FiPlus size={20} /> Thêm Nhân viên
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[500px]">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
                    <button onClick={() => setFilterPosition('all')} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${filterPosition === 'all' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Tất cả</button>
                    {Object.keys(POSITION_MAP).map(key => (
                        <button key={key} onClick={() => setFilterPosition(key)} className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${filterPosition === key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {POSITION_MAP[key].label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-col lg:flex-row gap-4 justify-between">
                    <div className="relative w-full lg:w-96">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input
                            type="text"
                            placeholder="Tìm tên, email, SĐT..."
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-1">
                        <div className="relative min-w-[180px]">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiFilter className="text-gray-500" size={16} />
                            </div>
                            <select
                                className="appearance-none w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 focus:outline-none focus:border-indigo-500 focus:ring-0 cursor-pointer hover:border-indigo-300 transition shadow-sm"
                                value={filterStatus}
                                onChange={(e) => setFilterStatus(e.target.value)}
                            >
                                <option value="all">Tất cả Trạng thái</option>
                                <option value="working">Đang làm việc</option>
                                <option value="resign">Đã nghỉ việc</option>
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

            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 bg-gray-50/50">
                    <th className="py-3 pl-4">Nhân viên</th>
                    <th className="py-3">Liên hệ</th>
                    <th className="py-3 text-center">Tài khoản</th>
                    <th className="py-3 text-center">Chức vụ</th>
                    <th className="py-3">Lương cơ bản</th>
                    <th className="py-3 text-center">Trạng thái</th>
                    <th className="py-3 text-right pr-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                  {loading ? <tr><td colSpan="6" className="text-center py-8 text-gray-500">Đang tải dữ liệu...</td></tr> :
                   currentEmployees.length === 0 ? <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có nhân viên nào phù hợp.</td></tr> :
                   currentEmployees.map((e, index) => {
                    const key = e._id || index;
                    const position = POSITION_MAP[e.position] || POSITION_MAP.receptionist;
                    const status = STATUS_MAP[e.status] || STATUS_MAP.working;
                    const isResign = e.status === 'resign';

                    return (
                      <tr key={key} className={`border-b border-gray-50 hover:bg-gray-50 transition group align-top ${isResign ? 'opacity-60 bg-gray-50' : ''}`}>

                        <td className="py-4 pl-4">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isResign ? 'bg-gray-200 text-gray-500' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {e.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{e.full_name}</div>
                                    <div className="text-xs text-gray-500">{e.user?.email || "No Email"}</div>
                                </div>
                            </div>
                        </td>

                        <td className="py-4">
                            <div className="flex flex-col gap-1 text-xs">
                                <span className="flex items-center gap-2 font-medium text-gray-700"><FiPhone size={14}/> {e.phone_number}</span>
                                <span className="flex items-center gap-2 text-gray-500"><FiCreditCard size={14}/> {e.CCCD}</span>
                            </div>
                        </td>

                        <td className="py-4 text-center">
                            {e.user_id ? (
                                <button
                                    onClick={() => handleAccountClick(e)}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-green-50 text-green-700 rounded-full text-xs font-bold hover:bg-green-100 border border-green-200"
                                >
                                    <FiUserCheck size={14} /> Đã cấp
                                </button>
                            ) : (
                                <button
                                    onClick={() => handleAccountClick(e)}
                                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-bold hover:bg-indigo-50 hover:text-indigo-600 border border-gray-200 hover:border-indigo-200 transition-colors"
                                >
                                    <FiUserPlus size={14} /> Tạo TK
                                </button>
                            )}
                        </td>

                        <td className="py-4 text-center">
                            <RankBadge label={position.label} color={position.color} width="w-28" />
                        </td>

                        <td className="py-4 font-medium text-gray-700">
                            {formatCurrency(e.fixed_salary || 0)}
                        </td>

                        <td className="py-4 text-center">
                            <StatusPill
                                label={status.label}
                                color={status.color}
                                iconType={status.icon}
                            />
                        </td>

                        <td className="py-4 text-right pr-4">
                            <div className="flex justify-end gap-2">
                                <button onClick={() => handleOpenEdit(e)} className="p-2 text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100" title="Sửa thông tin">
                                    <FiEdit size={16}/>
                                </button>
                                {!isResign ? (
                                    <button onClick={() => handleResignAction(e._id)} className="p-2 text-red-500 bg-red-50 rounded hover:bg-red-100" title="Cho nghỉ việc">
                                        <FiTrash2 size={16}/>
                                    </button>
                                ) : (
                                    <button className="p-2 text-gray-400 bg-gray-100 rounded cursor-not-allowed" title="Đã nghỉ việc">
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

            {filteredEmployees.length > 0 && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                    <div className="text-sm text-gray-500">
                        Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredEmployees.length)}</b> trong tổng <b>{filteredEmployees.length}</b>
                    </div>
                    {renderPaginationButtons()}
                </div>
            )}

          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[700px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4 items-center border-b border-gray-100 pb-2">
                <h3 className="font-bold text-lg text-gray-800">{editingEmployee ? "Cập nhật Nhân viên" : "Thêm Nhân viên mới"}</h3>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="hover:bg-gray-100 p-1 rounded-full"><FiX size={24}/></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {!editingEmployee && (
                    <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100 grid grid-cols-2 gap-4">
                        <div className="col-span-2 text-xs font-bold text-indigo-700 uppercase">Thông tin tài khoản đăng nhập</div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                            <input type="email" required
                                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                                value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu <span className="text-red-500">*</span></label>
                            <input type="password" required
                                className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                                value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Họ và Tên <span className="text-red-500">*</span></label>
                        <input type="text" required
                            disabled={!!editingEmployee}
                            className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${editingEmployee ? 'bg-gray-100 cursor-not-allowed' : 'focus:border-indigo-500'}`}
                            value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh <span className="text-red-500">*</span></label>
                        <input type="date" required
                            disabled={!!editingEmployee}
                            className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${editingEmployee ? 'bg-gray-100 cursor-not-allowed' : 'focus:border-indigo-500'}`}
                            value={formData.date_birth} onChange={e => setFormData({...formData, date_birth: e.target.value})} />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại <span className="text-red-500">*</span></label>
                        <input type="text" required
                            disabled={!!editingEmployee}
                            className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${editingEmployee ? 'bg-gray-100 cursor-not-allowed' : 'focus:border-indigo-500'}`}
                            value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">CCCD / CMND <span className="text-red-500">*</span></label>
                        <input type="text" required
                            disabled={!!editingEmployee}
                            className={`w-full border border-gray-300 rounded-lg p-2.5 outline-none ${editingEmployee ? 'bg-gray-100 cursor-not-allowed' : 'focus:border-indigo-500'}`}
                            value={formData.CCCD} onChange={e => setFormData({...formData, CCCD: e.target.value})} />
                    </div>
                </div>

                <div className="border-t border-gray-200 pt-4 mt-2">
                    <div className="text-xs font-bold text-gray-500 uppercase mb-3">Thông tin công việc (Có thể chỉnh sửa)</div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Vị trí</label>
                            <select className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})}>
                                {Object.keys(POSITION_MAP).map(key => (
                                    <option key={key} value={key}>{POSITION_MAP[key].label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Lương cơ bản (VND)</label>
                            <div className="relative">
                                <input type="number" required
                                    className="w-full pl-8 pr-3 py-2.5 border border-gray-300 rounded-lg outline-none focus:border-indigo-500"
                                    value={formData.fixed_salary} onChange={e => setFormData({...formData, fixed_salary: e.target.value})} />
                                <FiDollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16}/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                            <select className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                                value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}>
                                <option value="working">Đang làm việc</option>
                                <option value="resign">Đã nghỉ việc</option>
                            </select>
                        </div>
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
                            editingEmployee ? "Lưu Thay Đổi" : "Tạo Nhân Viên Mới"
                        )}
                     </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {accountModal.open && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[450px] shadow-2xl">
          <div className="flex justify-between mb-4 items-center border-b border-gray-100 pb-2">
              <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                  {accountModal.type === 'create' ? "Tạo tài khoản" : "Cài đặt tài khoản"}
              </h3>
              <button onClick={() => setAccountModal({ ...accountModal, open: false })} className="hover:bg-gray-100 p-1 rounded-full"><FiX size={24}/></button>
          </div>

          <form onSubmit={handleAccountSubmit} className="space-y-4">
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" required disabled={accountModal.type === 'view'}
                      className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 disabled:bg-gray-100"
                      value={accForm.email} onChange={e => setAccForm({...accForm, email: e.target.value})}
                  />
              </div>
              <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                      {accountModal.type === 'create' ? "Mật khẩu khởi tạo" : "Đặt lại mật khẩu mới"}
                  </label>
                  <div className="relative">
                      <input type={showPass ? "text" : "password"} required={accountModal.type === 'create'}
                          className="w-full border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500"
                          value={accForm.password} onChange={e => setAccForm({...accForm, password: e.target.value})} placeholder={accountModal.type === 'view' ? "Để trống nếu không đổi" : ""}
                      />
                      <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                          {showPass ? <FiEyeOff/> : <FiEye/>}
                      </button>
                  </div>
              </div>
              <button type="submit" disabled={submitting} className="w-full text-white py-3 rounded-lg font-bold bg-indigo-600 hover:bg-indigo-700 mt-2">
                  {submitting ? "Đang xử lý..." : "Xác nhận"}
              </button>
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