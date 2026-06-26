import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronRight, Mail, Phone, UserRound } from "lucide-react";
import CustomerShell from "../components/customerShell.jsx";
import ServiceAddOnModal from "../components/serviceAddOnModal.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import { paymentApi } from "../../api/paymentApi.js";
import { HOTEL_IMAGE_SETS } from "../components/imageCatalog.js";
import { AmenityPill, EmptyState, HotelImage, SectionHeader, StatusBadge } from "../components/sitePrimitives.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";

const STEP_ITEMS = [
  "Xem lại",
  "Thông tin khách",
  "Dịch vụ thêm",
  "Thanh toán cọc",
  "Xác nhận",
];

function calculateDeposit(total) {
  return Math.round(total * 0.3);
}

const SERVICE_UNIT_LABELS = {
  hour: "giờ",
  day: "ngày",
  item: "cái",
  can: "lon",
  bottle: "chai",
  portion: "phần",
  ticket: "vé",
};

const SERVICE_TYPE_LABELS = {
  product: "Sản phẩm",
  rental: "Cho thuê",
  experience: "Trải nghiệm",
};

function formatServiceUnit(unit) {
  return SERVICE_UNIT_LABELS[unit] || unit || "lần";
}

function formatServicePrice(service) {
  return `${Number(service.price || 0).toLocaleString()} VNĐ / ${formatServiceUnit(service.unit)}`;
}

function calculateAddOnTotal(addOns, selectedServices) {
  return addOns.reduce((sum, service) => {
    const selection = selectedServices[service.id];
    if (!selection) return sum;
    const quantity = Number(selection.quantity) || 0;
    if (quantity < 1) return sum;
    return sum + Number(service.price || 0) * quantity;
  }, 0);
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function filterSlotsByStay(slots, checkin, checkout) {
  const stayStart = parseDateOnly(checkin);
  const stayEnd = parseDateOnly(checkout);
  if (!stayStart || !stayEnd) return slots;

  return slots.filter((slot) => {
    if (!slot.date) return true;
    const slotDate = parseDateOnly(String(slot.date).split("T")[0]);
    if (!slotDate) return true;
    return slotDate >= stayStart && slotDate < stayEnd;
  });
}

function createEmptyServiceSelection(checkin, checkout, checkinTime = "14:00") {
  return {
    quantity: 1,
    asset_id: "",
    slot_id: "",
    use_from: toDateTimeLocalValue(getCheckinDateTime(checkin, checkinTime)),
    finish_at: toDateTimeLocalValue(getCheckoutDateTime(checkout)),
    availableAssets: [],
    availableSlots: [],
    loadingExtra: false,
  };
}

function validateServiceSelection(service, selection) {
  if (!selection) return "Thiếu thông tin dịch vụ.";

  const quantity = Number(selection.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    return `Vui lòng nhập số lượng hợp lệ cho "${service.name}".`;
  }

  if (service.service_type === "rental") {
    if (!selection.asset_id) {
      return `Vui lòng chọn tài sản cho dịch vụ "${service.name}".`;
    }
    if (!selection.use_from || !selection.finish_at) {
      return `Vui lòng nhập thời gian thuê cho "${service.name}".`;
    }
    if (new Date(selection.use_from) >= new Date(selection.finish_at)) {
      return `Thời gian thuê của "${service.name}" không hợp lệ.`;
    }
  }

  if (service.service_type === "experience" && !selection.slot_id) {
    return `Vui lòng chọn khung giờ cho "${service.name}".`;
  }

  return null;
}

function buildPendingServicePayload(addOns, selectedServices) {
  return addOns
    .filter((service) => selectedServices[service.id])
    .map((service) => {
      const selection = selectedServices[service.id];
      const payload = {
        service_id: service.id,
        quantity: Number(selection.quantity),
      };

      if (service.service_type === "rental") {
        return {
          ...payload,
          asset_id: selection.asset_id,
          use_from: new Date(selection.use_from).toISOString(),
          finish_at: new Date(selection.finish_at).toISOString(),
        };
      }

      if (service.service_type === "experience") {
        return {
          ...payload,
          slot_id: selection.slot_id,
        };
      }

      return payload;
    });
}

function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatDateTime(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextDayInputValue(dateString) {
  const date = parseDateOnly(dateString);
  if (!date) return "";
  date.setDate(date.getDate() + 1);
  return toDateInputValue(date);
}

function addDays(dateValue, days) {
  const date = dateValue instanceof Date ? new Date(dateValue) : parseDateOnly(dateValue);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/**
 * Build checkin ISO string using date + explicit time string "HH:mm".
 * Defaults to 14:00 if timeString is missing/invalid.
 */
function getCheckinDateTime(dateString, timeString = "14:00") {
  const date = parseDateOnly(dateString);
  if (!date) return "";
  const parts = (timeString || "14:00").split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  date.setHours(Number.isNaN(hours) ? 14 : hours, Number.isNaN(minutes) ? 0 : minutes, 0, 0);
  return date.toISOString();
}

function getCheckoutDateTime(dateString) {
  const date = parseDateOnly(dateString);
  if (!date) return "";
  date.setHours(12, 0, 0, 0);
  return date.toISOString();
}

function getTodayInputValue() {
  return toDateInputValue(new Date());
}

// Thêm hàm này: Lấy giờ hiện tại + 10 phút (nếu < 14:00 thì ép thành 14:00)
function getDefaultImmediateTime() {
  const now = new Date();
  now.setMinutes(now.getMinutes() + 10);
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const totalMinutes = hours * 60 + minutes;
  
  if (totalMinutes < 14 * 60) return "14:00";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function resolveCheckinTime(dateString, timeString) {
  const todayStr = toDateInputValue(new Date());
  if (!dateString || dateString > todayStr) {
    // đặt trước — luôn 14:00
    return "14:00";
  }
  // đặt liền (hôm nay)
  const parts = (timeString || "14:00").split(":");
  const hours = parseInt(parts[0], 10);
  const minutes = parseInt(parts[1], 10);
  const totalMinutes = (Number.isNaN(hours) ? 0 : hours) * 60 + (Number.isNaN(minutes) ? 0 : minutes);
  return totalMinutes < 14 * 60 ? "14:00" : (timeString || "14:00");
}

/**
 * Returns true if the selected date is today (same-day / đặt liền).
 */
function isBookingToday(dateString) {
  return Boolean(dateString) && dateString === toDateInputValue(new Date());
}

function normalizeRouteId(value) {
  if (!value || value === "undefined" || value === "null") return "";
  return value;
}

export default function BookingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryId = normalizeRouteId(searchParams.get("categoryId") || searchParams.get("roomId"));
  
  const initCheckin = searchParams.get("checkin") || "";
  // Nếu url không có ngày checkin hoặc là ngày hôm nay -> xem như chế độ Đặt liền
  const isInitialTodayOrEmpty = !initCheckin || initCheckin === getTodayInputValue();
  const initCheckinTime = isInitialTodayOrEmpty ? getDefaultImmediateTime() : "14:00";
  
  const [catalogRooms, setCatalogRooms] = useState([]);
  const [availabilityRooms, setAvailabilityRooms] = useState([]);
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isFindingSuggestions, setIsFindingSuggestions] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [suggestionError, setSuggestionError] = useState("");
  const [suggestedDates, setSuggestedDates] = useState([]);
  const [suggestedCategories, setSuggestedCategories] = useState([]);
  const [availabilityRefreshKey, setAvailabilityRefreshKey] = useState(0);
  const [addOns, setAddOns] = useState([]);
  const [addOnsMessage, setAddOnsMessage] = useState("");
  const [guestVerifyEmail, setGuestVerifyEmail] = useState("");
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [serviceModalServiceId, setServiceModalServiceId] = useState(null);
  const [serviceModalDraft, setServiceModalDraft] = useState(null);
  const [serviceModalError, setServiceModalError] = useState("");
  const availabilityRequestRef = useRef(0);
  const suggestionRequestRef = useRef(0);
  const paymentRedirectAttemptRef = useRef(false);
  const paymentRedirectKeyRef = useRef("");
  const [form, setForm] = useState({
    room_id: categoryId || "",
    checkin: initCheckin || "",
    checkout: searchParams.get("checkout") || "",
    checkin_time: initCheckinTime,
    adults: Number(searchParams.get("adults") || 2),
    children: Number(searchParams.get("children") || 0),
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    special_request: "",
    selected_services: {},
  });

  const selectedCatalogRoom = useMemo(
    () => catalogRooms.find((room) => room._id === form.room_id) || null,
    [catalogRooms, form.room_id],
  );
  const selectedAvailabilityRoom = useMemo(
    () => availabilityRooms.find((room) => room._id === form.room_id) || null,
    [availabilityRooms, form.room_id],
  );
  const selectedRoom = selectedCatalogRoom || selectedAvailabilityRoom;
  const nights = customerPortalApi.calculateNights(form.checkin, form.checkout);
  const roomTotal = Number(selectedRoom?.price || 0) * nights;
  const selectedAddOns = useMemo(
    () => addOns.filter((item) => Boolean(form.selected_services[item.id])),
    [addOns, form.selected_services],
  );
  const serviceModalService = useMemo(
    () => addOns.find((item) => item.id === serviceModalServiceId) || null,
    [addOns, serviceModalServiceId],
  );
  const serviceModalImageIndex = useMemo(
    () => (serviceModalService ? addOns.findIndex((item) => item.id === serviceModalService.id) : -1),
    [addOns, serviceModalService],
  );
  const selectedBookingRoomId =
    selectedAvailabilityRoom?.available_rooms?.[0]?.room_id ||
    selectedAvailabilityRoom?.available_rooms?.[0]?._id ||
    null;
  const selectedRealRoomId = selectedBookingRoomId;
  const todayInputValue = getTodayInputValue();
  const isCheckinInPast = Boolean(form.checkin && form.checkin < todayInputValue);
  const hasValidStayDates = Boolean(form.checkin && form.checkout && new Date(form.checkout) > new Date(form.checkin));
  const canContinueStep0 =
    Boolean(form.room_id) &&
    hasValidStayDates &&
    !isCheckinInPast &&
    !isCheckingAvailability &&
    !isFindingSuggestions &&
    !availabilityError &&
    Boolean(selectedRealRoomId);
  const canContinueStep1 =
    Boolean(form.customer_name.trim()) &&
    Boolean(form.customer_email.trim()) &&
    Boolean(form.customer_phone.trim());
  const addOnTotal = calculateAddOnTotal(addOns, form.selected_services);
  const estimatedTotal = roomTotal + addOnTotal;
  const depositAmount = calculateDeposit(estimatedTotal);
  const remainingAmount = Math.max(estimatedTotal - depositAmount, 0);

  // Derived display values
  const checkinIsToday = isBookingToday(form.checkin);
  const effectiveCheckinTime = form.checkin_time || "14:00";
  const checkinTimeLabel = (() => {
    if (!form.checkin) return null;
    if (!checkinIsToday) return `Đặt trước — nhận phòng lúc 14:00 ngày ${formatDate(form.checkin)}`;
    if (effectiveCheckinTime >= "14:00") return `Đặt liền — nhận phòng lúc ${effectiveCheckinTime} hôm nay`;
    return "Giờ trước 14:00 sẽ được tự động điều chỉnh thành 14:00";
  })();

  useEffect(() => {
    const load = async () => {
      const [{ rooms: roomList }, { services, reason }] = await Promise.all([
        customerPortalApi.getRooms(),
        customerPortalApi.getBookingAddOns(),
      ]);
      setCatalogRooms(roomList);
      setAddOns(services || []);
      setAddOnsMessage(reason || "");
    };
    load().catch(() => setError("Không thể tải thông tin đặt phòng. Vui lòng thử lại."));
  }, []);

  useEffect(() => {
    const loadAvailability = async () => {
      const requestId = availabilityRequestRef.current + 1;
      availabilityRequestRef.current = requestId;
      const hasSearchCriteria = form.checkin && form.checkout;
      if (!hasSearchCriteria) {
        setIsCheckingAvailability(false);
        setAvailabilityError("");
        setAvailabilityRooms([]);
        setSuggestedDates([]);
        setSuggestedCategories([]);
        setSuggestionError("");
        return;
      }

      if (form.checkin < todayInputValue) {
        setIsCheckingAvailability(false);
        setAvailabilityError("Ngày nhận phòng không được ở trong quá khứ.");
        setAvailabilityRooms([]);
        setSuggestedDates([]);
        setSuggestedCategories([]);
        setSuggestionError("");
        return;
      }

      if (new Date(form.checkout) <= new Date(form.checkin)) {
        setIsCheckingAvailability(false);
        setAvailabilityError("");
        setAvailabilityRooms([]);
        setSuggestedDates([]);
        setSuggestedCategories([]);
        setSuggestionError("");
        return;
      }

      try {
        setAvailabilityError("");
        setIsCheckingAvailability(true);
        setAvailabilityRooms([]);
        setSuggestedDates([]);
        setSuggestedCategories([]);
        setSuggestionError("");
        const { rooms: roomList } = await customerPortalApi.searchRooms({
          checkin: getCheckinDateTime(form.checkin, form.checkin_time),
          checkout: getCheckoutDateTime(form.checkout),
          adults: form.adults,
          children: form.children,
        });
        if (availabilityRequestRef.current !== requestId) return;
        setAvailabilityRooms(roomList);
      } catch {
        if (availabilityRequestRef.current !== requestId) return;
        setAvailabilityError("Không thể kiểm tra phòng trống lúc này.");
        setAvailabilityRooms([]);
        setSuggestedDates([]);
        setSuggestedCategories([]);
        setSuggestionError("");
      } finally {
        if (availabilityRequestRef.current === requestId) {
          setIsCheckingAvailability(false);
        }
      }
    };

    loadAvailability();
  }, [availabilityRefreshKey, form.adults, form.checkin, form.checkin_time, form.checkout, form.children, todayInputValue]);

  useEffect(() => {
    const hasValidSearch = form.room_id && hasValidStayDates;
    if (!hasValidSearch || isCheckingAvailability || availabilityError) {
      setIsFindingSuggestions(false);
      setSuggestedDates([]);
      setSuggestedCategories([]);
      if (!availabilityError) {
        setSuggestionError("");
      }
      return;
    }

    if (selectedBookingRoomId) {
      setIsFindingSuggestions(false);
      setSuggestedDates([]);
      setSuggestedCategories([]);
      setSuggestionError("");
      return;
    }

    const requestId = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = requestId;
    let cancelled = false;

    const run = async () => {
      setIsFindingSuggestions(true);
      setSuggestionError("");

      const alternativeCategories = availabilityRooms
        .filter((room) => room._id && room._id !== form.room_id)
        .slice(0, 3);

      if (!cancelled && suggestionRequestRef.current === requestId) {
        setSuggestedCategories(alternativeCategories);
      }

      const nextDates = [];
      const nightsCount = customerPortalApi.calculateNights(form.checkin, form.checkout);

      for (let offset = 1; offset <= 7 && nextDates.length < 3; offset += 1) {
        const nextCheckinDate = addDays(form.checkin, offset);
        if (!nextCheckinDate) continue;
        const nextCheckoutDate = addDays(nextCheckinDate, nightsCount);
        if (!nextCheckoutDate) continue;

        try {
          // Suggested dates are always future dates → always use 14:00
          const { rooms } = await customerPortalApi.searchRooms({
            checkin: getCheckinDateTime(toDateInputValue(nextCheckinDate), "14:00"),
            checkout: getCheckoutDateTime(toDateInputValue(nextCheckoutDate)),
            adults: form.adults,
            children: form.children,
            roomType: form.room_id,
          });

          if (cancelled || suggestionRequestRef.current !== requestId) {
            return;
          }

          if (rooms.length > 0) {
            nextDates.push({
              checkin: toDateInputValue(nextCheckinDate),
              checkout: toDateInputValue(nextCheckoutDate),
              label: `${formatDateTime(nextCheckinDate)} - ${formatDateTime(nextCheckoutDate)}`,
            });
          }
        } catch (error) {
          if (cancelled || suggestionRequestRef.current !== requestId) {
            return;
          }
          setSuggestionError("Không thể tìm gợi ý lúc này.");
          break;
        }
      }

      if (cancelled || suggestionRequestRef.current !== requestId) {
        return;
      }

      setSuggestedDates(nextDates);
      if (!nextDates.length && !alternativeCategories.length) {
        setSuggestionError("Chưa tìm thấy ngày phù hợp gần đây.");
      } else {
        setSuggestionError("");
      }
      setIsFindingSuggestions(false);
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [
    availabilityError,
    availabilityRooms,
    form.adults,
    form.checkin,
    form.checkout,
    form.children,
    form.room_id,
    hasValidStayDates,
    isCheckingAvailability,
    selectedBookingRoomId,
  ]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      customer_name: prev.customer_name || user.name || "",
      customer_email: prev.customer_email || user.email || "",
      customer_phone: prev.customer_phone || user.phone_number || "",
    }));
  }, [user]);

  useEffect(() => {
    if (!form.checkin || !form.checkout) return;
    setForm((prev) => {
      const nextSelections = { ...prev.selected_services };
      let changed = false;

      Object.entries(nextSelections).forEach(([serviceId, selection]) => {
        const service = addOns.find((item) => item.id === serviceId);
        if (!service || service.service_type !== "rental") return;
        const nextUseFrom = toDateTimeLocalValue(getCheckinDateTime(form.checkin, form.checkin_time));
        const nextFinishAt = toDateTimeLocalValue(getCheckoutDateTime(form.checkout));
        if (selection.use_from === nextUseFrom && selection.finish_at === nextFinishAt) return;
        nextSelections[serviceId] = {
          ...selection,
          use_from: nextUseFrom,
          finish_at: nextFinishAt,
        };
        changed = true;
      });

      return changed ? { ...prev, selected_services: nextSelections } : prev;
    });
  }, [addOns, form.checkin, form.checkin_time, form.checkout]);

  useEffect(() => {
    if (!form.checkin || !form.checkout) return;

    const experienceServices = addOns.filter(
      (service) => service.service_type === "experience" && form.selected_services[service.id],
    );
    if (!experienceServices.length) return;

    let cancelled = false;

    const refreshExperienceSlots = async () => {
      const updates = await Promise.all(
        experienceServices.map(async (service) => {
          const slots = await customerPortalApi.getServiceSlots(service.id);
          return {
            serviceId: service.id,
            availableSlots: filterSlotsByStay(slots, form.checkin, form.checkout),
          };
        }),
      );

      if (cancelled) return;

      setForm((prev) => {
        const nextSelections = { ...prev.selected_services };
        let changed = false;

        updates.forEach(({ serviceId, availableSlots }) => {
          const current = nextSelections[serviceId];
          if (!current) return;
          const slotStillValid = availableSlots.some((slot) => slot._id === current.slot_id);
          nextSelections[serviceId] = {
            ...current,
            availableSlots,
            slot_id: slotStillValid ? current.slot_id : "",
          };
          changed = true;
        });

        return changed ? { ...prev, selected_services: nextSelections } : prev;
      });
    };

    void refreshExperienceSlots();

    return () => {
      cancelled = true;
    };
  }, [addOns, form.checkin, form.checkout]);

  useEffect(() => {
    if (!user) return;
    setGuestVerifyEmail(user.email || "");
  }, [user]);

  const handleChange = (key, value) => {
    setForm((prev) => {
      const nextForm = { ...prev, [key]: value };

      if (key === "checkin") {
        // checkout always = checkin + 1 ngày
        nextForm.checkout = getNextDayInputValue(value);

        if (value === getTodayInputValue()) {
          nextForm.checkin_time = getDefaultImmediateTime();
        } else {
          // Còn nếu chọn ngày mai trở đi -> về lại quy tắc đặt trước (14:00)
          nextForm.checkin_time = resolveCheckinTime(value, prev.checkin_time);
        }
      }

      if (key === "checkin_time") {
        // re-apply constraint whenever user touches the time field
        nextForm.checkin_time = resolveCheckinTime(prev.checkin, value);
      }

      return nextForm;
    });
  };

  const closeServiceModal = () => {
    setServiceModalServiceId(null);
    setServiceModalDraft(null);
    setServiceModalError("");
  };

  const loadServiceModalExtras = async (service, draft) => {
    if (service.service_type === "rental") {
      const assets = await customerPortalApi.getServiceAssets(service.id);
      return { ...draft, availableAssets: assets, loadingExtra: false };
    }
    if (service.service_type === "experience") {
      const slots = await customerPortalApi.getServiceSlots(service.id);
      return {
        ...draft,
        availableSlots: filterSlotsByStay(slots, form.checkin, form.checkout),
        loadingExtra: false,
      };
    }
    return { ...draft, loadingExtra: false };
  };

  const openServiceModal = async (service) => {
    const existing = form.selected_services[service.id];
    const needsExtra = service.service_type === "rental" || service.service_type === "experience";
    const hasCachedExtra =
      (service.service_type === "rental" && existing?.availableAssets?.length) ||
      (service.service_type === "experience" && existing?.availableSlots?.length);
    const initialDraft = existing
      ? { ...existing, loadingExtra: needsExtra && !hasCachedExtra }
      : {
          ...createEmptyServiceSelection(form.checkin, form.checkout, form.checkin_time),
          loadingExtra: needsExtra,
        };

    setServiceModalServiceId(service.id);
    setServiceModalDraft(initialDraft);
    setServiceModalError("");

    if (!needsExtra) return;
    if (hasCachedExtra) {
      setServiceModalDraft({ ...initialDraft, loadingExtra: false });
      return;
    }

    try {
      const nextDraft = await loadServiceModalExtras(service, initialDraft);
      setServiceModalDraft(nextDraft);
    } catch {
      setServiceModalDraft({ ...initialDraft, loadingExtra: false });
      setServiceModalError("Không thể tải thông tin dịch vụ. Vui lòng thử lại.");
    }
  };

  const updateServiceModalDraft = (patch) => {
    setServiceModalDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setServiceModalError("");
  };

  const confirmServiceModal = () => {
    const service = addOns.find((item) => item.id === serviceModalServiceId);
    if (!service || !serviceModalDraft) return;

    const validationError = validateServiceSelection(service, serviceModalDraft);
    if (validationError) {
      setServiceModalError(validationError);
      return;
    }

    setForm((prev) => ({
      ...prev,
      selected_services: {
        ...prev.selected_services,
        [service.id]: { ...serviceModalDraft, loadingExtra: false },
      },
    }));
    closeServiceModal();
  };

  const removeServiceSelection = (serviceId) => {
    setForm((prev) => {
      const nextSelections = { ...prev.selected_services };
      delete nextSelections[serviceId];
      return { ...prev, selected_services: nextSelections };
    });
    if (serviceModalServiceId === serviceId) {
      closeServiceModal();
    }
  };

  const validateCurrentStep = () => {
    if (step === 0) {
      if (!form.room_id || !form.checkin || !form.checkout) {
        setError("Vui lòng chọn phòng và ngày lưu trú.");
        return false;
      }
      if (form.checkin < todayInputValue) {
        setError("Ngày nhận phòng không được ở trong quá khứ.");
        return false;
      }
      if (new Date(form.checkout) <= new Date(form.checkin)) {
        setError("Ngày trả phòng phải sau ngày nhận phòng.");
        return false;
      }
    }

    if (step === 1) {
      if (!form.customer_name || !form.customer_email || !form.customer_phone) {
        setError("Vui lòng nhập đầy đủ thông tin khách lưu trú.");
        return false;
      }
    }

    if (step === 2) {
      for (const service of selectedAddOns) {
        const validationError = validateServiceSelection(service, form.selected_services[service.id]);
        if (validationError) {
          setError(validationError);
          return false;
        }
      }
    }

    return true;
  };

  const goNext = async () => {
    setError("");
    setPaymentError("");
    if (!validateCurrentStep()) return;

    if (step === 3) {
      setSubmitting(true);
      try {
        if (!user) {
          if (!guestVerifyEmail.trim()) {
            setError("Vui lòng nhập email để tiếp tục xác thực trước khi đặt phòng.");
            return;
          }
          setError("Vui lòng đăng nhập hoặc tạo tài khoản để xác thực email trước khi xác nhận đặt phòng.");
          return;
        }

        if (!selectedRealRoomId) {
          setError("Hạng phòng này không còn phòng trống trong thời gian đã chọn. Vui lòng đổi ngày hoặc chọn hạng phòng khác.");
          return;
        }

        const pendingServices = buildPendingServicePayload(addOns, form.selected_services);
        const response = await customerPortalApi.createBooking({
          expected_checkin: getCheckinDateTime(form.checkin, form.checkin_time),
          expected_checkout: getCheckoutDateTime(form.checkout),
          adults: Number(form.adults),
          children: Number(form.children),
          rooms: [{ room_id: selectedRealRoomId }],
          ...(pendingServices.length ? { services: pendingServices } : {}),
        });
        paymentRedirectAttemptRef.current = false;
        setResult({
          bookingId: response.bookingId,
          deposit: response.deposit,
          booking: response.booking || null,
          paymentStatus: "pending",
        });
        setStep(4);
      } catch (e) {
        setError(e.message || "Đặt phòng thất bại. Vui lòng thử lại.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

    setStep((prev) => Math.min(prev + 1, STEP_ITEMS.length - 1));
  };

  const goBack = () => {
    setError("");
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const retryAvailability = () => {
    setAvailabilityRefreshKey((value) => value + 1);
  };

  const startDepositPayment = async () => {
    if (!result?.bookingId) return;

    setPaymentError("");
    setPaymentLoading(true);
    try {
      const paymentUserId = user?._id || user?.userId || user?.id;
      if (!paymentUserId) {
        throw new Error("Không tìm thấy tài khoản để tạo thanh toán.");
      }

      const amount = Math.round(Number(result.deposit || 0));
      if (!amount || Number.isNaN(amount)) {
        throw new Error("Số tiền cọc không hợp lệ.");
      }

      const paymentRes = await paymentApi.createPaymentLink(paymentUserId, {
        booking_id: result.bookingId,
        amount,
        description: `Tiền cọc đặt phòng #${String(result.bookingId).slice(-6)}`,
        items: [
          {
            name: "Tiền cọc đặt phòng",
            quantity: 1,
            price: amount,
          },
        ],
      });

      const checkoutUrl = paymentRes?.data?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
      }

      sessionStorage.removeItem(paymentRedirectKeyRef.current);
      window.location.assign(checkoutUrl);
    } catch (e) {
      setPaymentError(e.message || "Không thể tạo thanh toán tiền cọc. Vui lòng thử lại.");
      paymentRedirectAttemptRef.current = false;
      if (paymentRedirectKeyRef.current) {
        sessionStorage.removeItem(paymentRedirectKeyRef.current);
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  useEffect(() => {
    if (step !== 4 || !result?.bookingId || paymentLoading || paymentError || paymentRedirectAttemptRef.current) {
      return;
    }

    const redirectKey = `booking-payment-redirect:${result.bookingId}`;
    paymentRedirectKeyRef.current = redirectKey;
    if (sessionStorage.getItem(redirectKey) === "started") {
      return;
    }
    sessionStorage.setItem(redirectKey, "started");

    paymentRedirectAttemptRef.current = true;
    void startDepositPayment();
  }, [paymentError, paymentLoading, result?.bookingId, step]);

  const updateBookingQuery = (patch) => {
    const params = new URLSearchParams();
    const nextValues = {
      categoryId: patch.room_id ?? form.room_id,
      checkin: patch.checkin ?? form.checkin,
      checkout: patch.checkout ?? form.checkout,
      adults: patch.adults ?? form.adults,
      children: patch.children ?? form.children,
    };

    Object.entries(nextValues).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) {
        params.set(key, String(value));
      }
    });

    setSearchParams(params, { replace: true });
  };

  const applySuggestedDates = (suggestion) => {
    setError("");
    setAvailabilityError("");
    setSuggestionError("");
    setForm((prev) => ({
      ...prev,
      checkin: suggestion.checkin,
      checkout: suggestion.checkout,
      // Suggested dates are always future → always 14:00
      checkin_time: "14:00",
    }));
    updateBookingQuery({
      checkin: suggestion.checkin,
      checkout: suggestion.checkout,
    });
  };

  const applySuggestedCategory = (room) => {
    const nextRoomId = room?._id || room?.categoryId || room?.category_id || "";
    if (!nextRoomId) return;

    setError("");
    setAvailabilityError("");
    setSuggestionError("");
    setForm((prev) => ({
      ...prev,
      room_id: nextRoomId,
    }));
    updateBookingQuery({
      room_id: nextRoomId,
    });
  };

  if (!catalogRooms.length && !selectedRoom && !result) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <EmptyState
            title="Đang chuẩn bị đặt phòng"
            description="Đang tải thông tin phòng và dịch vụ."
          />
        </section>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEP_ITEMS.map((item, index) => (
            <div
              key={item}
              className={`min-w-0 rounded-2xl border px-4 py-3 text-sm font-medium leading-5 ${
                index === step
                  ? "border-stone-950 bg-stone-950 text-white"
                  : index < step
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-stone-200 bg-white text-stone-500"
              }`}
            >
              <span className="block truncate">{index + 1}. {item}</span>
            </div>
          ))}
        </div>

        {step === 4 && result?.bookingId ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-stone-950 text-white shadow-sm">
              <HotelImage src={HOTEL_IMAGE_SETS.hero[0]} alt="Không gian đón khách sang trọng của SE Hotel" ratio="wide" fallbackLabel="SE Hotel" className="rounded-none" overlay={false} />
              <div className="p-7">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 size={32} />
                </div>
                <h1 className="mt-6 break-words text-3xl font-semibold md:text-4xl">Thanh toán cọc</h1>
                <p className="mt-4 text-sm leading-7 text-stone-300">
                  Đặt phòng đã được tạo và đang chờ thanh toán cọc. Hoàn tất thanh toán để xác nhận giữ phòng.
                </p>
              </div>
            </div>

            <div className="min-w-0 rounded-[32px] border border-stone-200 bg-white p-7 shadow-sm">
              <SectionHeader eyebrow="Bước 4" title="Xác nhận và thanh toán" description={null} />
              <div className="mt-6 flex flex-wrap gap-2">
                <StatusBadge tone="warning">Đang chờ thanh toán</StatusBadge>
                <StatusBadge tone="info">PayOS</StatusBadge>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Mã đặt phòng</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{result.bookingId}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Tổng tiền</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{estimatedTotal.toLocaleString()} VNĐ</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Số tiền cọc</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{Number(result.deposit || 0).toLocaleString()} VNĐ</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-5">
                  <p className="text-sm text-amber-800">Số tiền còn lại</p>
                  <p className="mt-2 text-lg font-semibold text-amber-900">{remainingAmount.toLocaleString()} VNĐ</p>
                </div>
              </div>
              <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
                <p className="font-medium text-stone-800">Lịch lưu trú</p>
                <p className="mt-1">{formatDateTime(getCheckinDateTime(form.checkin, form.checkin_time))} - {formatDateTime(getCheckoutDateTime(form.checkout))}</p>
                <p className="mt-1">{selectedRoom?.category_name || "Chưa xác định"}</p>
              </div>
              <p className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
                Sau khi thanh toán, hệ thống sẽ tự xác nhận giữ phòng.
              </p>
              {paymentError ? (
                <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{paymentError}</p>
              ) : null}
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={startDepositPayment}
                  disabled={paymentLoading}
                  className="inline-flex max-w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-center text-sm font-semibold leading-5 text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paymentLoading ? "Đang chuyển đến PayOS..." : "Mở lại PayOS"}
                  <ChevronRight size={16} />
                </button>
                <Link to="/hotel/bookings" className="inline-flex max-w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-center text-sm font-semibold leading-5 text-stone-800 transition hover:border-stone-300 hover:bg-stone-50">
                  Đặt phòng của tôi
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <aside className="min-w-0 space-y-6">
              <div className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Thông tin đã chọn"
                  title="Chi phí tạm tính"
                  description={null}
                />
                <div className="mt-6">
                  <HotelImage
                    src={selectedRoom?.images?.[0] || HOTEL_IMAGE_SETS.rooms[0]}
                    alt={selectedRoom ? `Hình ảnh phòng ${selectedRoom.category_name}` : "Hình minh họa hạng phòng"}
                    ratio="wide"
                    fallbackLabel={selectedRoom ? `Hạng phòng ${selectedRoom.category_name}` : "Chọn loại phòng"}
                    overlay={false}
                  />
                </div>
                <div className="mt-4 space-y-3">
                  {isCheckingAvailability && hasValidStayDates ? (
                    <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
                      Đang kiểm tra phòng trống...
                    </div>
                  ) : null}
                  {availabilityError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
                      <p>{availabilityError}</p>
                      <button
                        type="button"
                        onClick={retryAvailability}
                        className="mt-3 inline-flex items-center justify-center rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                      >
                        Thử lại
                      </button>
                    </div>
                  ) : form.room_id && hasValidStayDates && !isCheckingAvailability && !selectedRealRoomId ? (
                    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 px-4 py-4 text-amber-900">
                      <p className="text-sm font-semibold">Hạng phòng này đã hết trong ngày bạn chọn</p>
                      <p className="mt-1 text-sm leading-6 text-amber-800">
                        Bạn có thể đổi sang ngày gần nhất còn phòng hoặc chọn hạng phòng khác.
                      </p>

                      {isFindingSuggestions ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 px-3 py-3 text-sm text-amber-800">
                          Đang tìm ngày còn phòng gần nhất...
                        </div>
                      ) : null}

                      {suggestionError ? (
                        <div className="mt-3 rounded-xl border border-amber-200 bg-white/70 px-3 py-3 text-sm leading-6 text-amber-900">
                          {suggestionError}
                        </div>
                      ) : null}

                      {suggestedDates.length ? (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Ngày gần nhất còn phòng</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {suggestedDates.map((item) => (
                              <button
                                key={`${item.checkin}-${item.checkout}`}
                                type="button"
                                onClick={() => applySuggestedDates(item)}
                                className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {suggestedCategories.length ? (
                        <div className="mt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Hạng phòng khác còn trống</p>
                          <div className="mt-2 grid gap-3 md:grid-cols-2">
                            {suggestedCategories.map((room) => (
                              <div key={room._id} className="rounded-2xl border border-amber-200 bg-white/85 p-4 text-stone-900">
                                <p className="break-words text-sm font-semibold text-stone-950">{room.category_name}</p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {room.price ? (
                                    <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                                      {Number(room.price).toLocaleString()} VNĐ/đêm
                                    </span>
                                  ) : null}
                                  {(room.max_adults || room.max_children) ? (
                                    <span className="inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                                      {room.max_adults ? `${room.max_adults} người lớn` : ""}{room.max_adults && room.max_children ? " · " : ""}{room.max_children ? `${room.max_children} trẻ em` : ""}
                                    </span>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => applySuggestedCategory(room)}
                                  className="mt-3 inline-flex items-center justify-center rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                                >
                                  Chọn hạng này
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      {!isFindingSuggestions && !suggestedDates.length && !suggestedCategories.length ? (
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => document.getElementById("booking-checkin")?.focus()}
                            className="inline-flex items-center justify-center rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                          >
                            Đổi ngày
                          </button>
                          <Link
                            to="/hotel/rooms"
                            className="inline-flex items-center justify-center rounded-xl bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                          >
                            Xem tất cả hạng phòng
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-stone-500">Loại phòng</p>
                    <p className="mt-2 break-words text-2xl font-semibold leading-tight text-stone-950">{selectedRoom?.category_name || "Chưa chọn"}</p>
                  </div>
                  <div className="flex min-w-0 flex-wrap gap-2">
                    <AmenityPill>{form.adults} người lớn</AmenityPill>
                    <AmenityPill>{form.children} trẻ em</AmenityPill>
                    <AmenityPill>{nights} đêm</AmenityPill>
                  </div>
                  <div className="grid gap-3">
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
                      <span className="min-w-0">Tiền phòng</span>
                      <span className="shrink-0 text-right font-semibold text-stone-900">{roomTotal.toLocaleString()} VNĐ</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-stone-50 p-4 text-sm text-stone-600">
                      <span className="min-w-0">Dịch vụ thêm</span>
                      <span className="shrink-0 text-right font-semibold text-stone-900">{addOnTotal.toLocaleString()} VNĐ</span>
                    </div>
                    {selectedAddOns.length ? (
                      <div className="rounded-2xl border border-stone-100 bg-white p-4 text-xs leading-6 text-stone-600">
                        {selectedAddOns.map((service) => {
                          const selection = form.selected_services[service.id];
                          const quantity = Number(selection?.quantity) || 0;
                          const subtotal = Number(service.price || 0) * quantity;
                          return (
                            <div key={service.id} className="flex items-center justify-between gap-3">
                              <span className="min-w-0 truncate">{service.name}</span>
                              <span className="shrink-0 font-medium text-stone-800">
                                {quantity} {formatServiceUnit(service.unit)} · {subtotal.toLocaleString()} VNĐ
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
                      <span className="min-w-0">Tổng tiền tạm tính</span>
                      <span className="shrink-0 text-right text-lg font-semibold">{estimatedTotal.toLocaleString()} VNĐ</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-stone-950 p-4 text-sm text-white">
                      <span className="min-w-0">Số tiền cần cọc</span>
                      <span className="shrink-0 text-right text-lg font-semibold">{depositAmount.toLocaleString()} VNĐ</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 text-sm text-stone-700 ring-1 ring-stone-200">
                      <span className="min-w-0">Số tiền còn lại</span>
                      <span className="shrink-0 text-right text-lg font-semibold text-stone-950">{remainingAmount.toLocaleString()} VNĐ</span>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="min-w-0 rounded-[32px] border border-stone-200 bg-white p-5 shadow-[0_18px_48px_rgba(28,25,23,0.08)] md:p-7">
              {!categoryId ? (
                <div className="mb-6 rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                  Vui lòng chọn hạng phòng trước khi đặt.
                </div>
              ) : null}
              {step === 0 ? (
                <>
                  <SectionHeader eyebrow="Bước 1" title="Thông tin đặt phòng" description={null} />
                  <div className="mt-7 grid gap-5 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Loại phòng
                      <select value={form.room_id} onChange={(e) => handleChange("room_id", e.target.value)} className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required>
                        <option value="">Chọn loại phòng</option>
                        {catalogRooms.map((room) => (
                          <option key={room._id} value={room._id}>
                            {room.category_name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Ngày nhận phòng
                      <input
                        id="booking-checkin"
                        type="date"
                        min={todayInputValue}
                        value={form.checkin}
                        onChange={(e) => handleChange("checkin", e.target.value)}
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                        required
                      />
                    </label>

                    {/* Giờ nhận phòng — chỉ cho phép chọn khi đặt liền (hôm nay) */}
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Giờ nhận phòng
                      <input
                        id="booking-checkin-time"
                        type="time"
                        value={form.checkin_time}
                        onChange={(e) => handleChange("checkin_time", e.target.value)}
                        disabled={!checkinIsToday}
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100 disabled:cursor-not-allowed disabled:bg-stone-50 disabled:text-stone-400"
                      />
                      {checkinTimeLabel ? (
                        <span
                          className={`text-xs ${
                            checkinIsToday && effectiveCheckinTime >= "14:00"
                              ? "text-emerald-600"
                              : "text-stone-500"
                          }`}
                        >
                          {checkinTimeLabel}
                        </span>
                      ) : (
                        <span className="text-xs text-stone-400">Chọn ngày nhận phòng trước</span>
                      )}
                    </label>

                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Ngày trả phòng
                      <input
                        id="booking-checkout"
                        type="date"
                        value={form.checkout}
                        onChange={(e) => handleChange("checkout", e.target.value)}
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                        required
                      />
                      <span className="text-xs text-stone-500">Giờ trả phòng cố định lúc 12:00</span>
                    </label>

                    <p className="text-sm text-stone-500 md:col-span-2">
                      Đặt liền (hôm nay): giờ nhận phòng theo lựa chọn của bạn, tối thiểu 14:00.
                      Đặt trước: giờ nhận phòng cố định lúc 14:00.
                    </p>

                    <div className="grid min-w-0 grid-cols-2 gap-4">
                      <label className="grid gap-2 text-sm font-medium text-stone-700">
                        Người lớn
                        <input type="number" min="1" value={form.adults} onChange={(e) => handleChange("adults", e.target.value)} className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-stone-700">
                        Trẻ em
                        <input type="number" min="0" value={form.children} onChange={(e) => handleChange("children", e.target.value)} className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />
                      </label>
                    </div>
                  </div>
                </>
              ) : null}

              {step === 1 ? (
                <>
                  <SectionHeader eyebrow="Bước 2" title="Kiểm tra thông tin cá nhân" description={null} />
                  <div className="mt-7 grid gap-5 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Họ và tên
                      <div className="relative">
                        <UserRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input value={form.customer_name} onChange={(e) => handleChange("customer_name", e.target.value)} placeholder="Nguyễn Văn A" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                      </div>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Email
                      <div className="relative">
                        <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input type="email" value={form.customer_email} onChange={(e) => handleChange("customer_email", e.target.value)} placeholder="ban@email.com" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                      </div>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Số điện thoại
                      <div className="relative">
                        <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                        <input value={form.customer_phone} onChange={(e) => handleChange("customer_phone", e.target.value)} placeholder="09xxxxxxxx" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                      </div>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700 md:col-span-2">
                      Yêu cầu thêm
                      <textarea value={form.special_request} onChange={(e) => handleChange("special_request", e.target.value)} placeholder="Ví dụ: tầng cao, phòng yên tĩnh..." className="min-h-32 rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />
                    </label>
                  </div>
                </>
              ) : null}

              {step === 2 ? (
                <>
                  <SectionHeader
                    eyebrow="Bước 3"
                    title="Dịch vụ thêm"
                    description="Chọn dịch vụ bổ sung theo số lượng và đơn vị tính thực tế. Dịch vụ trải nghiệm tính theo vé, dịch vụ thuê tính theo tài sản và thời gian."
                  />
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {addOns.map((addOn, index) => {
                      const selected = Boolean(form.selected_services[addOn.id]);
                      const selection = form.selected_services[addOn.id];
                      const lineTotal = selected
                        ? Number(addOn.price || 0) * (Number(selection?.quantity) || 0)
                        : 0;
                      const serviceImage =
                        addOn.image ||
                        HOTEL_IMAGE_SETS.services[index % HOTEL_IMAGE_SETS.services.length];

                      return (
                        <div
                          key={addOn.id}
                          className={`min-w-0 overflow-hidden rounded-[28px] border text-left transition ${
                            selected ? "border-stone-950 shadow-md" : "border-stone-200"
                          }`}
                        >
                          <HotelImage
                            src={serviceImage}
                            alt={addOn.name}
                            ratio="wide"
                            fallbackLabel={addOn.name}
                            className="rounded-none"
                            overlay={false}
                          />
                          <div className="space-y-4 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="break-words text-lg font-semibold leading-tight text-stone-950">{addOn.name}</h3>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <StatusBadge tone="info">
                                    {SERVICE_TYPE_LABELS[addOn.service_type] || addOn.service_type}
                                  </StatusBadge>
                                  {selected ? <StatusBadge tone="success">Đã chọn</StatusBadge> : null}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => openServiceModal(addOn)}
                                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                                  selected
                                    ? "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
                                    : "bg-stone-950 text-white hover:bg-stone-800"
                                }`}
                              >
                                {selected ? "Sửa" : "Chọn"}
                              </button>
                            </div>

                            <p className="line-clamp-2 break-words text-sm leading-6 text-stone-600">{addOn.description}</p>
                            <p className="break-words text-sm font-semibold text-stone-900">{formatServicePrice(addOn)}</p>

                            {selected ? (
                              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-900">
                                <p>
                                  {Number(selection?.quantity) || 0} {formatServiceUnit(addOn.unit)} · {lineTotal.toLocaleString()} VNĐ
                                </p>
                                <button
                                  type="button"
                                  onClick={() => removeServiceSelection(addOn.id)}
                                  className="mt-2 text-xs font-semibold text-red-700 underline-offset-2 hover:underline"
                                >
                                  Bỏ chọn
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {!addOns.length ? (
                    <div className="mt-5 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                      {addOnsMessage || "Chưa có dịch vụ thêm."}
                    </div>
                  ) : null}
                  {selectedAddOns.length ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                      <p className="font-semibold">Dịch vụ đã chọn</p>
                      <ul className="mt-2 space-y-1">
                        {selectedAddOns.map((service) => {
                          const selection = form.selected_services[service.id];
                          const quantity = Number(selection?.quantity) || 0;
                          return (
                            <li key={service.id}>
                              {service.name}: {quantity} {formatServiceUnit(service.unit)} × {Number(service.price || 0).toLocaleString()} VNĐ
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <SectionHeader eyebrow="Bước 4" title="Thanh toán" description={null} />
                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="min-w-0 rounded-2xl bg-stone-50 p-5">
                      <p className="text-sm text-stone-500">Tổng tiền tạm tính</p>
                      <p className="mt-2 break-words text-2xl font-semibold text-stone-900">{estimatedTotal.toLocaleString()} VNĐ</p>
                    </div>
                    <div className="min-w-0 rounded-2xl bg-amber-50 p-5">
                      <p className="text-sm text-amber-800">Số tiền cần cọc</p>
                      <p className="mt-2 break-words text-2xl font-semibold text-amber-900">{depositAmount.toLocaleString()} VNĐ</p>
                    </div>
                    <div className="min-w-0 rounded-2xl bg-stone-950 p-5 text-white">
                      <p className="text-sm text-stone-300">Số tiền còn lại</p>
                      <p className="mt-2 break-words text-2xl font-semibold">{remainingAmount.toLocaleString()} VNĐ</p>
                    </div>
                  </div>
                  <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 text-sm leading-7 text-stone-600">
                    <p className="font-medium text-stone-800">Lịch nhận — trả phòng</p>
                    <p className="mt-1">
                      Nhận phòng: {formatDateTime(getCheckinDateTime(form.checkin, form.checkin_time))}
                    </p>
                    <p className="mt-1">
                      Trả phòng: {formatDateTime(getCheckoutDateTime(form.checkout))}
                    </p>
                    <p className="mt-3 text-stone-500">Khoản cọc giữ phòng theo lịch đã chọn.</p>
                  </div>
                  {!user ? (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
                      <p className="text-sm font-semibold text-amber-900">Xác thực email</p>
                      <p className="mt-2 text-sm leading-6 text-amber-800">Nhập email để tiếp tục.</p>
                      <label className="mt-4 grid gap-2 text-sm font-medium text-stone-700">
                        Email xác thực
                        <input
                          type="email"
                          value={guestVerifyEmail}
                          onChange={(e) => setGuestVerifyEmail(e.target.value)}
                          placeholder="ban@email.com"
                          className="h-12 w-full rounded-2xl border border-amber-300 bg-white px-4 outline-none transition focus:border-amber-500 focus:ring-4 focus:ring-amber-100"
                          required
                        />
                      </label>
                      <Link
                        to={`/login?email=${encodeURIComponent(guestVerifyEmail || "")}`}
                        className="mt-4 inline-flex items-center justify-center rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                      >
                        Xác thực ngay
                      </Link>
                    </div>
                  ) : null}
                </>
              ) : null}

              {error ? <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

              <div className="mt-8 grid gap-3 sm:flex sm:flex-wrap sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={goBack}
                  disabled={step === 0 || submitting}
                  className="min-w-0 rounded-2xl border border-stone-300 px-5 py-3 text-center text-sm font-semibold leading-5 text-stone-700 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Quay lại
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  disabled={submitting || (step === 0 ? !canContinueStep0 : step === 1 ? !canContinueStep1 : false)}
                  className="inline-flex min-w-0 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-center text-sm font-semibold leading-5 text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {step === 3 ? "Xác nhận đặt phòng" : "Tiếp tục"}
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <ServiceAddOnModal
        open={Boolean(serviceModalService && serviceModalDraft)}
        service={serviceModalService}
        draft={serviceModalDraft}
        error={serviceModalError}
        isEditing={Boolean(serviceModalServiceId && form.selected_services[serviceModalServiceId])}
        serviceImage={
          serviceModalService?.image ||
          HOTEL_IMAGE_SETS.services[
            (serviceModalImageIndex >= 0 ? serviceModalImageIndex : 0) % HOTEL_IMAGE_SETS.services.length
          ]
        }
        unitLabels={SERVICE_UNIT_LABELS}
        onClose={closeServiceModal}
        onConfirm={confirmServiceModal}
        onRemove={() => serviceModalServiceId && removeServiceSelection(serviceModalServiceId)}
        onDraftChange={updateServiceModalDraft}
      />
    </CustomerShell>
  );
}