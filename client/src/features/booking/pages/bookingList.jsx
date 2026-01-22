import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays, setHours, setMinutes } from "date-fns";
import {
  FiPlus, FiX, FiTrash2, FiSearch, FiCheckCircle, FiLogOut, FiUser,
  FiUserPlus, FiUsers, FiTag, FiLogIn, FiMinusCircle, FiCheckSquare, FiSquare,
  FiCalendar, FiMapPin, FiAlertTriangle, FiCamera, FiUpload
} from "react-icons/fi";
import { jwtDecode } from "jwt-decode";
import { Html5Qrcode } from "html5-qrcode";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import Toast from "../../../components/toast.jsx";
import { StatusPill } from "../../../components/ui/label.jsx";
import { bookingApi } from "../../api/bookingApi.js";
import { roomApi } from "../../api/roomApi.js";
import { customerApi } from "../../api/customerApi.js";
import { receiptApi } from "../../api/receiptApi.js";
import { qrApi } from "../../api/qrApi.js";
import { useAuth } from "../../auth/hooks/authContext.jsx";

const STATUS_MAP = {
  pending:     { label: "Chờ cọc", color: "yellow" },
  confirmed:   { label: "Đã cọc",  color: "blue" },
  in_progress: { label: "Đang ở",  color: "indigo" },
  completed:   { label: "Hoàn tất",color: "emerald" },
  cancelled:   { label: "Đã hủy",  color: "red" },
  expired:     { label: "Hết hạn", color: "gray" },
};

const CANCELLATION_REASONS = [
  { value: "change_plan", label: "Thay đổi lịch trình" },
  { value: "price_issue", label: "Giá không phù hợp" },
  { value: "found_better_option", label: "Tìm được chỗ khác" },
  { value: "personal_reason", label: "Lý do cá nhân" },
  { value: "no_show", label: "Khách không đến (No-show)" },
  { value: "overbooking", label: "Hết phòng (Overbooking)" },
  { value: "force_majeure", label: "Bất khả kháng (Thiên tai, dịch bệnh)" },
  { value: "other", label: "Khác" },
];

export default function BookingList() {
  const { user } = useAuth();


  const [bookings, setBookings] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [customerMode, setCustomerMode] = useState("existing");
  const [custSearchQuery, setCustSearchQuery] = useState("");
  const [showCustDropdown, setShowCustDropdown] = useState(false);
  const [selectedCustDisplay, setSelectedCustDisplay] = useState(null);
  const dropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    customer_id: "",
    adults: 1,
    children: 0,
    expected_checkin: "",
    expected_checkout: "",
    deposit: 0
  });
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [tempRoomId, setTempRoomId] = useState("");
  const [isWalkIn, setIsWalkIn] = useState(false);
  const [rawPrice, setRawPrice] = useState({ total: 0, deposit: 0 });
  const [appliedDiscounts, setAppliedDiscounts] = useState([]);
  const [isPreviewLocked, setIsPreviewLocked] = useState(false);
  const [promotionName, setPromotionName] = useState("");
  const [calcValues, setCalcValues] = useState({ total_price: 0, deposit_required: 0 });
  const [newCustomer, setNewCustomer] = useState({
    email: "", full_name: "", phone_number: "", date_birth: "", nationality: "Vietnam", CCCD: ""
  });

  // QR Scanner states
  const [qrScanning, setQrScanning] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);
  const [toast, setToast] = useState(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const html5QrCodeRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const scanAttemptsRef = useRef(0);

  const [confirmState, setConfirmState] = useState({
      open: false, title: "", message: "", confirmText: "Đồng ý", type: "danger", onConfirm: null
  });

  const [cancelModal, setCancelModal] = useState({
    open: false,
    bookingId: null,
    reason: "change_plan",
    loading: false
  });

  useEffect(() => {
    fetchData();
    const handleClickOutside = (event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setShowCustDropdown(false);
        }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      // Cleanup QR scanner
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
    };
  }, []);

  // useEffect để khởi tạo scanner sau khi modal được render
  useEffect(() => {
    if (showQrScanner && qrScanning && !html5QrCodeRef.current) {
      const timer = setTimeout(() => {
        const element = document.getElementById("qr-reader-modal");
        if (element && !html5QrCodeRef.current) {
          try {
            const html5QrCode = new Html5Qrcode("qr-reader-modal");
            html5QrCodeRef.current = html5QrCode;
            
            scanTimeoutRef.current = setTimeout(() => {
              setToast({ 
                message: "Chưa quét được mã QR. Vui lòng kiểm tra ánh sáng và khoảng cách.", 
                type: "info" 
              });
            }, 15000);

            html5QrCode.start(
              { facingMode: "environment" },
              { fps: 15, qrbox: { width: 300, height: 300 } },
              async (decodedText) => {
                if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
                await handleQRScanned(decodedText);
                await html5QrCode.stop();
                setQrScanning(false);
                setShowQrScanner(false);
                html5QrCodeRef.current = null;
              },
              () => {
                scanAttemptsRef.current++;
              }
            ).catch((err) => {
              console.error("Error starting QR scanner:", err);
              setQrError(err.message || "Không thể khởi động camera");
              setQrScanning(false);
              setShowQrScanner(false);
              setToast({ message: "Không thể khởi động camera. Vui lòng thử tải ảnh lên.", type: "error" });
            });
          } catch (err) {
            console.error("Error creating Html5Qrcode:", err);
            setQrError(err.message || "Không thể khởi tạo scanner");
            setQrScanning(false);
            setShowQrScanner(false);
          }
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showQrScanner, qrScanning]);

  useEffect(() => {
    if (isModalOpen) {
      fetchAvailableRooms(formData.expected_checkin, formData.expected_checkout);
    }
  }, [formData.expected_checkin, formData.expected_checkout, formData.adults, formData.children, isModalOpen]);

  useEffect(() => {
    if (isPreviewLocked) return;
    const total = selectedRooms.reduce((sum, r) => sum + r.price, 0);
    const deposit = isWalkIn ? 0 : (total * 0.3);
    setCalcValues({ total_price: total, deposit_required: deposit });
    setFormData(prev => ({...prev, deposit: deposit}));
  }, [selectedRooms, isWalkIn, isPreviewLocked]);


  const fetchData = async () => {
    try {
      const [bookRes, roomRes, custRes] = await Promise.all([
        bookingApi.getAllBookings(),
        roomApi.getAllRooms(),
        customerApi.getAllCustomers()
      ]);
      setBookings(Array.isArray(bookRes.result) ? bookRes.result : []);
      setCustomersList(custRes.customers || []);
    } catch (error) { console.error(error); }
  };

  const fetchAvailableRooms = async (checkin, checkout) => {
    if (!checkin || !checkout) return;
    try {
      const res = await roomApi.getAvailableBy({
        checkin, checkout, adults: formData.adults, children: formData.children,
      });
      const flatRooms = res.flatMap(c => c.rooms.map(r => ({
          _id: r.room_id || r._id, room_number: r.room_number, category_name: c.name || c.category_name, price: c.price
        }))
      );
      setRoomsList(flatRooms);
    } catch (err) { setRoomsList([]); }
  };

  const handleAutoApplyDiscount = async () => {
    if (!formData.customer_id) return alert("Vui lòng chọn khách hàng trước");
    if (!selectedRooms.length) return alert("Vui lòng chọn ít nhất 1 phòng");
    try {
        const payload = {
            customer_id: formData.customer_id,
            expected_checkin: formData.expected_checkin,
            expected_checkout: formData.expected_checkout,
            rooms: selectedRooms.map(r => ({
                room_id: r._id, expected_checkin: formData.expected_checkin, expected_checkout: formData.expected_checkout, base_fee: r.price
            }))
        };
        const res = await bookingApi.previewBooking(payload);
        const { base_total, final_total, deposit, discounts } = res;
        const rawDeposit = isWalkIn ? 0 : Math.round(base_total * 0.3);
        setRawPrice({ total: base_total, deposit: rawDeposit });
        setCalcValues({ total_price: final_total, deposit_required: isWalkIn ? 0 : deposit });
        setFormData(prev => ({ ...prev, deposit: isWalkIn ? 0 : deposit }));
        setAppliedDiscounts(discounts);
        setPromotionName(discounts && discounts.length ? discounts.map(d => d.name).join(", ") : "Không có khuyến mãi phù hợp");
        setIsPreviewLocked(true);
    } catch (err) { alert(err.response?.data?.message || "Không thể áp dụng khuyến mãi"); }
  };

  const handleUndoDiscount = () => {
    setCalcValues({ total_price: rawPrice.total, deposit_required: rawPrice.deposit });
    setFormData(prev => ({ ...prev, deposit: rawPrice.deposit }));
    setAppliedDiscounts([]); setPromotionName(""); setIsPreviewLocked(true);
  };

  const handleAddRoom = () => {
      setIsPreviewLocked(false); setPromotionName(""); setAppliedDiscounts([]);
      if (!tempRoomId) return;
      const roomToAdd = roomsList.find(r => r._id === tempRoomId);
      if (roomToAdd && !selectedRooms.some(r => r._id === roomToAdd._id)) {
          setSelectedRooms([...selectedRooms, roomToAdd]);
      }
      setTempRoomId("");
  };

  const handleRemoveRoom = (roomId) => {
      setIsPreviewLocked(false); setPromotionName(""); setAppliedDiscounts([]);
      setSelectedRooms(selectedRooms.filter(r => r._id !== roomId));
  };

  const handleOpenModal = () => {
    const now = new Date();
    const checkin = setMinutes(setHours(now, 14), 0);
    const checkout = setMinutes(setHours(addDays(now, 1), 12), 0);
    setFormData({ customer_id: "", adults: 1, children: 0, expected_checkin: format(checkin, "yyyy-MM-dd'T'HH:mm"), expected_checkout: format(checkout, "yyyy-MM-dd'T'HH:mm"), deposit: 0 });
    setSelectedRooms([]); setTempRoomId(""); setPromotionName(""); setAppliedDiscounts([]); setIsWalkIn(false); setIsPreviewLocked(false); setCalcValues({ total_price: 0, deposit_required: 0 });
    setNewCustomer({ email: "", full_name: "", phone_number: "", date_birth: "", nationality: "Vietnam", CCCD: "" });
    setCustomerMode("existing"); setCustSearchQuery(""); setSelectedCustDisplay(null); setShowCustDropdown(false);
    setShowQrScanner(false); setQrScanning(false); setQrError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (new Date(formData.expected_checkout) <= new Date(formData.expected_checkin)) return alert("Ngày check-out phải sau ngày check-in!");

      let employeeId = user?._id;
      if (!employeeId && user?.token) {
          try { employeeId = jwtDecode(user.token).userId; } catch (err) {}
      }
      if (!employeeId) return alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại!");
      if (selectedRooms.length === 0) return alert("Vui lòng chọn ít nhất một phòng!");

      let finalCustomerId = formData.customer_id;
      if (customerMode === "new") {
          const randomPassword = "Khach@" + Math.floor(1000 + Math.random() * 9000);
          let emailToUse = newCustomer.email || `${newCustomer.phone_number}@guest.local`;
          const resCust = await customerApi.createCustomer({ ...newCustomer, email: emailToUse, password: randomPassword });
          if (resCust && resCust.customerId) finalCustomerId = resCust.customerId;
          else throw new Error("Lỗi khi tạo hồ sơ khách hàng mới.");
      }
      if (!finalCustomerId) return alert("Vui lòng chọn khách hàng!");

      const payloadBooking = {
        customer_id: finalCustomerId, handled_by: employeeId, adults: Number(formData.adults), children: Number(formData.children),
        deposit: Number(formData.deposit), total_fee: Number(calcValues.total_price),
        promotion_code: appliedDiscounts.length > 0 ? appliedDiscounts.map(d => d.discount_id) : null,
        expected_checkin: new Date(formData.expected_checkin).toISOString(), expected_checkout: new Date(formData.expected_checkout).toISOString(),
        rooms: selectedRooms.map(r => ({
            room_id: r._id, expected_checkin: new Date(formData.expected_checkin).toISOString(), expected_checkout: new Date(formData.expected_checkout).toISOString(), base_fee: Number(r.price)
        }))
      };

      await bookingApi.createBooking(payloadBooking);
      alert("Tạo đặt phòng thành công!"); setIsModalOpen(false); fetchData();
    } catch (error) { alert("Lỗi: " + (error.response?.data?.message || error.message)); }
  };

  // LOGIC QUÉT QR CODE
  const checkCameraPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const track = stream.getVideoTracks()[0];
      track.stop();
      return { success: true };
    } catch (err) {
      let errorMessage = "Không thể truy cập camera.";
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMessage = "Quyền truy cập camera bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMessage = "Không tìm thấy camera. Vui lòng thử tải ảnh lên thay thế.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMessage = "Camera đang được sử dụng bởi ứng dụng khác.";
      }
      return { success: false, error: errorMessage };
    }
  };

  // bắt đầu quét bằng camera
  const startQRScanning = async () => {
    try {
      setQrError(null);
      const permissionCheck = await checkCameraPermissions();
      if (!permissionCheck.success) {
        setQrError(permissionCheck.error);
        setToast({ message: permissionCheck.error, type: "error" });
        return;
      }

      setShowQrScanner(true);
      setQrScanning(true);
      scanAttemptsRef.current = 0;
    } catch (err) {
      console.error("Error starting QR scanner:", err);
      setQrError(err.message || "Không thể khởi động camera");
      setQrScanning(false);
      setShowQrScanner(false);
      setToast({ message: "Không thể khởi động camera. Vui lòng thử tải ảnh lên.", type: "error" });
    }
  };

  // dừng quét bằng camera
  const stopQRScanning = async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      setQrScanning(false);
      setShowQrScanner(false);
      scanAttemptsRef.current = 0;
    } catch (err) {
      console.error("Error stopping scanner:", err);
    }
  };

  // quét từ file ảnh
  const handleQRFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast({ message: "Vui lòng chọn file ảnh (JPG, PNG, WEBP)", type: "error" });
      return;
    }

    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setToast({ message: "File quá lớn. Vui lòng chọn file nhỏ hơn 5MB", type: "error" });
      return;
    }

    await handleQRScanned(null, file);
  };

  const handleQRScanned = async (decodedText = null, imageFile = null) => {
    try {
      setQrLoading(true);
      setQrError(null);

      let result;

      if (imageFile) {
        result = await qrApi.scanQRCode(imageFile);
      } else if (decodedText) {
        try {
          const parsed = JSON.parse(decodedText);
          result = { success: true, data: parsed, rawData: decodedText };
        } catch (e) {
          result = { success: true, data: decodedText, rawData: decodedText };
        }
      }

      if (result && result.success) {
        const qrData = result.data;
        
        // Map dữ liệu từ QR vào form
        if (qrData && typeof qrData === 'object') {
          const updatedCustomer = { ...newCustomer };
          
          if (qrData.cccd) updatedCustomer.CCCD = qrData.cccd;
          if (qrData.fullName) updatedCustomer.full_name = qrData.fullName;
          if (qrData.dateOfBirth) {
            // Format date từ DDMMYYYY (8 số) sang YYYY-MM-DD
            let formattedDate = qrData.dateOfBirth.trim();
            if (formattedDate.length === 8 && /^\d{8}$/.test(formattedDate)) {
              // Format DDMMYYYY -> YYYY-MM-DD
              const day = formattedDate.substring(0, 2);
              const month = formattedDate.substring(2, 4);
              const year = formattedDate.substring(4, 8);
              // Validate date
              const dayNum = parseInt(day, 10);
              const monthNum = parseInt(month, 10);
              const yearNum = parseInt(year, 10);
              if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                formattedDate = `${year}-${month}-${day}`;
              } else {
                // Nếu không hợp lệ, giữ nguyên
                formattedDate = qrData.dateOfBirth;
              }
            } else if (formattedDate.length === 10 && formattedDate.includes('/')) {
              // Format DD/MM/YYYY -> YYYY-MM-DD
              const parts = formattedDate.split('/');
              if (parts.length === 3) {
                formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
            } else if (formattedDate.length === 10 && formattedDate.includes('-')) {
              // Đã đúng format YYYY-MM-DD hoặc DD-MM-YYYY
              const parts = formattedDate.split('-');
              if (parts.length === 3 && parts[0].length === 2) {
                // DD-MM-YYYY -> YYYY-MM-DD
                formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
            }
            updatedCustomer.date_birth = formattedDate;
          }
          // ngoài mấy đó ra còn trả về giới tính, địa chỉ với ngày cấp cccd
          
          setNewCustomer(updatedCustomer);
          setToast({ message: "Đã đọc thông tin từ mã QR thành công!", type: "success" });
        } else {
          setToast({ message: "Không thể đọc thông tin từ mã QR", type: "error" });
        }
      } else {
        throw new Error(result?.message || "Không thể đọc mã QR");
      }
    } catch (err) {
      console.error("Error processing QR code:", err);
      setQrError(err.response?.data?.message || err.message || "Có lỗi xảy ra khi xử lý mã QR");
      setToast({ 
        message: err.response?.data?.message || err.message || "Có lỗi xảy ra", 
        type: "error" 
      });
    } finally {
      setQrLoading(false);
    }
  };

  const filteredCustomers = customersList.filter(c => c.full_name?.toLowerCase().includes(custSearchQuery.toLowerCase()) || c.phone_number?.includes(custSearchQuery));
  const selectCustomer = (c) => { setFormData({ ...formData, customer_id: c._id }); setSelectedCustDisplay(c); setCustSearchQuery(""); setShowCustDropdown(false); };
  const clearSelectedCustomer = () => { setFormData({ ...formData, customer_id: "" }); setSelectedCustDisplay(null); setCustSearchQuery(""); };

  const actionConfirm = (id) => setConfirmState({
      open: true, title: "Xác nhận Tiền Cọc", message: "Bạn có chắc chắn khách hàng đã thanh toán tiền cọc?", confirmText: "Đã thu tiền", type: "info",
      onConfirm: async () => { try { await bookingApi.confirmBooking(id); fetchData(); setConfirmState(p => ({...p, open: false})); } catch(e) { alert(e.message) } }
  });

  const actionCheckIn = (did, bid, rNum) => setConfirmState({
        open: true, title: `Check-in Phòng ${rNum}`, message: `Xác nhận giao phòng ${rNum} cho khách ngay bây giờ?`, confirmText: "Giao phòng", type: "success",
        onConfirm: async () => {
            try { await bookingApi.checkinBookingDetail(bid, did); fetchData(); setConfirmState(p => ({...p, open: false})); alert(`Check-in phòng ${rNum} thành công!`); }
            catch(err) { alert(`Lỗi: ${err.response?.data?.message || err.message}`); }
        }
    });

  const actionCheckOut = (did, bid, rNum) => setConfirmState({
        open: true, title: `Check-out Phòng ${rNum}`, message: `Xác nhận khách trả phòng ${rNum} ?`, confirmText: "Trả phòng", type: "warning",
        onConfirm: async () => {
            try {
                await bookingApi.checkoutBookingDetail(bid, did);
                try { await receiptApi.createReceipt({ booking_id: bid, payment: "cash", note: "Hóa đơn tạo tự động khi checkout" }); alert("Check-out và tạo hóa đơn THÀNH CÔNG!"); }
                catch (err) { alert(`Check-out xong nhưng KHÔNG TẠO HÓA ĐƠN. Lỗi: ${err.response?.data?.message}`); }
                fetchData(); setConfirmState(p => ({...p, open: false}));
            } catch(e) { alert("Lỗi: " + e.message); }
        }
    });

  const openCancelModal = (id) => {
    setCancelModal({
      open: true,
      bookingId: id,
      reason: "change_plan",
      loading: false
    });
  };

  const submitCancelBooking = async () => {
    setCancelModal(prev => ({ ...prev, loading: true }));
    try {
      await bookingApi.cancelBooking(cancelModal.bookingId, cancelModal.reason);

      alert("Hủy đặt phòng thành công!");
      fetchData();
      setCancelModal({ open: false, bookingId: null, reason: "change_plan", loading: false });
    } catch (err) {
      console.error("Cancel Error:", err);
      if (err.response?.data?.message?.includes("reason") && err.response?.data?.message?.includes("required")) {
         try {
             await bookingApi.cancelBooking(cancelModal.bookingId, { reason: cancelModal.reason });
             alert("Hủy đặt phòng thành công!");
             fetchData();
             setCancelModal({ open: false, bookingId: null, reason: "change_plan", loading: false });
             return;
         } catch(e) {}
      }

      alert("Lỗi khi hủy: " + (err.response?.data?.message || err.message));
      setCancelModal(prev => ({ ...prev, loading: false }));
    }
  };

  const filteredBookings = useMemo(() => {
      return bookings.filter(b => {
          const matchStatus = activeTab === "all" || b.status === activeTab;
          const matchSearch = b.customer_id?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.customer_id?.phone_number?.includes(searchTerm);
          return matchStatus && matchSearch;
      });
  }, [bookings, activeTab, searchTerm]);

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-7xl mx-auto space-y-6">

          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">Quản lý Đặt phòng</h1>
                <p className="text-gray-500 text-sm mt-1">Theo dõi và xử lý các đơn đặt phòng của khách hàng.</p>
            </div>
            <button onClick={handleOpenModal} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm">
              <FiPlus size={20} /> Tạo đơn mới
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex flex-col gap-4 mb-6">
                <div className="flex bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto no-scrollbar">
                    {['all', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(t => (
                        <button key={t} onClick={() => setActiveTab(t)}
                            className={`px-4 py-1.5 rounded-md text-sm font-bold capitalize transition-all whitespace-nowrap ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                            {STATUS_MAP[t]?.label || (t === 'all' ? 'Tất cả' : t)}
                        </button>
                    ))}
                </div>

                <div className="flex justify-between items-center">
                    <div className="relative w-full lg:w-96">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                        <input type="text" placeholder="Tìm tên khách, SĐT..." className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 focus:ring-0 transition"
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-gray-500 text-xs uppercase font-semibold border-b border-gray-100 bg-gray-50/50">
                    <th className="py-3 pl-4">Khách hàng</th>
                    <th className="py-3">Phòng</th>
                    <th className="py-3">Lịch trình</th>
                    <th className="py-3 text-center">Cọc</th>
                    <th className="py-3 text-center">Trạng thái</th>
                    <th className="py-3 text-right pr-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 text-sm">
                  {filteredBookings.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có dữ liệu đặt phòng.</td></tr>
                  ) : filteredBookings.map((b, index) => {
                    const statusInfo = STATUS_MAP[b.status] || STATUS_MAP.pending;
                    return (
                      <tr key={b._id || index} className="border-b border-gray-50 hover:bg-gray-50 transition group align-top">
                        <td className="py-4 pl-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                    {b.customer_id?.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{b.customer_id?.full_name}</div>
                                    <div className="text-xs text-gray-500">{b.customer_id?.phone_number}</div>
                                </div>
                            </div>
                        </td>
                        <td className="py-4">
                            <div className="flex flex-col gap-2">
                                {b.rooms?.map((r,i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs border border-gray-200">
                                            P.{r.room_id?.room_number}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </td>
                        <td className="py-4 text-xs text-gray-600">
                           <div className="mb-1"><span className="font-medium">In:</span> {format(new Date(b.expected_checkin), "dd/MM/yyyy HH:mm")}</div>
                           <div><span className="font-medium">Out:</span> {format(new Date(b.expected_checkout), "dd/MM/yyyy HH:mm")}</div>
                        </td>
                        <td className="py-4 text-center font-medium">
                            {b.deposit > 0 ? b.deposit.toLocaleString() : "0"}
                        </td>
                        <td className="py-4 text-center">
                            <StatusPill label={statusInfo.label} color={statusInfo.color} />
                        </td>
                        <td className="py-4 text-right pr-4">
                            <div className="flex flex-col items-end gap-2">
                                {b.status === 'pending' && (
                                    <button onClick={() => actionConfirm(b._id)}
                                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100 transition">
                                        Xác nhận cọc
                                    </button>
                                )}
                                {b.rooms?.map((r, i) => {
                                    if(b.status === 'confirmed' && r.status === 'reserved')
                                        return (
                                            <button key={i} onClick={()=>actionCheckIn(r._id,b._id,r.room_id?.room_number)}
                                                className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded hover:bg-emerald-100 transition">
                                                <FiLogIn/> Check-in
                                            </button>
                                        );
                                    if(r.status === 'checked_in')
                                        return (
                                            <button key={i} onClick={()=>actionCheckOut(r._id,b._id,r.room_id?.room_number)}
                                                className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded hover:bg-orange-100 transition">
                                                <FiLogOut/> Check-out
                                            </button>
                                        );
                                    return null;
                                })}
                                {['pending', 'confirmed'].includes(b.status) && (
                                    <button onClick={() => openCancelModal(b._id)} className="text-xs text-red-400 hover:text-red-600 hover:underline">
                                        Hủy đơn
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
          <div className="bg-white p-6 rounded-xl w-[700px] shadow-2xl max-h-[95vh] overflow-y-auto">
            <div className="flex justify-between mb-6 items-center border-b border-gray-100 pb-2">
                <h3 className="font-bold text-xl text-gray-900">Tạo Đặt phòng Mới</h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-gray-100 p-2 rounded-full text-gray-500"><FiX size={20}/></button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2 w-2/3">
                            <button type="button" onClick={() => setCustomerMode('existing')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${customerMode==='existing' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                <FiUsers className="inline mr-2"/> Khách hàng cũ
                            </button>
                            <button type="button" onClick={() => setCustomerMode('new')}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold border transition ${customerMode==='new' ? 'border-indigo-600 text-indigo-600 bg-indigo-50' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                                <FiUserPlus className="inline mr-2"/> Tạo khách mới
                            </button>
                        </div>

                        <div className={`cursor-pointer px-3 py-2 rounded-lg border transition-all flex items-center gap-2 select-none ${isWalkIn ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`} onClick={() => setIsWalkIn(!isWalkIn)}>
                             {isWalkIn ? <FiCheckSquare size={18}/> : <FiSquare size={18}/>}
                             <span className="text-xs font-bold">Khách tại quầy</span>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 mt-1">
                        {customerMode === 'existing' ? (
                            <div className="relative" ref={dropdownRef}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Tìm kiếm khách hàng <span className="text-red-500">*</span></label>
                                {selectedCustDisplay ? (
                                    <div className="flex items-center justify-between p-3 bg-white border border-indigo-200 rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold"><FiUser/></div>
                                            <div>
                                                <div className="font-bold text-gray-900 text-sm">{selectedCustDisplay.full_name}</div>
                                                <div className="text-xs text-gray-500">{selectedCustDisplay.phone_number} - {selectedCustDisplay.CCCD}</div>
                                            </div>
                                        </div>
                                        <button type="button" onClick={clearSelectedCustomer} className="text-gray-400 hover:text-red-500"><FiX/></button>
                                    </div>
                                ) : (
                                    <div className="relative">
                                        <input type="text" placeholder="Nhập Tên, SĐT hoặc CCCD..." className="w-full pl-9 border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white" value={custSearchQuery} onChange={(e) => { setCustSearchQuery(e.target.value); setShowCustDropdown(true); }} onFocus={() => setShowCustDropdown(true)} />
                                        <FiSearch className="absolute left-3 top-3 text-gray-400"/>
                                        {showCustDropdown && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                {filteredCustomers.length > 0 ? (
                                                    filteredCustomers.map(c => (
                                                        <div key={c._id} onClick={() => selectCustomer(c)} className="p-2.5 hover:bg-gray-50 cursor-pointer text-sm border-b border-gray-50 last:border-0">
                                                            <div className="font-bold text-gray-800">{c.full_name}</div>
                                                            <div className="text-xs text-gray-500">{c.phone_number}</div>
                                                        </div>
                                                    ))
                                                ) : (<div className="p-3 text-center text-gray-500 text-xs">Không tìm thấy.</div>)}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {/* Nút quét QR */}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={startQRScanning}
                                        disabled={qrScanning || qrLoading}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                                    >
                                        <FiCamera size={16} />
                                        {qrScanning ? "Đang quét..." : "Quét QR căn cước"}
                                    </button>
                                    <label className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">
                                        <FiUpload size={16} />
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleQRFileUpload}
                                            className="hidden"
                                            disabled={qrLoading}
                                        />
                                        Tải ảnh căn cước
                                    </label>
                                </div>

                                {/* Form fields */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div><label className="text-xs font-bold text-gray-500">Họ tên *</label><input className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" value={newCustomer.full_name} onChange={e=>setNewCustomer({...newCustomer, full_name: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold text-gray-500">SĐT *</label><input className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" value={newCustomer.phone_number} onChange={e=>setNewCustomer({...newCustomer, phone_number: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold text-gray-500">CCCD *</label><input className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" value={newCustomer.CCCD} onChange={e=>setNewCustomer({...newCustomer, CCCD: e.target.value})}/></div>
                                    <div><label className="text-xs font-bold text-gray-500">Ngày sinh</label><input type="date" className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" value={newCustomer.date_birth} onChange={e=>setNewCustomer({...newCustomer, date_birth: e.target.value})}/></div>
                                    <div className="col-span-2"><label className="text-xs font-bold text-gray-500">Email</label><input className="w-full border border-gray-300 rounded-lg p-2 mt-1 outline-none focus:border-indigo-500 bg-white" placeholder="Option" value={newCustomer.email} onChange={e=>setNewCustomer({...newCustomer, email: e.target.value})}/></div>
                                </div>

                                {/* Loading/Error */}
                                {qrLoading && (
                                    <div className="text-center py-2">
                                        <div className="inline-block animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                                        <p className="mt-1 text-xs text-gray-600">Đang xử lý ảnh...</p>
                                    </div>
                                )}
                                {qrError && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="text-red-800 text-xs">{qrError}</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                    <label className="text-sm font-bold text-indigo-800 flex items-center gap-2 mb-3">
                        <FiCalendar/> Thời gian & Số lượng
                    </label>
                    <div className="grid grid-cols-2 gap-4 mb-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Check-in</label>
                            <input type="datetime-local" required className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                                value={formData.expected_checkin} onChange={e => setFormData({...formData, expected_checkin: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Check-out</label>
                            <input type="datetime-local" required className="w-full border border-gray-300 rounded-lg p-2.5 bg-white text-sm focus:ring-2 focus:ring-indigo-500"
                                value={formData.expected_checkout} onChange={e => setFormData({...formData, expected_checkout: e.target.value})} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Người lớn</label>
                            <input type="number" min="1" className="w-full border border-gray-300 rounded-lg p-2 text-center bg-white"
                                value={formData.adults} onChange={e=>setFormData({...formData, adults: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-600 mb-1">Trẻ em</label>
                            <input type="number" min="0" className="w-full border border-gray-300 rounded-lg p-2 text-center bg-white"
                                value={formData.children} onChange={e=>setFormData({...formData, children: e.target.value})} />
                        </div>
                    </div>
                </div>

                <div className="border rounded-lg p-4 border-gray-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1"><FiMapPin/> Chọn Phòng</label>
                    <div className="flex gap-2 mb-3">
                        <select
                          className="flex-1 border border-gray-300 rounded-lg p-2.5 outline-none focus:border-indigo-500 bg-white"
                          value={tempRoomId} onChange={e => setTempRoomId(e.target.value)}
                        >
                          <option value="">-- Chọn phòng phù hợp --</option>
                          {roomsList.filter(r => !selectedRooms.some(selected => selected._id === r._id)).map(r => (
                                <option key={r._id} value={r._id}>{r.room_number} - {r.category_name} ({r.price.toLocaleString()} đ)</option>
                          ))}
                        </select>
                        <button type="button" onClick={handleAddRoom} className="bg-indigo-600 text-white p-2.5 rounded-lg hover:bg-indigo-700 transition shadow-sm"><FiPlus size={20}/></button>
                    </div>
                    <div className="space-y-2">
                        {selectedRooms.length === 0 && <div className="text-xs text-gray-400 italic text-center py-2 bg-gray-50 rounded">Chưa chọn phòng nào.</div>}
                        {selectedRooms.map((r, idx) => (
                            <div key={r._id} className="flex justify-between items-center bg-white border border-gray-200 p-2.5 rounded-lg shadow-sm hover:border-indigo-300 transition">
                                <div><span className="font-bold text-indigo-700 text-lg mr-2">{r.room_number}</span><span className="text-xs text-gray-500 uppercase font-semibold">{r.category_name}</span></div>
                                <div className="flex items-center gap-3"><span className="text-sm font-bold text-gray-700">{r.price.toLocaleString()} đ</span><button type="button" onClick={() => handleRemoveRoom(r._id)} className="text-gray-400 hover:text-red-500 transition"><FiTrash2 size={18}/></button></div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Khuyến mãi</label>
                    <div className="flex gap-2 mb-2">
                        <button type="button" onClick={handleAutoApplyDiscount} className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-700 transition">Tự động áp dụng khuyến mãi</button>
                        {promotionName && (<button type="button" onClick={handleUndoDiscount} className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-gray-300 transition">Hoàn tác</button>)}
                    </div>
                    {promotionName && (<div className="text-xs text-emerald-600 font-bold mb-3 flex items-center gap-1"><FiCheckCircle /> {promotionName}</div>)}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div><label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Tổng Tiền (Dự kiến)</label><input type="text" disabled className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2 text-center font-bold text-gray-700 cursor-not-allowed" value={calcValues.total_price.toLocaleString()}/></div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Cọc (VNĐ)</label>
                        <input type="number" disabled={isWalkIn} className={`w-full border rounded-lg p-2 text-center font-bold outline-none transition ${isWalkIn ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200' : 'bg-white text-emerald-600 border-gray-300 focus:ring-2 focus:ring-emerald-500'}`} value={formData.deposit} onChange={(e) => setFormData({...formData, deposit: e.target.value})}/>
                    </div>
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100">
                     <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition shadow-md flex justify-center items-center gap-2"><FiCheckCircle size={18}/> Xác nhận Đặt Phòng</button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL HỦY ĐẶT PHÒNG --- */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-[450px] max-w-full overflow-hidden animate-fade-in scale-100">
            <div className="bg-red-50 p-4 flex items-center gap-3 border-b border-red-100">
              <div>
                <h3 className="text-lg font-bold text-red-700">Xác nhận Hủy Phòng</h3>
                <p className="text-xs text-red-500">Hành động này không thể hoàn tác</p>
              </div>
            </div>

            <div className="p-6">
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Vui lòng chọn lý do hủy:
              </label>
              <select
                className="w-full border border-gray-300 rounded-lg p-3 outline-none focus:ring-2 focus:ring-red-500 bg-white text-gray-700"
                value={cancelModal.reason}
                onChange={(e) => setCancelModal({ ...cancelModal, reason: e.target.value })}
              >
                {CANCELLATION_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-3 italic bg-gray-50 p-2 rounded">
                Lưu ý: Hủy đặt phòng có thể ảnh hưởng đến điểm uy tín của khách hàng (trừ 2 điểm).
              </p>
            </div>

            <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-100">
              <button
                onClick={() => setCancelModal({ ...cancelModal, open: false })}
                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-bold hover:bg-gray-100 transition"
              >
                Đóng
              </button>
              <button
                onClick={submitCancelBooking}
                disabled={cancelModal.loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition shadow-lg shadow-red-200 disabled:opacity-50 flex items-center gap-2"
              >
                {cancelModal.loading ? "Đang xử lý..." : "Xác nhận Hủy"}
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
            confirmText={confirmState.confirmText}
            cancelText="Đóng"
            type={confirmState.type}
            onConfirm={confirmState.onConfirm}
            onCancel={() => setConfirmState(p => ({ ...p, open: false }))}
        />
      )}

      {showQrScanner && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="font-bold text-lg text-gray-900">Quét mã QR căn cước</h3>
              <button
                onClick={stopQRScanning}
                className="text-gray-400 hover:text-gray-600"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="p-4">
              <div
                id="qr-reader-modal"
                className="w-full"
                style={{ minHeight: "300px" }}
              ></div>
              {qrScanning && (
                <div className="mt-4 text-center">
                  <button
                    onClick={stopQRScanning}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
                  >
                    Dừng quét
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
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