import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, parseISO } from "date-fns";
import {
  FiPlus, FiSearch, FiPhone, FiMapPin, FiCreditCard, FiX, FiEdit, FiLock, FiFilter, FiList, FiChevronDown, FiStar, FiLoader,
  FiChevronLeft, FiChevronRight, FiCamera, FiUpload
} from "react-icons/fi";
import { Html5Qrcode } from "html5-qrcode";

import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import Toast from "../../../components/toast.jsx";
import { customerApi } from "../../api/customerApi.js";
import { RankBadge , StatusPill} from "../../../components/ui/label.jsx";

const LOYALTY_MAP = {
  bronze:   { label: "Đồng", color: "orange" },
  silver:   { label: "Bạc", color: "gray" },
  gold:     { label: "Vàng", color: "yellow" },
  platinum: { label: "Bạch Kim", color: "purple" }
};

const COUNTRIES = [
  "Vietnam", "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria", "Azerbaijan",
  "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi",
  "Cabo Verde", "Cambodia", "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo", "Costa Rica", "Croatia", "Cuba", "Cyprus", "Czech Republic",
  "Denmark", "Djibouti", "Dominica", "Dominican Republic",
  "East Timor", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France",
  "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea", "Guinea-Bissau", "Guyana",
  "Haiti", "Honduras", "Hungary",
  "Iceland", "India", "Indonesia", "Iran", "Iraq", "Ireland", "Israel", "Italy", "Ivory Coast",
  "Jamaica", "Japan", "Jordan",
  "Kazakhstan", "Kenya", "Kiribati", "Korea, North", "Korea, South", "Kosovo", "Kuwait", "Kyrgyzstan",
  "Laos", "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg",
  "Madagascar", "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia", "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar",
  "Namibia", "Nauru", "Nepal", "Netherlands", "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Macedonia", "Norway",
  "Oman",
  "Pakistan", "Palau", "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal",
  "Qatar",
  "Romania", "Russia", "Rwanda",
  "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino", "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia", "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Sudan", "Spain", "Sri Lanka", "Sudan", "Suriname", "Sweden", "Switzerland", "Syria",
  "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu",
  "Uganda", "Ukraine", "United Arab Emirates", "United Kingdom", "United States", "Uruguay", "Uzbekistan",
  "Vanuatu", "Vatican City", "Venezuela", "Yemen",
  "Zambia", "Zimbabwe"
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

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [toast, setToast] = useState(null);

  const [confirmState, setConfirmState] = useState({
    open: false, title: "", message: "", onConfirm: null
  });

  const [editingCustomer, setEditingCustomer] = useState(null);

  const [formData, setFormData] = useState({
    email: "", full_name: "", date_birth: "",
    phone_number: "", nationality: "Vietnam", CCCD: ""
  });

  // QR / ID scan states
  const [qrScanning, setQrScanning] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const html5QrCodeRef = useRef(null);
  const scanTimeoutRef = useRef(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Init camera QR scanner once overlay is shown
  useEffect(() => {
    if (!showQrScanner || !qrScanning || html5QrCodeRef.current) return;
    const timer = setTimeout(() => {
      const el = document.getElementById("cust-qr-reader");
      if (!el || html5QrCodeRef.current) return;
      try {
        const scanner = new Html5Qrcode("cust-qr-reader");
        html5QrCodeRef.current = scanner;
        scanTimeoutRef.current = setTimeout(() => {
          showToast("Chưa quét được mã QR. Vui lòng kiểm tra ánh sáng.", "info");
        }, 15000);
        scanner.start(
          { facingMode: "environment" },
          { fps: 15, qrbox: { width: 280, height: 280 } },
          async (decoded) => {
            if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
            await handleQRScanned(decoded, null);
            await scanner.stop();
            setQrScanning(false);
            setShowQrScanner(false);
            html5QrCodeRef.current = null;
          },
          () => {}
        ).catch((err) => {
          setQrError(err.message || "Không thể khởi động camera");
          setQrScanning(false);
          setShowQrScanner(false);
          showToast("Không thể khởi động camera. Vui lòng tải ảnh lên.", "error");
        });
      } catch (err) {
        setQrError(err.message || "Lỗi khởi tạo scanner");
        setQrScanning(false);
        setShowQrScanner(false);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [showQrScanner, qrScanning]);

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) html5QrCodeRef.current.stop().catch(() => {});
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterLoyalty, filterNationality]);

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
      email: customer.user?.email || "",
      full_name: customer.full_name,
      date_birth: customer.date_birth ? format(parseISO(customer.date_birth), "yyyy-MM-dd") : "",
      phone_number: customer.phone_number,
      nationality: customer.nationality || "Vietnam",
      CCCD: customer.CCCD
    });
    setIsModalOpen(true);
  };

  const stopQRScanner = async () => {
    if (html5QrCodeRef.current) {
      await html5QrCodeRef.current.stop().catch(() => {});
      html5QrCodeRef.current = null;
    }
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
    setQrScanning(false);
    setShowQrScanner(false);
  };

  const startQRScanning = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ video: true });
      setQrError(null);
      setShowQrScanner(true);
      setQrScanning(true);
    } catch {
      showToast("Không thể truy cập camera. Vui lòng tải ảnh lên.", "error");
    }
  };

  const handleQRFileUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("Vui lòng chọn file ảnh.", "error"); return; }
    if (file.size > 5 * 1024 * 1024) { showToast("File quá lớn (tối đa 5MB).", "error"); return; }
    await handleQRScanned(null, file);
  };

  const handleQRScanned = async (decodedText = null, imageFile = null) => {
    try {
      setQrLoading(true);
      setQrError(null);

      let result;
      if (imageFile) {
        result = await customerApi.scanQRCode(imageFile);
      } else if (decodedText) {
        // Try to parse raw QR text from Vietnamese CCCD chip
        try {
          const parts = decodedText.split("|");
          if (parts.length >= 7) {
            result = {
              success: true,
              data: { cccd: parts[0], fullName: parts[2], dateOfBirth: parts[3] }
            };
          }
        } catch { /* fall through */ }
        if (!result) result = await customerApi.scanQRCode(new Blob([decodedText]));
      }

      if (result?.success && result.data) {
        const d = result.data;
        const updated = { ...formData };
        if (d.cccd) updated.CCCD = d.cccd;
        if (d.fullName) updated.full_name = d.fullName;
        if (d.dateOfBirth) {
          let dob = d.dateOfBirth.trim();
          if (/^\d{8}$/.test(dob)) {
            dob = `${dob.substring(4, 8)}-${dob.substring(2, 4)}-${dob.substring(0, 2)}`;
          } else if (dob.includes("/")) {
            const p = dob.split("/");
            if (p.length === 3) dob = `${p[2]}-${p[1].padStart(2,"0")}-${p[0].padStart(2,"0")}`;
          }
          updated.date_birth = dob;
        }
        setFormData(updated);
        showToast("Đã đọc thông tin từ căn cước thành công!", "success");
      } else {
        throw new Error(result?.message || "Không thể đọc thông tin từ ảnh.");
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || "Có lỗi xảy ra khi xử lý ảnh.";
      setQrError(msg);
      showToast(msg, "error");
    } finally {
      setQrLoading(false);
    }
  };

  const handleDeleteAction = (id) => {
    setConfirmState({
      open: true,
      title: "Khóa tài khoản khách hàng?",
      message: "Bạn có chắc muốn KHÓA khách hàng này không? Họ sẽ không thể đặt phòng mới.",
      onConfirm: async () => {
        setConfirmState(prev => ({ ...prev, open: false }));
        // Optimistic update
        setCustomers(prev => prev.map(c => c._id === id ? { ...c, status: "banned" } : c));
        try {
          await customerApi.banCustomer(id);
          showToast("Đã khóa khách hàng thành công.", "success");
        } catch (error) {
          // Rollback on failure
          fetchCustomers();
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
        await customerApi.updateCustomer(editingCustomer._id, { ...formData });
        // Optimistic update
        setCustomers(prev => prev.map(c =>
          c._id === editingCustomer._id
            ? { ...c, ...formData, user: { ...(c.user || {}), email: formData.email } }
            : c
        ));
        showToast("Cập nhật thông tin thành công!", "success");
      } else {
        const autoPassword = `Customer@${Math.floor(1000 + Math.random() * 9000)}`;
        await customerApi.registerCustomer({ ...formData, password: autoPassword });
        // Optimistic prepend with known data; background fetch will replace with server data
        const optimistic = {
          _id: `pending-${Date.now()}`,
          full_name: formData.full_name,
          phone_number: formData.phone_number,
          CCCD: formData.CCCD,
          nationality: formData.nationality,
          date_birth: formData.date_birth,
          points: 10, loyalty: "bronze", status: "active", booking_count: 0,
          user: { email: formData.email }
        };
        setCustomers(prev => [optimistic, ...prev]);
        showToast("Thêm khách hàng mới thành công!", "success");
      }
      setIsModalOpen(false);
      fetchCustomers(); // background sync to get real _id and complete data
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

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentCustomers = filteredCustomers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);

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
  // ----------------------------------------------

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

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[500px]">
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


            <div className="overflow-x-auto flex-1">
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
                   currentCustomers.length === 0 ? <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có khách hàng phù hợp.</td></tr> :
                   currentCustomers.map((c, index) => {
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
                                    <div className="text-xs text-gray-500">{c.user?.email || "No Email"}</div>
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
                                <RankBadge label={loyalty.label} color={loyalty.color} />
                                <div className="text-xs font-medium text-gray-500 flex items-center gap-1">
                                    <FiStar className="text-yellow-500" size={12}/>
                                    {c.points ? c.points.toLocaleString() : 0} điểm
                                </div>
                            </div>
                        </td>

                        <td className="py-4 text-center">
                            <StatusPill
                                label={isActive ? 'Hoạt động' : 'Đã khóa'}
                                color={isActive ? 'emerald' : 'red'}
                                iconType={isActive ? 'success' : 'error'}
                            />
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

            {filteredCustomers.length > 0 && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                    <div className="text-sm text-gray-500">
                        Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredCustomers.length)}</b> trong tổng <b>{filteredCustomers.length}</b>
                    </div>
                    {renderPaginationButtons()}
                </div>
            )}
          </div>
        </div>
      </div>


      {/* Camera QR scanner overlay — above the modal */}
      {showQrScanner && (
        <div className="fixed inset-0 bg-black/75 z-[60] flex flex-col items-center justify-center">
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl w-[360px]">
            <div className="flex justify-between w-full items-center">
              <span className="font-bold text-gray-800">Đưa căn cước vào khung</span>
              <button type="button" onClick={stopQRScanner} className="p-1 rounded-full hover:bg-gray-100"><FiX size={20}/></button>
            </div>
            <div id="cust-qr-reader" style={{ width: "300px", minHeight: "300px" }} />
            <p className="text-xs text-gray-500 text-center">Đặt mã QR trên căn cước công dân vào vùng quét</p>
            <button type="button" onClick={stopQRScanner} className="w-full py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm font-medium">
              Hủy
            </button>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl w-[600px] shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between mb-4 items-center border-b border-gray-100 pb-2">
                <h3 className="font-bold text-lg text-gray-800">{editingCustomer ? "Cập nhật Khách hàng" : "Thêm Khách hàng mới"}</h3>
                <button onClick={() => !submitting && setIsModalOpen(false)} className="hover:bg-gray-100 p-1 rounded-full"><FiX size={24}/></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                {/* QR scan section — create mode only */}
                {!editingCustomer && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-600">Nhập thông tin nhanh từ ảnh căn cước:</p>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={startQRScanning}
                        disabled={qrLoading}
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <FiCamera size={16}/> Quét QR căn cước
                      </button>
                      <label className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition text-sm font-medium cursor-pointer ${qrLoading ? "opacity-50 cursor-not-allowed pointer-events-none" : ""}`}>
                        <FiUpload size={16}/> Tải ảnh căn cước
                        <input type="file" accept="image/*" className="hidden" onChange={handleQRFileUpload} disabled={qrLoading} />
                      </label>
                    </div>
                    {qrLoading && (
                      <div className="flex items-center gap-2 text-indigo-600 text-sm bg-indigo-50 rounded-lg px-3 py-2">
                        <FiLoader className="animate-spin" size={15}/> Đang xử lý ảnh căn cước...
                      </div>
                    )}
                    {qrError && (
                      <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                        {qrError}
                      </div>
                    )}
                    <div className="border-t border-gray-100 pt-2" />
                  </div>
                )}

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