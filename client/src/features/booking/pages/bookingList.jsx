import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays, setHours, setMinutes, addMinutes } from "date-fns";
import {
  FiPlus, FiX, FiTrash2, FiSearch, FiCheckCircle, FiLogOut, FiUser,
  FiUserPlus, FiUsers, FiTag, FiLogIn, FiMinusCircle, FiCheckSquare, FiSquare,
  FiCalendar, FiMapPin, FiAlertTriangle, FiCamera, FiUpload,
  FiChevronLeft, FiChevronRight, FiSave, FiCheck, FiEye
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
import { paymentApi } from "../../api/paymentApi.js";
import { discountApi } from "../../api/discountApi.js";
import { serviceApi } from "../../api/serviceApi.js";
import { incidentApi } from "../../api/incidentApi.js";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import AssignHousekeeperModal from "../components/assignHousekeeperModal.jsx";

// 1 đêm = 14:00 ngày N → 12:00 ngày N+1. Đếm theo ngày lịch, bỏ phần giờ.
const calcNights = (checkin, checkout) => {
  const d1 = new Date(checkin);
  const d2 = new Date(checkout);
  const day1 = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
  const day2 = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
  return Math.round((day2 - day1) / (1000 * 60 * 60 * 24));
};

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
  let employeeId = user?._id;
  if (!employeeId && user?.token) {
    try { employeeId = jwtDecode(user.token).userId; } catch (err) {}
  }

  const [bookings, setBookings] = useState([]);
  const [roomsList, setRoomsList] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [bookingMode, setBookingMode] = useState("immediate"); // "immediate" hoặc "advance"
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
  const [calcValues, setCalcValues] = useState({ total_price: 0, deposit_required: 0 });
  const [availableDiscounts, setAvailableDiscounts] = useState([]);
  const [selectedDiscount, setSelectedDiscount] = useState(null);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    email: "", full_name: "", phone_number: "", date_birth: "", nationality: "Vietnam", CCCD: ""
  });
  const [savingCustomer, setSavingCustomer] = useState(false);

  // QR Scanner states
  const [qrScanning, setQrScanning] = useState(false);
  const [qrLoading, setQrLoading] = useState(false);
  const [qrError, setQrError] = useState(null);
  const [toast, setToast] = useState(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const html5QrCodeRef = useRef(null);
  const scanTimeoutRef = useRef(null);
  const scanAttemptsRef = useRef(0);
  const payosPollingRef = useRef(null);

  const [confirmState, setConfirmState] = useState({
      open: false, title: "", message: "", confirmText: "Đồng ý", type: "danger", onConfirm: null
  });

  const [cancelModal, setCancelModal] = useState({
    open: false,
    bookingId: null,
    reason: "change_plan",
    loading: false
  });

  const [selectedBooking, setSelectedBooking] = useState(null);

  if (!employeeId) return <Toast message="Phiên làm việc hết hạn. Vui lòng đăng nhập lại!" type="error" onClose={() => {}} />;

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
      if (html5QrCodeRef.current) {
        html5QrCodeRef.current.stop().catch(() => {});
      }
      if (scanTimeoutRef.current) {
        clearTimeout(scanTimeoutRef.current);
      }
      if (payosPollingRef.current) {
        clearInterval(payosPollingRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

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

  // Tự động set thời gian check-in khi chọn "đặt liền"
  useEffect(() => {
    if (isModalOpen && bookingMode === 'immediate') {
      const now = new Date();
      const checkinTime = addMinutes(now, 10); // Thời điểm hiện tại + 10 phút
      const formattedTime = format(checkinTime, "yyyy-MM-dd'T'HH:mm");
      // Chỉ cập nhật nếu giá trị hiện tại khác với giá trị mới (tránh loop vô hạn)
      if (formData.expected_checkin !== formattedTime) {
        setFormData(prev => ({
          ...prev,
          expected_checkin: formattedTime
        }));
      }
    }
  }, [isModalOpen, bookingMode]);

  useEffect(() => {
    if (!formData.expected_checkin || !formData.expected_checkout) {
      setCalcValues({ total_price: 0, deposit_required: 0 });
      return;
    }
    // Số đêm = số ngày lịch (14:00 → 12:00 hôm sau = 1 đêm)
    const nights = calcNights(formData.expected_checkin, formData.expected_checkout);
    if (nights <= 0) {
      setCalcValues({ total_price: 0, deposit_required: 0 });
      return;
    }

    // Tính tổng tiền: giá phòng * số đêm
    const total = selectedRooms.reduce((sum, r) => sum + (r.price * nights), 0);
    let finalTotal = total;
    
    // Tính lại discount_amount từ total hiện tại để đảm bảo chính xác
    if (selectedDiscount) {
      let discountAmount = 0;
      if (selectedDiscount.discount_type === "PERCENT") {
        discountAmount = Math.round(total * selectedDiscount.discount_value / 100);
        if (selectedDiscount.max_discount && discountAmount > selectedDiscount.max_discount) {
          discountAmount = selectedDiscount.max_discount;
        }
      } else {
        discountAmount = selectedDiscount.discount_value || 0;
      }
      finalTotal = Math.max(0, total - discountAmount); // Đảm bảo không âm
    }
    
    const deposit = (bookingMode === 'immediate' || isWalkIn) ? 0 : (finalTotal * 0.3);
    setCalcValues({ total_price: finalTotal, deposit_required: deposit });
    setFormData(prev => ({...prev, deposit: deposit}));
  }, [selectedRooms, isWalkIn, bookingMode, formData.expected_checkin, formData.expected_checkout, selectedDiscount]);

  // useEffect để fetch discounts khi selectedRooms hoặc thời gian thay đổi
  useEffect(() => {
    if (formData.customer_id && selectedRooms.length > 0 && formData.expected_checkin && formData.expected_checkout) {
      fetchAvailableDiscounts();
    } else {
      setAvailableDiscounts([]);
      setSelectedDiscount(null);
    }
  }, [selectedRooms, formData.customer_id, formData.expected_checkin, formData.expected_checkout]);


  const fetchData = async () => {
    try {
      const [bookRes, roomRes, custRes] = await Promise.all([
        bookingApi.getAllBookings(),
        roomApi.getAllRooms(),
        customerApi.getAllCustomers()
      ]);
      const bookingsData = Array.isArray(bookRes.result) ? bookRes.result : [];
      setBookings(bookingsData);
      setCustomersList(custRes.customers || []);

      // Kiểm tra cleaningTask cho các phòng đã checkout
      await checkCleaningTasks(bookingsData);
    } catch (error) { console.error(error); }
  };

  // Poll GET /bookings/:id every 4s until booking leaves "pending" (PayOS deposit confirmed)
  const startPayOSPolling = (bookingId) => {
    if (payosPollingRef.current) clearInterval(payosPollingRef.current);
    let attempts = 0;
    const maxAttempts = 75; // 75 × 4s ≈ 5 minutes

    payosPollingRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(payosPollingRef.current);
        payosPollingRef.current = null;
        return;
      }
      try {
        const res = await bookingApi.getBookingById(bookingId);
        if (res?.booking?.status && res.booking.status !== "pending") {
          clearInterval(payosPollingRef.current);
          payosPollingRef.current = null;
          fetchData();
          setToast({ type: "success", message: "Thanh toán tiền cọc thành công! Đơn đặt phòng đã được xác nhận." });
        }
      } catch {
        // silently ignore polling errors
      }
    }, 4000);
  };
  
  const checkCleaningTasks = async (bookings) => {
    setLoadingCleaningTasks(true);
    try {
      // Lấy tất cả các phòng đã checkout (loại bỏ trùng lặp room_id)
      const checkedOutRoomsMap = new Map(); // Map<room_id, {room_id, booking_id, detail_id}>
      bookings.forEach(booking => {
        booking.rooms?.forEach(room => {
          if (room.status === 'checked_out' && room.room_info?._id) {
            const roomId = room.room_info._id;
            // Chỉ lưu lần đầu tiên gặp mỗi room_id (ưu tiên booking mới hơn nếu cần)
            if (!checkedOutRoomsMap.has(roomId)) {
              checkedOutRoomsMap.set(roomId, {
                room_id: roomId,
                booking_id: booking._id,
                detail_id: room._id
              });
            }
          }
        });
      });
      
      const checkedOutRooms = Array.from(checkedOutRoomsMap.values());
      
      // Fetch cleaningTask cho từng phòng
      const tasksMap = {};
      await Promise.all(
        checkedOutRooms.map(async (roomInfo) => {
          try {
            const res = await bookingApi.getCleaningTaskByRoom({
              room_id: roomInfo.room_id,
              booking_id: roomInfo.booking_id
            });
            // Kiểm tra xem room_id đã có trong map chưa và đã có needsAssignment chưa
            const existingTask = tasksMap[roomInfo.room_id];
            const alreadyNeedsAssignment = existingTask && existingTask.needsAssignment === true;
            
            if (res.success && res.task) {
              // Kiểm tra xem task đã có handled_by chưa
              // handled_by có thể là null, undefined, hoặc object (khi populate)
              const hasHandledBy = res.task.handled_by && 
                (typeof res.task.handled_by === 'object' ? res.task.handled_by._id : res.task.handled_by);
              if (!hasHandledBy) {
                // Có task nhưng chưa gán nhân viên - cần gán
                // Chỉ set nếu chưa có trong map hoặc chưa có needsAssignment
                if (!existingTask || !alreadyNeedsAssignment) {
                  const taskData = { 
                    ...res.task, 
                    needsAssignment: true,
                    room_log_id: res.task.room_log_id?._id || res.task.room_log_id || res.room_log_id
                  };
                  tasksMap[roomInfo.room_id] = taskData;
                }
              } else {
                // Đã có task và đã gán nhân viên
                // Chỉ ghi đè nếu chưa có needsAssignment (tránh ghi đè khi đã có needsAssignment)
                if (!alreadyNeedsAssignment) {
                  tasksMap[roomInfo.room_id] = res.task;
                }
              }
            } else {
              // Không có task - cần gán nhân viên (chỉ đánh dấu nếu có room_log_id)
              // Nếu có room_log_id nghĩa là đã có RoomLog cleaning nhưng chưa có CleaningTask
              if (res.room_log_id) {
                // Chỉ set nếu chưa có trong map hoặc chưa có needsAssignment
                if (!existingTask || !alreadyNeedsAssignment) {
                  tasksMap[roomInfo.room_id] = { 
                    needsAssignment: true, 
                    room_log_id: res.room_log_id 
                  };
                }
              } else {
                // Chưa có cả RoomLog và CleaningTask - có thể là trường hợp cũ
                // Chỉ set undefined nếu chưa có trong map
                if (!existingTask) {
                  tasksMap[roomInfo.room_id] = undefined; // undefined = chưa kiểm tra hoặc không cần
                }
              }
            }
          } catch (error) {
            console.error(`Error checking cleaning task for room ${roomInfo.room_id}:`, error);
            // Nếu lỗi, vẫn đánh dấu là cần gán để có thể thử
            tasksMap[roomInfo.room_id] = { needsAssignment: true };
          }
        })
      );
      
      setCleaningTasksMap(tasksMap);
    } catch (error) {
      console.error("Error checking cleaning tasks:", error);
    } finally {
      setLoadingCleaningTasks(false);
    }
  };

  const fetchAvailableRooms = async (checkin, checkout) => {
    if (!checkin || !checkout) return;
    try {
      const res = await roomApi.getAvailableBy({
        checkin, checkout, adults: formData.adults, children: formData.children,
      });
      const categories = Array.isArray(res) ? res : [];
      const flatRooms = categories.flatMap(c => c.rooms.map(r => ({
          _id: r.room_id || r._id, room_number: r.room_number, category_name: c.name || c.category_name, price: c.price
        }))
      );
      setRoomsList(flatRooms);
    } catch (err) {
      console.error("Lỗi tải danh sách phòng:", err);
      setRoomsList([]);
      setToast({ message: "Không thể tải danh sách phòng: " + (err.response?.data?.message || err.message), type: "error" });
    }
  };

  // Hàm fetch available discounts
  const fetchAvailableDiscounts = async () => {
    if (!formData.customer_id || !selectedRooms.length || !formData.expected_checkin || !formData.expected_checkout) {
      setAvailableDiscounts([]);
      return;
    }
    
    setLoadingDiscounts(true);
    try {
      // Số đêm theo ngày lịch — đồng bộ với cách tính total
      const nights = calcNights(formData.expected_checkin, formData.expected_checkout);
      if (nights <= 0) {
        setAvailableDiscounts([]);
        return;
      }

      // Tính tổng tiền đơn hàng
      const totalOrderValue = selectedRooms.reduce((sum, room) => {
        return sum + (room.price * nights);
      }, 0);
      
      const res = await discountApi.getAvailableDiscounts(formData.customer_id, totalOrderValue);
      if (res.success) {
        const newDiscounts = res.discounts || [];
        setAvailableDiscounts(newDiscounts);
        // Nếu discount đang chọn không còn khả dụng với tổng tiền mới, tự động bỏ chọn
        if (selectedDiscount) {
          const updated = newDiscounts.find(d => d.id === selectedDiscount.id);
          if (!updated || !updated.is_available) {
            setSelectedDiscount(null);
          } else {
            setSelectedDiscount(updated); // làm mới dữ liệu discount
          }
        }
      } else {
        setAvailableDiscounts([]);
        setSelectedDiscount(null);
      }
    } catch (err) {
      console.error("Error fetching discounts:", err);
      setAvailableDiscounts([]);
      setSelectedDiscount(null);
    } finally {
      setLoadingDiscounts(false);
    }
  };

  // Hàm chọn discount
  const handleSelectDiscount = (discount) => {
    if (!discount.is_available) return;
    
    setSelectedDiscount(discount);
    // useEffect sẽ tự động tính lại khi selectedDiscount thay đổi
  };

  // Hàm bỏ chọn discount
  const handleRemoveDiscount = () => {
    setSelectedDiscount(null);
    // useEffect sẽ tự động tính lại khi selectedDiscount thay đổi
  };

  const handleAddRoom = () => {
      if (!tempRoomId) return;
      const roomToAdd = roomsList.find(r => r._id === tempRoomId);
      if (roomToAdd && !selectedRooms.some(r => r._id === roomToAdd._id)) {
          setSelectedRooms([...selectedRooms, roomToAdd]);
      }
      setTempRoomId("");
  };

  const handleRemoveRoom = (roomId) => {
      setSelectedRooms(selectedRooms.filter(r => r._id !== roomId));
  };

  const handleSaveCustomer = async () => {
    // Validate các trường bắt buộc
    if (!newCustomer.full_name || !newCustomer.phone_number || !newCustomer.CCCD) {
      setToast({ type: "error", message: "Vui lòng điền đầy đủ các trường bắt buộc: Họ tên, SĐT, CCCD" });
      return;
    }

    setSavingCustomer(true);
    try {
      const randomPassword = "Khach@" + Math.floor(1000 + Math.random() * 9000);
      let emailToUse = newCustomer.email || `${newCustomer.phone_number}@guest.local`;
      const dateBirth = newCustomer.date_birth?.trim() || "2000-01-01";

      const reg = await customerApi.registerCustomer({
        email: emailToUse,
        password: randomPassword,
        date_birth: dateBirth,
        full_name: newCustomer.full_name,
        phone_number: newCustomer.phone_number,
        nationality: newCustomer.nationality || "Vietnam",
        CCCD: newCustomer.CCCD,
      });

      if (reg?.userID) {
        const custRes = await customerApi.getAllCustomers();
        setCustomersList(custRes.customers || []);

        const createdCustomer = (custRes.customers || []).find(
          (c) => String(c.user_id) === String(reg.userID)
        );

        if (createdCustomer) {
          // Chuyển sang mode existing và chọn khách hàng vừa tạo
          setCustomerMode("existing");
          selectCustomer(createdCustomer);
          setFormData(prev => ({ ...prev, customer_id: createdCustomer._id }));

          // Reset form khách hàng mới
          setNewCustomer({
            email: "",
            full_name: "",
            phone_number: "",
            date_birth: "",
            nationality: "Vietnam",
            CCCD: ""
          });

          setToast({ type: "success", message: "Lưu khách hàng thành công! Đã tự động chọn khách hàng vừa tạo." });
        } else {
          setToast({ type: "success", message: "Lưu khách hàng thành công! Vui lòng chọn khách hàng từ danh sách." });
        }
      } else {
        throw new Error("Không nhận được userID từ server");
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      setToast({ type: "error", message: "Lỗi khi lưu khách hàng: " + (error.response?.data?.message || error.message) });
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleOpenModal = () => {
    const now = new Date();
    // Nếu là đặt liền, set check-in = hiện tại + 10 phút
    let checkin;
    if (bookingMode === "immediate") {
      checkin = addMinutes(now, 10);
    } else {
      checkin = setMinutes(setHours(now, 2), 0); // Giờ check-in chuẩn: 2:00 SA
    }
    const checkout = setMinutes(setHours(addDays(now, 1), 12), 0);
    setFormData({ customer_id: "", adults: 1, children: 0, expected_checkin: format(checkin, "yyyy-MM-dd'T'HH:mm"), expected_checkout: format(checkout, "yyyy-MM-dd'T'HH:mm"), deposit: 0 });
    setSelectedRooms([]); 
    setTempRoomId(""); 
    setIsWalkIn(false); 
    setCalcValues({ total_price: 0, deposit_required: 0 });
    setSelectedDiscount(null); 
    setAvailableDiscounts([]);
    setNewCustomer({ email: "", full_name: "", phone_number: "", date_birth: "", nationality: "Vietnam", CCCD: "" });
    setCustomerMode("existing"); 
    setCustSearchQuery(""); 
    setSelectedCustDisplay(null); 
    setShowCustDropdown(false);
    setShowQrScanner(false); 
    setQrScanning(false); 
    setQrError(null);
    setBookingMode("immediate"); // Reset về đặt liền
    setSavingCustomer(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (new Date(formData.expected_checkout) <= new Date(formData.expected_checkin)) {
        setToast({ type: "error", message: "Ngày check-out phải sau ngày check-in!" }); return;
      }
      if (selectedRooms.length === 0) {
        setToast({ type: "error", message: "Vui lòng chọn ít nhất một phòng!" }); return;
      }

      let finalCustomerId = formData.customer_id;
      if (customerMode === "new") {
          const randomPassword = "Khach@" + Math.floor(1000 + Math.random() * 9000);
          let emailToUse = newCustomer.email || `${newCustomer.phone_number}@guest.local`;
          const dateBirth = newCustomer.date_birth?.trim() || "2000-01-01";

          const reg = await customerApi.registerCustomer({
            email: emailToUse,
            password: randomPassword,
            date_birth: dateBirth,
            full_name: newCustomer.full_name,
            phone_number: newCustomer.phone_number,
            nationality: newCustomer.nationality || "Vietnam",
            CCCD: newCustomer.CCCD,
          });
          if (!reg?.userID) throw new Error("Lỗi khi tạo hồ sơ khách hàng mới.");
          const custRes = await customerApi.getAllCustomers();
          const created = (custRes.customers || []).find(
            (c) => String(c.user_id) === String(reg.userID)
          );
          if (!created?._id) throw new Error("Lỗi khi tạo hồ sơ khách hàng mới.");
          finalCustomerId = created._id;
      }
      if (!finalCustomerId) { setToast({ type: "error", message: "Vui lòng chọn khách hàng!" }); return; }

      let depositAmount = bookingMode === "immediate" ? 0 : Number(calcValues.deposit_required);
      // Làm tròn số tiền về số nguyên (PayOS yêu cầu số nguyên)
      depositAmount = Math.round(depositAmount);
      
      const payloadBooking = {
        customer_id: finalCustomerId, handled_by: employeeId, adults: Number(formData.adults), children: Number(formData.children),
        deposit: depositAmount, total_fee: Number(calcValues.total_price),
        discount_id: selectedDiscount ? selectedDiscount.id : null,
        expected_checkin: new Date(formData.expected_checkin).toISOString(), expected_checkout: new Date(formData.expected_checkout).toISOString(),
        rooms: selectedRooms.map(r => ({
          room_id: r._id, 
          room_number: r.room_number,
          expected_checkin: new Date(formData.expected_checkin).toISOString(), 
          expected_checkout: new Date(formData.expected_checkout).toISOString(), 
          base_fee: Number(r.price)
        }))
      };

      //console.log("Payload booking:", payloadBooking);

      // Đặt liền: tạo booking và ghi hóa đơn ngay
      if (bookingMode === "immediate") {
        await bookingApi.createBooking(payloadBooking);
        setToast({ type: "success", message: "Tạo đặt phòng thành công!" });
        setIsModalOpen(false);
        fetchData();
      } 
      // Đặt trước: tạo booking và tạo payment link
      else {
        // Tạo booking trước
        const bookingRes = await bookingApi.createBooking(payloadBooking);
        // console.log("Booking created:", bookingRes);
        const bookingId = bookingRes?.booking_id;
        
        if (!bookingId) {
          throw new Error("Không thể lấy ID booking sau khi tạo.");
        }

        //console.log("Deposit amount:", depositAmount);
      // Tạo payment link cho tiền cọc
      // Đảm bảo số tiền là số nguyên (PayOS yêu cầu)
      const roundedDepositAmount = Math.round(depositAmount);
      const paymentData = {
        booking_id: bookingId,
        amount: roundedDepositAmount,
        description: `Tiền cọc đơn ID: #${bookingId.toString().slice(-6)}`,
        items: [{
          name: `Tiền cọc đặt phòng`,
          quantity: 1,
          price: roundedDepositAmount
        }]
      };
        //console.log("Creating payment link with data:", paymentData);

        const paymentRes = await paymentApi.createPaymentLink(employeeId, paymentData);
        //console.log("Payment link response:", paymentRes);
        
        if (paymentRes?.success && paymentRes?.data?.checkoutUrl) {
          window.open(paymentRes.data.checkoutUrl, '_blank');
          setToast({
            message: "Đã tạo đơn đặt phòng. Vui lòng thanh toán tiền cọc để hoàn tất.",
            type: "info"
          });
          setIsModalOpen(false);
          fetchData();
          startPayOSPolling(bookingId); // auto-refresh when payment confirmed
        } else {
          throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
        }
      }
    } catch (error) {
      setToast({ type: "error", message: "Lỗi: " + (error.response?.data?.message || error.message) });
    }
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
        result = await customerApi.scanQRCode(imageFile);
      } else if (decodedText) {
        try {
          let parsedData = null;
          
          if (decodedText.includes("||") && decodedText.includes("|")) {
            const [cccd, rest] = decodedText.split("||");
            const parts = rest.split("|");

            if (parts.length >= 5) {
              parsedData = {
                cccd: cccd.trim(),
                fullName: parts[0]?.trim() || "",
                dateOfBirth: parts[1]?.trim() || "",
                gender: parts[2]?.trim() || "",
                address: parts[3]?.trim() || "",
                issueDate: parts[4]?.trim() || ""
              };
            }
          }
          result = { success: true, data: parsedData, rawData: decodedText };
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
            let formattedDate = qrData.dateOfBirth.trim();
            if (formattedDate.length === 8 && /^\d{8}$/.test(formattedDate)) {
              const day = formattedDate.substring(0, 2);
              const month = formattedDate.substring(2, 4);
              const year = formattedDate.substring(4, 8);
              const dayNum = parseInt(day, 10);
              const monthNum = parseInt(month, 10);
              const yearNum = parseInt(year, 10);
              if (dayNum >= 1 && dayNum <= 31 && monthNum >= 1 && monthNum <= 12 && yearNum >= 1900 && yearNum <= 2100) {
                formattedDate = `${year}-${month}-${day}`;
              } else {
                formattedDate = qrData.dateOfBirth;
              }
            } else if (formattedDate.length === 10 && formattedDate.includes('/')) {
              const parts = formattedDate.split('/');
              if (parts.length === 3) {
                formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
            } else if (formattedDate.length === 10 && formattedDate.includes('-')) {
              const parts = formattedDate.split('-');
              if (parts.length === 3 && parts[0].length === 2) {
                formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
              }
            }
            updatedCustomer.date_birth = formattedDate;
          }

          setNewCustomer(updatedCustomer);
          setToast({ message: "Đã đọc thông tin từ mã QR thành công!", type: "success" });
        } else {
          setToast({ message: "Không thể đọc thông tin từ mã QR  ", type: "error" });
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

  const actionConfirm = async (bookingId) => {
    try {
      // Tìm booking để lấy thông tin deposit
      const booking = bookings.find(b => b._id === bookingId);
      if (!booking) {
        setToast({ type: "error", message: "Không tìm thấy thông tin booking." });
        return;
      }
      if (!booking.deposit || booking.deposit === 0) {
        setToast({ type: "info", message: "Booking này không cần đặt cọc." });
        return;
      }

      // Lấy receipt_id từ booking hoặc tìm receipt theo booking_id
      let receiptId = null;
      try {
        const receiptRes = await receiptApi.getAllReceipts({ booking_id: bookingId });
        if (receiptRes.receipts && receiptRes.receipts.length > 0) {
          receiptId = receiptRes.receipts[0]._id;
        }
      } catch (e) {
        console.error("Error fetching receipt:", e);
      }

      // Tạo payment link cho tiền cọc
      // Đảm bảo số tiền là số nguyên (PayOS yêu cầu)
      const roundedDeposit = Math.round(booking.deposit);
      const paymentData = {
        booking_id: bookingId,
        receipt_id: receiptId,
        amount: roundedDeposit,
        description: `Tiền cọc đơn ID: #${bookingId.toString().slice(-6)}`,
        items: [{
          name: `Tiền cọc đặt phòng`,
          quantity: 1,
          price: roundedDeposit
        }]
      };

      const paymentRes = await paymentApi.createPaymentLink(employeeId, paymentData);
      
      if (paymentRes?.success && paymentRes?.data?.checkoutUrl) {
        window.open(paymentRes.data.checkoutUrl, '_blank');
        startPayOSPolling(bookingId);
        setToast({
          message: "Đã tạo link thanh toán PayOS. Vui lòng thanh toán tiền cọc trong cửa sổ mới.",
          type: "info"
        });
      } else {
        throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
      }
    } catch (error) {
      setToast({ type: "error", message: "Lỗi: " + (error.response?.data?.error || error.message) });
    }
  };

  const actionCheckIn = (did, bid, rNum) => {
      setConfirmState({
          open: true, 
          title: `Check-in Phòng ${rNum}`, 
          message: `Xác nhận giao phòng ${rNum} cho khách ngay bây giờ?`, 
          confirmText: "Giao phòng", 
          type: "success",
          onConfirm: async () => {
              try {
                  await bookingApi.checkinBookingDetail(bid, did);
                  fetchData();
                  setConfirmState(p => ({...p, open: false}));
                  setToast({ type: "success", message: `Check-in phòng ${rNum} thành công!` });
              } catch(err) {
                  setToast({ type: "error", message: `Lỗi: ${err.response?.data?.message || err.message}` });
              }
          }
      });
  };

  const [showAssignHousekeeperModal, setShowAssignHousekeeperModal] = useState(false);
  const [cleaningData, setCleaningData] = useState(null);
  const [cleaningTasksMap, setCleaningTasksMap] = useState({}); // Map room_id -> cleaningTask
  const [loadingCleaningTasks, setLoadingCleaningTasks] = useState(false);
  
  // Kiểm tra role của user
  const isManager = useMemo(() => {
    const role = (user?.role || localStorage.getItem("role") || "").toLowerCase();
    return role === "manager";
  }, [user]);

  const actionCheckOut = (did, bid, rNum) => {
    setConfirmState({
      open: true, title: `Check-out Phòng ${rNum}`, message: `Xác nhận khách trả phòng ${rNum} ?`, confirmText: "Trả phòng", type: "warning",
      onConfirm: async () => {
        try {
          const res = await bookingApi.checkoutBookingDetail(bid, did);
          setConfirmState(p => ({...p, open: false}));
          if (res.success && res.data && res.data.room_log_id) {
            setCleaningData(res.data);
            setShowAssignHousekeeperModal(true);
          }
          // Optimistic: immediately mark this room as checked_out in local state
          setBookings(prev => prev.map(b => {
            if (b._id !== bid) return b;
            return { ...b, rooms: b.rooms?.map(r => r._id === did ? { ...r, status: "checked_out" } : r) };
          }));
          fetchData(); // background sync for full fresh data
        } catch(e) { setToast({ type: "error", message: "Lỗi: " + e.message }); }
      }
    });
  }

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

      setToast({ type: "success", message: "Hủy đặt phòng thành công!" });
      fetchData();
      setCancelModal({ open: false, bookingId: null, reason: "change_plan", loading: false });
    } catch (err) {
      console.error("Cancel Error:", err);
      if (err.response?.data?.message?.includes("reason") && err.response?.data?.message?.includes("required")) {
         try {
             await bookingApi.cancelBooking(cancelModal.bookingId, { reason: cancelModal.reason });
             setToast({ type: "success", message: "Hủy đặt phòng thành công!" });
             fetchData();
             setCancelModal({ open: false, bookingId: null, reason: "change_plan", loading: false });
             return;
         } catch(e) {}
      }
      setToast({ type: "error", message: "Lỗi khi hủy: " + (err.response?.data?.message || err.message) });
      setCancelModal(prev => ({ ...prev, loading: false }));
    }
  };

  const filteredBookings = useMemo(() => {
      return bookings.filter(b => {
          const matchStatus = activeTab === "all" || b.status === activeTab;
          const matchSearch = b.customer_info?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || b.customer_info?.phone_number?.includes(searchTerm);
          return matchStatus && matchSearch;
      });
  }, [bookings, activeTab, searchTerm]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentBookings = filteredBookings.slice(indexOfFirstItem, indexOfLastItem);
  //console.log("Current Bookings:", currentBookings);
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);

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
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">Quản lý Đặt phòng</h1>
                <p className="text-gray-500 text-sm mt-1">Theo dõi và xử lý các đơn đặt phòng của khách hàng.</p>
            </div>
            <button onClick={handleOpenModal} className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-sm">
              <FiPlus size={20} /> Tạo đơn mới
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col min-h-[500px]">
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

            <div className="overflow-x-auto flex-1">
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
                  {currentBookings.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-8 text-gray-400 italic">Chưa có dữ liệu đặt phòng.</td></tr>
                  ) : currentBookings.map((b, index) => {
                    const statusInfo = STATUS_MAP[b.status] || STATUS_MAP.pending;
                    return (
                      <tr key={b._id || index} className="border-b border-gray-50 hover:bg-gray-50 transition group align-top">
                        <td className="py-4 pl-4">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                                    {b.customer_info?.full_name?.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">{b.customer_info?.full_name}</div>
                                    <div className="text-xs text-gray-500">{b.customer_info?.phone_number}</div>
                                </div>
                            </div>
                        </td>
                        <td className="py-4">
                            <div className="flex flex-col gap-2">
                                {b.rooms?.map((r,i) => (
                                    <div key={i} className="flex items-center gap-2">
                                        <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs border border-gray-200">
                                            P.{r.room_info?.room_number}
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
                                <button
                                    onClick={() => setSelectedBooking(b)}
                                    className="flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1 rounded hover:bg-slate-100 border border-slate-200 transition"
                                >
                                    <FiEye size={13}/> Chi tiết
                                </button>
                                {b.status === 'pending' && (
                                    <button onClick={() => actionConfirm(b._id)}
                                        className="text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded hover:bg-indigo-100 transition">
                                        Xác nhận cọc
                                    </button>
                                )}
                                {b.rooms?.map((r, i) => {
                                  //console.log(`Room ${r.room_number} status:`, r.status, "for booking", b.status);
                                    if(b.status === 'confirmed' && r.status === 'confirmed') {
                                        return (
                                            <button 
                                                key={i} 
                                                onClick={()=>actionCheckIn(r._id, b._id, r.room_info?.room_number)}
                                                className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded hover:bg-emerald-100 transition"
                                            >
                                                <FiLogIn/> Check-in
                                            </button>
                                        );
                                    }
                                    if(r.status === 'checked_in')
                                        return (
                                            <button key={i} onClick={()=>actionCheckOut(r._id,b._id,r.room_info?.room_number)}
                                                className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded hover:bg-orange-100 transition">
                                                <FiLogOut/> Check-out
                                            </button>
                                        );
                                    // Kiểm tra nếu đã checkout nhưng chưa có cleaningTask hoặc chưa gán nhân viên
                                    if(r.status === 'checked_out' && r.room_info?._id) {
                                        const roomId = r.room_info._id;
                                        const taskInfo = cleaningTasksMap[roomId];
                                        
                                        // Kiểm tra nếu có cleaning task với status "completed" - hiển thị button xác nhận
                                        if (taskInfo && taskInfo.status === 'completed') {
                                            return (
                                                <button
                                                    key={i}
                                                    onClick={() => setConfirmState({
                                                        open: true,
                                                        title: "Xác nhận dọn dẹp",
                                                        message: `Xác nhận hoàn thành dọn dẹp phòng ${r.room_info?.room_number}?`,
                                                        confirmText: "Xác nhận",
                                                        type: "success",
                                                        onConfirm: async () => {
                                                            setConfirmState(p => ({ ...p, open: false }));
                                                            try {
                                                                await bookingApi.confirmCleaning(taskInfo._id);
                                                                setToast({ type: "success", message: "Xác nhận hoàn thành dọn dẹp thành công!" });
                                                                await checkCleaningTasks(bookings);
                                                                fetchData();
                                                            } catch (error) {
                                                                setToast({ type: "error", message: "Lỗi: " + (error.response?.data?.message || error.message) });
                                                            }
                                                        }
                                                    })}
                                                    disabled={!isManager}
                                                    className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded transition ${
                                                        isManager
                                                            ? "text-green-600 bg-green-50 hover:bg-green-100"
                                                            : "text-gray-400 bg-gray-100 cursor-not-allowed"
                                                    }`}
                                                    title={!isManager ? "Chỉ quản lý mới có thể xác nhận" : "Xác nhận hoàn thành dọn dẹp"}
                                                >
                                                    <FiCheck className="w-3 h-3"/> Xác nhận dọn dẹp
                                                </button>
                                            );
                                        }
                                        
                                        // undefined = chưa kiểm tra hoặc không có RoomLog
                                        // object với needsAssignment = true = có task nhưng chưa gán nhân viên hoặc chưa có task
                                        // object với handled_by = đã có task và đã gán nhân viên
                                        // Kiểm tra: có task nhưng chưa gán nhân viên (handled_by = null hoặc undefined)
                                        const needsAssignment = taskInfo && (
                                          taskInfo.needsAssignment || 
                                          !taskInfo.handled_by || 
                                          (taskInfo.handled_by === null)
                                        );
                                        
                                        if (needsAssignment) {
                                            return (
                                                <button 
                                                    key={i} 
                                                    onClick={async () => {
                                                        try {
                                                            // Lấy thông tin từ taskInfo hoặc API
                                                            let room_log_id = null;
                                                            if (taskInfo && taskInfo.room_log_id) {
                                                                room_log_id = taskInfo.room_log_id;
                                                            } else if (taskInfo && taskInfo._id) {
                                                                // Đã có task, lấy room_log_id từ task
                                                                room_log_id = taskInfo.room_log_id?._id || taskInfo.room_log_id;
                                                            } else {
                                                                // Chưa có task, tìm room_log_id từ API
                                                            const res = await bookingApi.getCleaningTaskByRoom({
                                                                room_id: roomId,
                                                                booking_id: b._id
                                                            });
                                                                room_log_id = res.room_log_id || null;
                                                            }
                                                            
                                                            setCleaningData({
                                                                room_id: roomId,
                                                                room_number: r.room_info?.room_number,
                                                                booking_id: b._id,
                                                                room_log_id: room_log_id,
                                                                task_id: taskInfo?._id || null // Nếu đã có task thì truyền task_id
                                                            });
                                                            setShowAssignHousekeeperModal(true);
                                                        } catch (error) {
                                                            console.error("Error:", error);
                                                            setToast({ type: "error", message: "Lỗi khi tải thông tin: " + (error.response?.data?.message || error.message) });
                                                        }
                                                    }}
                                                    disabled={!isManager || loadingCleaningTasks}
                                                    className={`flex items-center gap-1 text-xs font-bold px-3 py-1 rounded transition ${
                                                        isManager && !loadingCleaningTasks
                                                            ? "text-yellow-600 bg-yellow-50 hover:bg-yellow-100"
                                                            : "text-gray-400 bg-gray-100 cursor-not-allowed"
                                                    }`}
                                                    title={!isManager ? "Chỉ quản lý mới có thể gán nhân viên" : "Gán nhân viên dọn dẹp"}
                                                >
                                                    <FiUserPlus className="w-3 h-3"/> Gán dọn dẹp
                                                </button>
                                            );
                                        }
                                    }
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

            {filteredBookings.length > 0 && (
                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                    <div className="text-sm text-gray-500">
                        Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredBookings.length)}</b> trong tổng <b>{filteredBookings.length}</b>
                    </div>
                    {renderPaginationButtons()}
                </div>
            )}
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
                {/* Chọn loại đặt phòng */}
                <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <label className="block text-sm font-bold text-gray-700 mb-2">Loại đặt phòng <span className="text-red-500">*</span></label>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => { 
                            setBookingMode('immediate'); 
                            setIsWalkIn(true);
                            // Tự động set thời gian check-in = hiện tại + 10 phút
                            const now = new Date();
                            const checkinTime = addMinutes(now, 10);
                            setFormData(prev => ({
                              ...prev,
                              expected_checkin: format(checkinTime, "yyyy-MM-dd'T'HH:mm")
                            }));
                          }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition ${bookingMode==='immediate' ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-white'}`}>
                            Đặt liền (Khách tại quầy)
                        </button>
                        <button type="button" onClick={() => {
                            setBookingMode('advance');
                            setIsWalkIn(false);
                            // Đặt giờ check-in chuẩn 2:00 SA khi chuyển sang đặt trước
                            const now = new Date();
                            const checkinTime = setMinutes(setHours(now, 2), 0);
                            setFormData(prev => ({
                              ...prev,
                              expected_checkin: format(checkinTime, "yyyy-MM-dd'T'HH:mm")
                            }));
                          }}
                            className={`flex-1 py-2.5 rounded-lg text-sm font-bold border-2 transition ${bookingMode==='advance' ? 'border-indigo-600 text-indigo-600 bg-white shadow-sm' : 'border-gray-200 text-gray-500 hover:bg-white'}`}>
                            Đặt trước (Cần cọc)
                        </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                        {bookingMode === 'immediate' 
                            ? 'Đặt liền: Khách thanh toán ngay, không cần cọc, tạo hóa đơn luôn.'
                            : 'Đặt trước: Khách cần đặt cọc qua chuyển khoản để giữ chỗ.'}
                    </p>
                </div>

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

                                {/* Nút Lưu khách hàng */}
                                <div className="pt-2">
                                    <button
                                        type="button"
                                        onClick={handleSaveCustomer}
                                        disabled={savingCustomer || !newCustomer.full_name || !newCustomer.phone_number || !newCustomer.CCCD}
                                        className="w-full flex items-center justify-center gap-2 bg-green-600 text-white px-4 py-2.5 rounded-lg font-bold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                                    >
                                        {savingCustomer ? (
                                            <>
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                Đang lưu...
                                            </>
                                        ) : (
                                            <>
                                                <FiSave size={16} />
                                                Lưu khách hàng
                                            </>
                                        )}
                                    </button>
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
                        {selectedRooms.map((r, idx) => {
                            const nights = (formData.expected_checkin && formData.expected_checkout)
                              ? Math.max(calcNights(formData.expected_checkin, formData.expected_checkout), 0)
                              : 0;
                            const roomTotal = nights > 0 ? r.price * nights : 0;
                            return (
                                <div key={r._id} className="flex justify-between items-center bg-white border border-gray-200 p-2.5 rounded-lg shadow-sm hover:border-indigo-300 transition">
                                    <div><span className="font-bold text-indigo-700 text-lg mr-2">{r.room_number}</span><span className="text-xs text-gray-500 uppercase font-semibold">{r.category_name}</span></div>
                                    <div className="flex flex-col items-end gap-1">
                                        {nights > 0 ? (
                                            <>
                                                <span className="text-xs text-gray-500">{r.price.toLocaleString()} đ/đêm × {nights} đêm</span>
                                                <span className="text-sm font-bold text-gray-700">{roomTotal.toLocaleString()} đ</span>
                                            </>
                                        ) : (
                                            <span className="text-sm font-bold text-gray-700">{r.price.toLocaleString()} đ/đêm</span>
                                        )}
                                        <button type="button" onClick={() => handleRemoveRoom(r._id)} className="text-gray-400 hover:text-red-500 transition"><FiTrash2 size={18}/></button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="border-t border-gray-100 pt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Khuyến mãi</label>
                    {loadingDiscounts ? (
                      <div className="text-sm text-gray-500 py-2">Đang tải khuyến mãi...</div>
                    ) : availableDiscounts.length > 0 ? (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {availableDiscounts.map((discount) => (
                          <div
                            key={discount.id}
                            className={`border rounded-lg p-3 cursor-pointer transition ${
                              discount.is_available
                                ? selectedDiscount?.id === discount.id
                                  ? "border-indigo-500 bg-indigo-50"
                                  : "border-gray-200 hover:border-indigo-300 hover:bg-gray-50"
                                : "border-gray-200 bg-gray-100 opacity-60 cursor-not-allowed"
                            }`}
                            onClick={() => discount.is_available && handleSelectDiscount(discount)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="font-bold text-sm text-indigo-700">{discount.code}</span>
                                  {discount.is_available && (
                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded">Có thể áp dụng</span>
                                  )}
                                  {!discount.is_available && (
                                    <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">Không khả dụng</span>
                                  )}
                                </div>
                                <div className="font-semibold text-sm text-gray-800 mb-1">{discount.name}</div>
                                {discount.description && (
                                  <div className="text-xs text-gray-600 mb-1">{discount.description}</div>
                                )}
                                <div className="text-xs font-bold text-emerald-600">{discount.discount_text}</div>
                                {!discount.is_available && discount.availability_reason && (
                                  <div className="text-xs text-red-600 mt-1">{discount.availability_reason}</div>
                                )}
                              </div>
                              {selectedDiscount?.id === discount.id && (
                                <FiCheckCircle className="text-indigo-600 shrink-0" size={20} />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500 py-2">Không có khuyến mãi nào</div>
                    )}
                    {selectedDiscount && (
                      <div className="mt-2 flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg p-2">
                        <div className="flex items-center gap-2">
                          <FiCheckCircle className="text-indigo-600" size={16} />
                          <span className="text-sm font-semibold text-indigo-800">
                            Đã chọn: {selectedDiscount.name} ({selectedDiscount.code})
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveDiscount}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Bỏ chọn
                        </button>
                      </div>
                    )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Tổng Tiền (Dự kiến)</label>
                      <input type="text" disabled className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2 text-center font-bold text-gray-700 cursor-not-allowed" 
                        value={calcValues.total_price.toLocaleString()}/>
                    </div>
                    {bookingMode === 'advance' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Tiền Cọc (30%)</label>
                            <input type="text" disabled className="w-full border rounded-lg p-2 text-center font-bold outline-none transition bg-white text-emerald-600 border-gray-300 cursor-not-allowed" value={calcValues.deposit_required.toLocaleString()}/>
                            <p className="text-xs text-gray-500 mt-1">Số tiền cần đặt cọc để giữ chỗ</p>
                        </div>
                    )}
                    {bookingMode === 'immediate' && (
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Tiền Cọc</label>
                            <input type="text" disabled className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2 text-center font-bold text-gray-400 cursor-not-allowed" value="0 (Không cần cọc)"/>
                            <p className="text-xs text-gray-500 mt-1">Đặt liền không cần cọc</p>
                        </div>
                    )}
                </div>

                <div className="pt-4 mt-4 border-t border-gray-100">
                     <button type="submit" className="w-full bg-indigo-600 text-white py-3 rounded-lg font-bold hover:bg-indigo-700 transition shadow-md flex justify-center items-center gap-2">
                         <FiCheckCircle size={18}/> 
                         {bookingMode === 'immediate' ? 'Xác nhận Đặt Phòng (Đặt liền)' : 'Tạo Đơn & Thanh Toán Cọc'}
                     </button>
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

      {showAssignHousekeeperModal && cleaningData && (
        <AssignHousekeeperModal
          cleaningData={cleaningData}
          onClose={() => {
            setShowAssignHousekeeperModal(false);
            setCleaningData(null);
            // Tạo hóa đơn sau khi đóng modal (nếu user bỏ qua)
            // if (cleaningData.booking_id) {
            //   receiptApi.createReceipt({ 
            //     booking_id: cleaningData.booking_id, 
            //     payment: "cash", 
            //     note: "Hóa đơn tạo tự động khi checkout" 
            //   }).then(() => {
            //     alert("Check-out và tạo hóa đơn THÀNH CÔNG!");
            //   }).catch(err => {
            //     alert(`Check-out xong nhưng KHÔNG TẠO HÓA ĐƠN. Lỗi: ${err.response?.data?.message}`);
            //   });
            // }
          }}
          onSuccess={async () => {
            // Refresh lại danh sách để cập nhật cleaningTasksMap
            await checkCleaningTasks(bookings);
            
            // Tạo hóa đơn sau khi gán nhân viên thành công
            // if (cleaningData.booking_id) {
            //   receiptApi.createReceipt({ 
            //     booking_id: cleaningData.booking_id, 
            //     payment: "cash", 
            //     note: "Hóa đơn tạo tự động khi checkout" 
            //   }).then(() => {
            //     alert("Check-out, gán nhân viên và tạo hóa đơn THÀNH CÔNG!");
            //   }).catch(err => {
            //     alert(`Đã gán nhân viên nhưng KHÔNG TẠO HÓA ĐƠN. Lỗi: ${err.response?.data?.message}`);
            //   });
            // }
          }}
        />
      )}

      {selectedBooking && (
        <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
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

// ─── Booking Detail Modal ────────────────────────────────────────────────────

const USAGE_STATUS_LABEL = {
  pending: { label: "Chờ sử dụng", cls: "bg-blue-100 text-blue-700" },
  waiting_confirm: { label: "Chờ xác nhận", cls: "bg-yellow-100 text-yellow-800" },
  completed: { label: "Hoàn thành", cls: "bg-green-100 text-green-700" },
  cancelled: { label: "Đã hủy", cls: "bg-red-100 text-red-500" },
  expired: { label: "Hết hạn", cls: "bg-gray-100 text-gray-500" },
};

const INCIDENT_STATUS_LABEL = {
  open:     { label: "Mở", cls: "bg-red-100 text-red-700" },
  assigned: { label: "Đã phân công", cls: "bg-orange-100 text-orange-700" },
  resolved: { label: "Đã giải quyết", cls: "bg-blue-100 text-blue-700" },
  closed:   { label: "Đã đóng", cls: "bg-gray-100 text-gray-600" },
};

const RECEIPT_STATUS_LABEL = {
  paid:        { label: "Đã thanh toán", cls: "bg-emerald-100 text-emerald-700" },
  pending:     { label: "Chờ thanh toán", cls: "bg-orange-100 text-orange-700" },
  "half-paid": { label: "TT một phần",   cls: "bg-yellow-100 text-yellow-700" },
  cancelled:   { label: "Đã hủy",        cls: "bg-gray-100 text-gray-500" },
  refunded:    { label: "Đã hoàn tiền",  cls: "bg-blue-100 text-blue-700" },
};

const ROOM_STATUS_MAP = {
  confirmed:   { label: "Đã xác nhận", color: "bg-blue-100 text-blue-700" },
  checked_in:  { label: "Đang ở",      color: "bg-indigo-100 text-indigo-700" },
  checked_out: { label: "Đã trả",      color: "bg-gray-100 text-gray-600" },
  cancelled:   { label: "Đã hủy",      color: "bg-red-100 text-red-500" },
};

const STATUS_HEADER_BG = {
  yellow:  "from-amber-500 to-yellow-400",
  blue:    "from-blue-600 to-sky-400",
  indigo:  "from-indigo-600 to-violet-500",
  emerald: "from-emerald-600 to-teal-400",
  red:     "from-red-600 to-rose-400",
  gray:    "from-gray-500 to-slate-400",
};

function SectionBlock({ colorCls, label, children }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span className={`w-1 h-4 rounded-full ${colorCls}`} />
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      </div>
      {children}
    </div>
  );
}

function SkeletonBlock() {
  return <div className="h-16 bg-gray-100 rounded-xl animate-pulse" />;
}

function BookingDetailModal({ booking: b, onClose }) {
  const [serviceUsages, setServiceUsages] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchExtra = async () => {
      try {
        const [svcRes, rcptRes, incRes] = await Promise.allSettled([
          serviceApi.getAllServiceUsage({ booking_id: b._id }),
          receiptApi.getAllReceipts({ booking_id: b._id }),
          incidentApi.getAllIncidents({ booking_id: b._id }),
        ]);
        if (svcRes.status === "fulfilled") setServiceUsages(svcRes.value?.data || []);
        if (rcptRes.status === "fulfilled") setReceipt((rcptRes.value?.receipts || [])[0] || null);
        if (incRes.status === "fulfilled") setIncidents(incRes.value?.data || []);
      } finally {
        setLoading(false);
      }
    };
    fetchExtra();
  }, [b._id]);

  const nights = calcNights(b.expected_checkin, b.expected_checkout);
  const statusInfo = STATUS_MAP[b.status] || STATUS_MAP.pending;
  const headerGradient = STATUS_HEADER_BG[statusInfo.color] || STATUS_HEADER_BG.gray;

  const totalServiceFee = serviceUsages.reduce((acc, s) => acc + (s.total_fee || 0), 0);
  const remaining = Math.max(0, (b.total_fee || 0) - (b.deposit || 0));

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">

        {/* Gradient Header */}
        <div className={`relative bg-gradient-to-r ${headerGradient} px-6 py-5 text-white`}>
          <button
            onClick={onClose}
            className="absolute right-4 top-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition"
          >✕</button>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center font-black text-xl shadow-inner">
              {b.customer_info?.full_name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-black text-xl truncate">{b.customer_info?.full_name}</h3>
              <p className="text-white/70 text-sm mt-0.5">{b.customer_info?.phone_number}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="px-3 py-0.5 rounded-full text-xs font-black bg-white/25 border border-white/30 uppercase tracking-wide">
                  {statusInfo.label}
                </span>
                <span className="text-white/50 text-xs font-mono">#{b._id?.slice(-8).toUpperCase()}</span>
                <span className="text-white/50 text-xs">
                  {format(new Date(b.expected_checkin), "dd/MM/yyyy")} → {format(new Date(b.expected_checkout), "dd/MM/yyyy")}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6 no-scrollbar">

          {/* Date grid */}
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Check-in</p>
              <p className="text-sm font-black text-slate-800">{format(new Date(b.expected_checkin), "HH:mm")}</p>
              <p className="text-xs text-slate-500">{format(new Date(b.expected_checkin), "dd/MM/yyyy")}</p>
            </div>
            <div className="bg-indigo-50 p-3 rounded-xl border border-indigo-100 text-center">
              <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Đêm</p>
              <p className="text-2xl font-black text-indigo-700">{nights}</p>
            </div>
            <div className="col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-100 text-end">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Check-out</p>
              <p className="text-sm font-black text-slate-800">{format(new Date(b.expected_checkout), "HH:mm")}</p>
              <p className="text-xs text-slate-500">{format(new Date(b.expected_checkout), "dd/MM/yyyy")}</p>
            </div>
          </div>

          {/* Customer */}
          <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
            <SectionBlock colorCls="bg-indigo-500" label="Thông tin khách hàng">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase">Họ tên</p>
                  <p className="font-bold text-gray-900">{b.customer_info?.full_name || "---"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase">Điện thoại</p>
                  <p className="font-bold text-gray-900">{b.customer_info?.phone_number || "---"}</p>
                </div>
                {b.customer_info?.CCCD && (
                  <div className="col-span-2">
                    <p className="text-[10px] text-indigo-400 font-bold uppercase">CCCD</p>
                    <p className="font-mono text-gray-700 text-sm">{b.customer_info.CCCD}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase">Người lớn</p>
                  <p className="font-bold text-gray-900">{b.adults || 1} người</p>
                </div>
                <div>
                  <p className="text-[10px] text-indigo-400 font-bold uppercase">Trẻ em</p>
                  <p className="font-bold text-gray-900">{b.children || 0} em</p>
                </div>
              </div>
            </SectionBlock>
          </div>

          {/* Rooms */}
          <SectionBlock colorCls="bg-violet-500" label={`Phòng đã đặt  (${b.rooms?.length || 0})`}>
            <div className="space-y-2">
              {b.rooms?.map((r, i) => {
                const rs = ROOM_STATUS_MAP[r.status] || { label: r.status, color: "bg-gray-100 text-gray-600" };
                return (
                  <div key={i} className="flex items-center justify-between p-3 bg-white border border-gray-100 rounded-xl shadow-sm hover:border-violet-100 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center font-black text-sm">
                        {r.room_info?.room_number}
                      </div>
                      <div>
                        <p className="font-bold text-gray-800 text-sm">Phòng {r.room_info?.room_number}</p>
                        {r.room_info?.category_name && <p className="text-xs text-gray-400">{r.room_info.category_name}</p>}
                      </div>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full ${rs.color}`}>{rs.label}</span>
                  </div>
                );
              })}
            </div>
          </SectionBlock>

          {/* Handler employee */}
          {b.handler_employee_info && (
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100">
              <SectionBlock colorCls="bg-amber-500" label="Nhân viên phụ trách">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-200 text-amber-700 flex items-center justify-center font-black text-base">
                    {b.handler_employee_info?.full_name?.charAt(0).toUpperCase() || "?"}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{b.handler_employee_info?.full_name}</p>
                    <p className="text-xs text-gray-500 capitalize">{b.handler_employee_info?.position || b.handler_employee_info?.role || ""}</p>
                  </div>
                </div>
              </SectionBlock>
            </div>
          )}

          {/* Financials */}
          <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
            <SectionBlock colorCls="bg-emerald-500" label="Tài chính">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Tổng tiền phòng</span>
                  <span className="font-black text-gray-800">{(b.total_fee || 0).toLocaleString()} đ</span>
                </div>
                {totalServiceFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Phí dịch vụ</span>
                    <span className="font-bold text-orange-600">{totalServiceFee.toLocaleString()} đ</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Tiền cọc</span>
                  <span className="font-bold text-indigo-600">{(b.deposit || 0).toLocaleString()} đ</span>
                </div>
                {b.discount_id && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mã giảm giá</span>
                    <span className="font-bold text-emerald-600">{b.discount_id?.code || "Đã áp dụng"}</span>
                  </div>
                )}
                <div className="border-t border-emerald-100 pt-2 flex justify-between font-bold">
                  <span className="text-gray-700">Còn lại cần thu</span>
                  <span className="text-emerald-700 text-base">{remaining.toLocaleString()} đ</span>
                </div>
              </div>
            </SectionBlock>
          </div>

          {/* Service Usage */}
          <SectionBlock colorCls="bg-orange-500" label="Dịch vụ đã sử dụng">
            {loading ? <SkeletonBlock /> : serviceUsages.length === 0 ? (
              <div className="p-4 bg-orange-50 rounded-xl border border-orange-100 text-center text-sm text-orange-400 italic">Chưa có dịch vụ nào</div>
            ) : (
              <div className="space-y-2">
                {serviceUsages.map((s, i) => {
                  const st = USAGE_STATUS_LABEL[s.status] || { label: s.status, cls: "bg-gray-100 text-gray-500" };
                  return (
                    <div key={i} className="flex items-center justify-between p-3 bg-orange-50 border border-orange-100 rounded-xl">
                      <div>
                        <p className="font-bold text-sm text-gray-800">Phiếu #{s._id.slice(-6).toUpperCase()}</p>
                        <p className="text-xs text-gray-500">NV: {s.employee_id?.full_name || "System"}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-orange-700 text-sm">{(s.total_fee || 0).toLocaleString()} đ</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-end text-sm pt-1 pr-1">
                  <span className="font-black text-orange-700">Tổng: {totalServiceFee.toLocaleString()} đ</span>
                </div>
              </div>
            )}
          </SectionBlock>

          {/* Incidents — only shown when loading or when there are any */}
          {(loading || incidents.length > 0) && (
            <SectionBlock colorCls="bg-red-500" label="Sự cố & Bồi thường">
              {loading ? <SkeletonBlock /> : (
                <div className="space-y-2">
                  {incidents.map((inc, i) => {
                    const ist = INCIDENT_STATUS_LABEL[inc.status] || { label: inc.status, cls: "bg-gray-100 text-gray-500" };
                    return (
                      <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-xl">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-gray-800">{inc.type || "Sự cố"}</p>
                            {inc.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{inc.description}</p>}
                          </div>
                          <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${ist.cls}`}>{ist.label}</span>
                        </div>
                        {inc.causer_name && (
                          <p className="text-xs text-red-600 mt-1.5 font-medium">Gây ra bởi: {inc.causer_name}</p>
                        )}
                        {inc.compensation_status && inc.compensation_status !== "none" && (
                          <p className="text-xs text-orange-600 mt-0.5 font-medium">Bồi thường: {inc.compensation_status}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionBlock>
          )}

          {/* Receipt */}
          <SectionBlock colorCls="bg-teal-500" label="Hóa đơn">
            {loading ? <SkeletonBlock /> : !receipt ? (
              <div className="p-4 bg-teal-50 rounded-xl border border-teal-100 text-center text-sm text-teal-400 italic">Chưa có hóa đơn</div>
            ) : (
              <div className="p-4 bg-teal-50 border border-teal-100 rounded-xl space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-teal-600 font-bold">#{receipt._id.slice(-8).toUpperCase()}</span>
                  {(() => {
                    const rst = RECEIPT_STATUS_LABEL[receipt.status] || { label: receipt.status, cls: "bg-gray-100 text-gray-500" };
                    return <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${rst.cls}`}>{rst.label}</span>;
                  })()}
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tổng hóa đơn</span>
                  <span className="font-black text-teal-700 text-base">{(receipt.final_amount || 0).toLocaleString()} đ</span>
                </div>
                {receipt.deposit_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Đã cọc</span>
                    <span className="font-bold text-indigo-600">{receipt.deposit_amount.toLocaleString()} đ</span>
                  </div>
                )}
                {receipt.payment && receipt.payment !== "unknown" && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Phương thức</span>
                    <span className="font-bold text-gray-700">{receipt.payment === "cash" ? "Tiền mặt" : "Chuyển khoản (PayOS)"}</span>
                  </div>
                )}
                {receipt.created_at && (
                  <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-teal-100">
                    <span>Ngày tạo HĐ</span>
                    <span>{format(new Date(receipt.created_at), "dd/MM/yyyy HH:mm")}</span>
                  </div>
                )}
              </div>
            )}
          </SectionBlock>

        </div>

        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className={`px-8 py-2.5 bg-gradient-to-r ${headerGradient} text-white font-black rounded-xl text-xs hover:opacity-90 transition shadow-lg uppercase tracking-widest`}
          >
            Đóng lại
          </button>
        </div>
      </div>
    </div>
  );
}
