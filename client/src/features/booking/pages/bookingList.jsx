import React, { useState, useEffect, useRef, useMemo } from "react";
import { format, addDays, setHours, setMinutes, addMinutes } from "date-fns";
import {
  FiPlus, FiX, FiTrash2, FiSearch, FiCheckCircle, FiLogOut, FiUser,
  FiUserPlus, FiUsers, FiTag, FiLogIn, FiMinusCircle, FiCheckSquare, FiSquare,
  FiCalendar, FiMapPin, FiAlertTriangle, FiCamera, FiUpload,
  FiChevronLeft, FiChevronRight, FiSave, FiCheck
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
import { paymentApi } from "../../api/paymentApi.js";
import { discountApi } from "../../api/discountApi.js";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import AssignHousekeeperModal from "../components/assignHousekeeperModal.jsx";

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
  if (!employeeId) return alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại!");

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
  const [rawPrice, setRawPrice] = useState({ total: 0, deposit: 0 });
  const [isPreviewLocked, setIsPreviewLocked] = useState(false);
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
    if (isPreviewLocked) return;
    if (!formData.expected_checkin || !formData.expected_checkout) {
      setCalcValues({ total_price: 0, deposit_required: 0 });
      return;
    }
    // Tính số đêm giống như backend (calcNights)
    const diffMs = new Date(formData.expected_checkout) - new Date(formData.expected_checkin);
    if (diffMs <= 0) {
      setCalcValues({ total_price: 0, deposit_required: 0 });
      return;
    }
    const diffHours = diffMs / (1000 * 60 * 60);
    const days = diffHours / 24;
    const nights = Math.ceil(days * 100) / 100; // Làm tròn lên 2 chữ số thập phân giống backend
    
    // Tính tổng tiền: giá phòng * số đêm (giống backend)
    const total = selectedRooms.reduce((sum, r) => sum + (r.price * nights), 0);
    let finalTotal = total;
    if (selectedDiscount && selectedDiscount.discount_amount > 0) {
      finalTotal = total - selectedDiscount.discount_amount;
    }
    const deposit = (bookingMode === 'immediate' || isWalkIn) ? 0 : (finalTotal * 0.3);
    setCalcValues({ total_price: finalTotal, deposit_required: deposit });
    setFormData(prev => ({...prev, deposit: deposit}));
  }, [selectedRooms, isWalkIn, isPreviewLocked, bookingMode, formData.expected_checkin, formData.expected_checkout, selectedDiscount]);

  // useEffect để fetch discounts khi selectedRooms thay đổi
  useEffect(() => {
    if (formData.customer_id && selectedRooms.length > 0) {
      fetchAvailableDiscounts();
    }
  }, [selectedRooms, formData.customer_id]);


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
  
  const checkCleaningTasks = async (bookings) => {
    setLoadingCleaningTasks(true);
    try {
      // Lấy tất cả các phòng đã checkout (loại bỏ trùng lặp room_id)
      const checkedOutRoomsMap = new Map(); // Map<room_id, {room_id, booking_id, detail_id}>
      bookings.forEach(booking => {
        booking.rooms?.forEach(room => {
          if (room.status === 'checked_out' && room.room_id?._id) {
            const roomId = room.room_id._id;
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
            //console.log("CLEANING TASKS: ", res);
            // Kiểm tra xem room_id đã có trong map chưa và đã có needsAssignment chưa
            const existingTask = tasksMap[roomInfo.room_id];
            const alreadyNeedsAssignment = existingTask && existingTask.needsAssignment === true;
            
            if (res.success && res.task) {
              // Kiểm tra xem task đã có handled_by chưa
              // handled_by có thể là null, undefined, hoặc object (khi populate)
              const hasHandledBy = res.task.handled_by && 
                (typeof res.task.handled_by === 'object' ? res.task.handled_by._id : res.task.handled_by);
              //console.log("has handledby: ", hasHandledBy);
              if (!hasHandledBy) {
                //console.log("IM CALLED");
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
      const flatRooms = res.flatMap(c => c.rooms.map(r => ({
          _id: r.room_id || r._id, room_number: r.room_number, category_name: c.name || c.category_name, price: c.price
        }))
      );
      setRoomsList(flatRooms);
    } catch (err) { setRoomsList([]); }
  };

  // Hàm fetch available discounts
  const fetchAvailableDiscounts = async () => {
    if (!formData.customer_id || !selectedRooms.length) {
      setAvailableDiscounts([]);
      return;
    }
    
    setLoadingDiscounts(true);
    try {
      // Tính tổng tiền đơn hàng
      const totalOrderValue = selectedRooms.reduce((sum, room) => {
        const nights = Math.ceil((new Date(formData.expected_checkout) - new Date(formData.expected_checkin)) / (1000 * 60 * 60 * 24));
        return sum + (room.price * nights);
      }, 0);
      //console.log("Total order value for discounts:", totalOrderValue);
      
      //console.log("Fetching available discounts for customer:", formData.customer_id);
      const res = await discountApi.getAvailableDiscounts(formData.customer_id, totalOrderValue);
      //console.log("Available discounts fetched:", res);
      if (res.success) {
        setAvailableDiscounts(res.discounts || []);
      }
    } catch (err) {
      console.error("Error fetching discounts:", err);
      setAvailableDiscounts([]);
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
      setIsPreviewLocked(false);
      if (!tempRoomId) return;
      const roomToAdd = roomsList.find(r => r._id === tempRoomId);
      if (roomToAdd && !selectedRooms.some(r => r._id === roomToAdd._id)) {
          setSelectedRooms([...selectedRooms, roomToAdd]);
      }
      setTempRoomId("");
  };

  const handleRemoveRoom = (roomId) => {
      setIsPreviewLocked(false);
      setSelectedRooms(selectedRooms.filter(r => r._id !== roomId));
  };

  const handleSaveCustomer = async () => {
    // Validate các trường bắt buộc
    if (!newCustomer.full_name || !newCustomer.phone_number || !newCustomer.CCCD) {
      alert("Vui lòng điền đầy đủ các trường bắt buộc: Họ tên, SĐT, CCCD");
      return;
    }

    setSavingCustomer(true);
    try {
      const randomPassword = "Khach@" + Math.floor(1000 + Math.random() * 9000);
      let emailToUse = newCustomer.email || `${newCustomer.phone_number}@guest.local`;

      const resCust = await customerApi.createCustomer({ 
        ...newCustomer, 
        email: emailToUse, 
        password: randomPassword 
      });

      //console.log("New customer created:", resCust);
      
      if (resCust && resCust.customerId) {
        // Refresh danh sách khách hàng
        const custRes = await customerApi.getAllCustomers();
        setCustomersList(custRes.customers || []);

        // Tìm khách hàng vừa tạo
        const createdCustomer = (custRes.customers || []).find(
          c => c._id === resCust.customerId || c.user_id === resCust.customerId
        );

        if (createdCustomer) {
          // Chuyển sang mode existing và chọn khách hàng vừa tạo
          setCustomerMode("existing");
          selectCustomer(createdCustomer);
          setFormData(prev => ({ ...prev, customer_id: createdCustomer._id || resCust.customerId }));
          
          // Reset form khách hàng mới
          setNewCustomer({ 
            email: "", 
            full_name: "", 
            phone_number: "", 
            date_birth: "", 
            nationality: "Vietnam", 
            CCCD: "" 
          });
          
          alert("Lưu khách hàng thành công! Đã tự động chọn khách hàng vừa tạo.");
        } else {
          alert("Lưu khách hàng thành công! Vui lòng chọn khách hàng từ danh sách.");
        }
      } else {
        throw new Error("Không nhận được customerId từ server");
      }
    } catch (error) {
      console.error("Error saving customer:", error);
      alert("Lỗi khi lưu khách hàng: " + (error.response?.data?.message || error.message));
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
      checkin = setMinutes(setHours(now, 14), 0);
    }
    const checkout = setMinutes(setHours(addDays(now, 1), 12), 0);
    setFormData({ customer_id: "", adults: 1, children: 0, expected_checkin: format(checkin, "yyyy-MM-dd'T'HH:mm"), expected_checkout: format(checkout, "yyyy-MM-dd'T'HH:mm"), deposit: 0 });
    setSelectedRooms([]); setTempRoomId(""); setIsWalkIn(false); setIsPreviewLocked(false); setCalcValues({ total_price: 0, deposit_required: 0 });
    setSelectedDiscount(null); setAvailableDiscounts([]);
    setNewCustomer({ email: "", full_name: "", phone_number: "", date_birth: "", nationality: "Vietnam", CCCD: "" });
    setCustomerMode("existing"); setCustSearchQuery(""); setSelectedCustDisplay(null); setShowCustDropdown(false);
    setShowQrScanner(false); setQrScanning(false); setQrError(null);
    setBookingMode("immediate"); // Reset về đặt liền
    setSavingCustomer(false);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (new Date(formData.expected_checkout) <= new Date(formData.expected_checkin)) return alert("Ngày check-out phải sau ngày check-in!");

      if (selectedRooms.length === 0) return alert("Vui lòng chọn ít nhất một phòng!");

      let finalCustomerId = formData.customer_id;
      if (customerMode === "new") {
          const randomPassword = "Khach@" + Math.floor(1000 + Math.random() * 9000);
          let emailToUse = newCustomer.email || `${newCustomer.phone_number}@guest.local`;

          const resCust = await customerApi.createCustomer({ ...newCustomer, email: emailToUse, password: randomPassword });
          //console.log("New customer created:", resCust);
          if (resCust && resCust.customerId) 
            finalCustomerId = resCust.customerId;
          else throw new Error("Lỗi khi tạo hồ sơ khách hàng mới.");
      }
      if (!finalCustomerId) return alert("Vui lòng chọn khách hàng!");

      const depositAmount = bookingMode === "immediate" ? 0 : Number(calcValues.deposit_required);
      
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

      console.log("Payload booking:", payloadBooking);

      // Đặt liền: tạo booking và ghi hóa đơn ngay
      if (bookingMode === "immediate") {
        await bookingApi.createBooking(payloadBooking);
        alert("Tạo đặt phòng thành công!"); 
        setIsModalOpen(false); 
        fetchData();
      } 
      // Đặt trước: tạo booking và tạo payment link
      else {
        // Tạo booking trước
        const bookingRes = await bookingApi.createBooking(payloadBooking);
        console.log("Booking created:", bookingRes);
        const bookingId = bookingRes?.booking_id;
        
        if (!bookingId) {
          throw new Error("Không thể lấy ID booking sau khi tạo.");
        }

        //console.log("Deposit amount:", depositAmount);
        // Tạo payment link cho tiền cọc
        const paymentData = {
          booking_id: bookingId,
          amount: depositAmount,
          description: `Tiền cọc đơn ID: #${bookingId.toString().slice(-6)}`,
          items: [{
            name: `Tiền cọc đặt phòng`,
            quantity: 1,
            price: depositAmount
          }]
        };
        console.log("Creating payment link with data:", paymentData);

        const paymentRes = await paymentApi.createPaymentLink(employeeId, paymentData);
        console.log("Payment link response:", paymentRes);
        
        if (paymentRes?.success && paymentRes?.data?.checkoutUrl) {
          // Mở link thanh toán trong tab mới
          window.open(paymentRes.data.checkoutUrl, '_blank');
          setToast({ 
            message: "Đã tạo đơn đặt phòng. Vui lòng thanh toán tiền cọc để hoàn tất.", 
            type: "info" 
          });
          setIsModalOpen(false);
          fetchData();
        } else {
          throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
        }
      }
    } catch (error) { 
      alert("Lỗi: " + (error.response?.data?.message || error.message)); 
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
        result = await qrApi.scanQRCode(imageFile);
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
        alert("Không tìm thấy thông tin booking.");
        return;
      }

      if (!booking.deposit || booking.deposit === 0) {
        alert("Booking này không cần đặt cọc.");
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
      const paymentData = {
        booking_id: bookingId,
        receipt_id: receiptId,
        amount: booking.deposit,
        description: `Tiền cọc đơn ID: #${bookingId.toString().slice(-6)}`,
        items: [{
          name: `Tiền cọc đặt phòng`,
          quantity: 1,
          price: booking.deposit
        }]
      };

      const paymentRes = await paymentApi.createPaymentLink(employeeId, paymentData);
      
      if (paymentRes?.success && paymentRes?.data?.checkoutUrl) {
        // Mở link thanh toán trong tab mới
        window.open(paymentRes.data.checkoutUrl, '_blank');
        setToast({ 
          message: "Đã tạo link thanh toán PayOS. Vui lòng thanh toán tiền cọc trong cửa sổ mới.", 
          type: "info" 
        });
      } else {
        throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
      }
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.error || error.message));
    }
  };

  const actionCheckIn = (did, bid, rNum, expectedCheckin) => {
      const now = new Date();
      const checkinTime = new Date(expectedCheckin);
      const twoHoursBefore = new Date(checkinTime.getTime() - 2 * 60 * 60 * 1000); // 2 giờ trước check-in
      
      // Kiểm tra nếu chưa đến 2h trước giờ check-in
      if (now < twoHoursBefore) {
          const remainingTime = Math.ceil((twoHoursBefore.getTime() - now.getTime()) / (1000 * 60)); // phút
          const hours = Math.floor(remainingTime / 60);
          const minutes = remainingTime % 60;
          alert(`Chưa đến thời gian check-in! Còn ${hours} giờ ${minutes} phút nữa mới có thể check-in (phải cách giờ check-in dự kiến ít nhất 2 giờ).`);
          return;
      }
      
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
                  alert(`Check-in phòng ${rNum} thành công!`); 
              }
              catch(err) { 
                  alert(`Lỗi: ${err.response?.data?.message || err.message}`); 
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

  const actionCheckOut = (did, bid, rNum, expectedCheckout) => {
    const now = new Date();
    const checkoutTime = new Date(expectedCheckout);
    const twoHoursBefore = new Date(checkoutTime.getTime() - 2 * 60 * 60 * 1000); // 2 giờ trước check-out
    
    // Kiểm tra nếu chưa đến 2h trước giờ check-out
    if (now < twoHoursBefore) {
        const remainingTime = Math.ceil((twoHoursBefore.getTime() - now.getTime()) / (1000 * 60)); // phút
        const hours = Math.floor(remainingTime / 60);
        const minutes = remainingTime % 60;
        alert(`Chưa đến thời gian check-out! Còn ${hours} giờ ${minutes} phút nữa mới có thể check-out (phải cách giờ check-out dự kiến ít nhất 2 giờ).`);
        return;
    }

    setConfirmState({
      open: true, title: `Check-out Phòng ${rNum}`, message: `Xác nhận khách trả phòng ${rNum} ?`, confirmText: "Trả phòng", type: "warning",
      onConfirm: async () => {
        try {
          const res = await bookingApi.checkoutBookingDetail(bid, did);
          if (res.success && res.data && res.data.room_log_id) {
            // Hiển thị modal gán nhân viên dọn dẹp
            setCleaningData(res.data);
            setShowAssignHousekeeperModal(true);
          }
          fetchData(); 
          setConfirmState(p => ({...p, open: false}));
        } catch(e) { alert("Lỗi: " + e.message); }
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
                                  //console.log(`Room ${r.room_number} status:`, r.status, "for booking", b.status);
                                    if(b.status === 'confirmed' && r.status === 'confirmed') {
                                        return (
                                            <button 
                                                key={i} 
                                                onClick={()=>actionCheckIn(r._id, b._id, r.room_id?.room_number, b.expected_checkin)}
                                                className="flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1 rounded hover:bg-emerald-100 transition"
                                            >
                                                <FiLogIn/> Check-in
                                            </button>
                                        );
                                    }
                                    if(r.status === 'checked_in')
                                        return (
                                            <button key={i} onClick={()=>actionCheckOut(r._id,b._id,r.room_id?.room_number, b.expected_checkout)}
                                                className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-3 py-1 rounded hover:bg-orange-100 transition">
                                                <FiLogOut/> Check-out
                                            </button>
                                        );
                                    // Kiểm tra nếu đã checkout nhưng chưa có cleaningTask hoặc chưa gán nhân viên
                                    if(r.status === 'checked_out' && r.room_id?._id) {
                                        const roomId = r.room_id._id;
                                        const taskInfo = cleaningTasksMap[roomId];
                                        
                                        // Kiểm tra nếu có cleaning task với status "completed" - hiển thị button xác nhận
                                        if (taskInfo && taskInfo.status === 'completed') {
                                            return (
                                                <button 
                                                    key={i} 
                                                    onClick={async () => {
                                                        if (!window.confirm(`Xác nhận hoàn thành dọn dẹp phòng ${r.room_id?.room_number}?`)) {
                                                            return;
                                                        }
                                                        try {
                                                            await bookingApi.confirmCleaning(taskInfo._id);
                                                            alert('Xác nhận hoàn thành dọn dẹp thành công!');
                                                            await checkCleaningTasks(bookings);
                                                            fetchData();
                                                        } catch (error) {
                                                            alert('Lỗi: ' + (error.response?.data?.message || error.message));
                                                        }
                                                    }}
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
                                                                room_number: r.room_id?.room_number,
                                                                booking_id: b._id,
                                                                room_log_id: room_log_id,
                                                                task_id: taskInfo?._id || null // Nếu đã có task thì truyền task_id
                                                            });
                                                            setShowAssignHousekeeperModal(true);
                                                        } catch (error) {
                                                            console.error("Error:", error);
                                                            alert("Lỗi khi tải thông tin: " + (error.response?.data?.message || error.message));
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
                        <button type="button" onClick={() => { setBookingMode('advance'); setIsWalkIn(false); }}
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

                        {bookingMode === 'immediate' && (
                            <div className={`cursor-pointer px-3 py-2 rounded-lg border transition-all flex items-center gap-2 select-none ${isWalkIn ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'}`} onClick={() => setIsWalkIn(!isWalkIn)}>
                                 {isWalkIn ? <FiCheckSquare size={18}/> : <FiSquare size={18}/>}
                                 <span className="text-xs font-bold">Khách tại quầy</span>
                            </div>
                        )}
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
                            // Tính số đêm để hiển thị tổng tiền cho từng phòng
                            let nights = 0;
                            let roomTotal = 0;
                            if (formData.expected_checkin && formData.expected_checkout) {
                                const diffMs = new Date(formData.expected_checkout) - new Date(formData.expected_checkin);
                                if (diffMs > 0) {
                                    const diffHours = diffMs / (1000 * 60 * 60);
                                    const days = diffHours / 24;
                                    nights = Math.ceil(days * 100) / 100;
                                    roomTotal = r.price * nights;
                                }
                            }
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