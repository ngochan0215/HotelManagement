import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronRight, Mail, Phone, UserRound } from "lucide-react";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import { HOTEL_IMAGE_SETS } from "../components/imageCatalog.js";
import { AmenityPill, EmptyState, HotelImage, SectionHeader, StatusBadge } from "../components/sitePrimitives.jsx";

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

function calculateAddOnTotal(selectedAddOns, nights) {
  return selectedAddOns.reduce((sum, item) => sum + Number(item.price || 0), 0) * nights;
}

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId");
  const [rooms, setRooms] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    room_id: roomId || "",
    checkin: searchParams.get("checkin") || "",
    checkout: searchParams.get("checkout") || "",
    adults: Number(searchParams.get("adults") || 2),
    children: Number(searchParams.get("children") || 0),
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    special_request: "",
    selected_add_ons: [],
  });

  useEffect(() => {
    const load = async () => {
      const [{ rooms: roomList }, { services }] = await Promise.all([
        customerPortalApi.getRooms(),
        customerPortalApi.getBookingAddOns(),
      ]);
      setRooms(roomList);
      setAddOns(services || []);
    };
    load();
  }, []);

  const selectedRoom = useMemo(() => rooms.find((room) => room._id === form.room_id), [rooms, form.room_id]);
  const nights = customerPortalApi.calculateNights(form.checkin, form.checkout);
  const roomTotal = Number(selectedRoom?.price || 0) * nights;
  const selectedAddOns = addOns.filter((item) => form.selected_add_ons.includes(item.id));
  const addOnTotal = calculateAddOnTotal(selectedAddOns, nights);
  const estimatedTotal = roomTotal + addOnTotal;
  const depositAmount = calculateDeposit(estimatedTotal);
  const remainingAmount = Math.max(estimatedTotal - depositAmount, 0);

  const handleChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const toggleAddOn = (addOnId) => {
    setForm((prev) => ({
      ...prev,
      selected_add_ons: prev.selected_add_ons.includes(addOnId)
        ? prev.selected_add_ons.filter((item) => item !== addOnId)
        : [...prev.selected_add_ons, addOnId],
    }));
  };

  const validateCurrentStep = () => {
    if (step === 0) {
      if (!form.room_id || !form.checkin || !form.checkout) {
        setError("Vui lòng chọn phòng và ngày lưu trú.");
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

    return true;
  };

  const goNext = async () => {
    setError("");
    if (!validateCurrentStep()) return;

    if (step === 3) {
      setSubmitting(true);
      try {
        await customerPortalApi.createDepositPayment({
          deposit_amount: depositAmount,
          estimated_total: estimatedTotal,
        });

        const response = await customerPortalApi.createBooking({
          expected_checkin: form.checkin,
          expected_checkout: form.checkout,
          adults: Number(form.adults),
          children: Number(form.children),
          room_ids: [form.room_id],
          customer_name: form.customer_name,
          customer_email: form.customer_email,
          customer_phone: form.customer_phone,
          special_request: form.special_request,
          selected_add_ons: selectedAddOns,
          estimated_total: estimatedTotal,
          deposit_amount: depositAmount,
        });
        setResult(response);
        setStep(4);
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

  if (!rooms.length && !selectedRoom && !result) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <EmptyState
            title="Đang chuẩn bị đặt phòng"
            description="SE Hotel đang tải thông tin phòng và dịch vụ để bạn tiếp tục."
          />
        </section>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <StatusBadge tone="warning">Đặt phòng SE Hotel</StatusBadge>
          {selectedRoom ? <StatusBadge tone="info">{selectedRoom.category_name}</StatusBadge> : null}
        </div>

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

        {step === 4 && result ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-stone-950 text-white shadow-sm">
              <HotelImage src={HOTEL_IMAGE_SETS.hero[0]} alt="Không gian đón khách sang trọng của SE Hotel" ratio="wide" fallbackLabel="SE Hotel" className="rounded-none" />
              <div className="p-7">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-300">
                  <CheckCircle2 size={32} />
                </div>
                <h1 className="mt-6 break-words text-3xl font-semibold md:text-4xl">Xác nhận đặt phòng</h1>
                <p className="mt-4 text-sm leading-7 text-stone-300">
                  Mã đặt phòng: <span className="font-semibold text-white">{result.bookingId}</span>
                </p>
                <p className="mt-2 text-sm leading-7 text-stone-300">
                  Số tiền cọc: <span className="font-semibold text-white">{depositAmount.toLocaleString()} VNĐ</span>
                </p>
              </div>
            </div>

            <div className="min-w-0 rounded-[32px] border border-stone-200 bg-white p-7 shadow-sm">
              <SectionHeader eyebrow="Đã hoàn tất" title="Đặt phòng đã được ghi nhận" description="Bạn có thể tra cứu lại bằng mã đặt phòng và email ngay trên trang này." />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Loại phòng</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{selectedRoom?.category_name}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Lịch lưu trú</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{form.checkin} - {form.checkout}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Số khách</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{form.adults} người lớn, {form.children} trẻ em</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Tổng tiền tạm tính</p>
                  <p className="mt-2 text-lg font-semibold text-stone-900">{estimatedTotal.toLocaleString()} VNĐ</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-5">
                  <p className="text-sm text-amber-800">Số tiền còn lại</p>
                  <p className="mt-2 text-lg font-semibold text-amber-900">{remainingAmount.toLocaleString()} VNĐ</p>
                </div>
              </div>
              <Link to="/hotel/bookings" className="mt-8 inline-flex max-w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-center text-sm font-semibold leading-5 text-white transition hover:bg-stone-800">
                Tra cứu đặt phòng
                <ChevronRight size={16} />
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <aside className="min-w-0 space-y-6">
              <div className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
                <SectionHeader
                  eyebrow="Thông tin đã chọn"
                  title="Phòng, ngày ở và chi phí"
                  description="Kiểm tra lại thông tin lưu trú và chi phí trước khi xác nhận."
                />
                <div className="mt-6">
                  <HotelImage
                    src={selectedRoom?.images?.[0] || HOTEL_IMAGE_SETS.rooms[0]}
                    alt={selectedRoom ? `Hình ảnh phòng ${selectedRoom.category_name}` : "Hình minh họa hạng phòng"}
                    ratio="wide"
                    fallbackLabel={selectedRoom ? `Hạng phòng ${selectedRoom.category_name}` : "Chọn loại phòng"}
                  />
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Loại phòng</p>
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
              {step === 0 ? (
                <>
                  <SectionHeader eyebrow="Bước 1" title="Xem lại phòng đã chọn" description="Xác nhận lại phòng, ngày ở và số khách trước khi tiếp tục." />
                  <div className="mt-7 grid gap-5 md:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Loại phòng
                      <select value={form.room_id} onChange={(e) => handleChange("room_id", e.target.value)} className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required>
                        <option value="">Chọn loại phòng</option>
                        {rooms.map((room) => (
                          <option key={room._id} value={room._id}>
                            {room.category_name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Ngày nhận phòng
                      <input type="date" value={form.checkin} onChange={(e) => handleChange("checkin", e.target.value)} className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Ngày trả phòng
                      <input type="date" value={form.checkout} onChange={(e) => handleChange("checkout", e.target.value)} className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                    </label>
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
                  <SectionHeader eyebrow="Bước 2" title="Thông tin khách lưu trú" description="Nhập thông tin liên hệ để xác nhận đơn đặt phòng." />
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
                  <SectionHeader eyebrow="Bước 3" title="Chọn dịch vụ thêm" description="Bạn có thể chọn thêm tiện ích để kỳ nghỉ thoải mái hơn." />
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    {addOns.map((addOn, index) => {
                      const selected = form.selected_add_ons.includes(addOn.id);
                      return (
                        <button
                          key={addOn.id}
                          type="button"
                          onClick={() => toggleAddOn(addOn.id)}
                          className={`min-w-0 overflow-hidden rounded-[28px] border text-left transition ${
                            selected ? "border-stone-950 shadow-md" : "border-stone-200 hover:border-stone-300"
                          }`}
                        >
                          <HotelImage
                            src={HOTEL_IMAGE_SETS.services[index % HOTEL_IMAGE_SETS.services.length]}
                            alt={addOn.name}
                            ratio="wide"
                            fallbackLabel={addOn.name}
                            className="rounded-none"
                          />
                          <div className="space-y-3 p-5">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="min-w-0 break-words text-lg font-semibold leading-tight text-stone-950">{addOn.name}</h3>
                              {selected ? <StatusBadge tone="success">Đã chọn</StatusBadge> : null}
                            </div>
                            <p className="line-clamp-2 break-words text-sm leading-6 text-stone-600">{addOn.description}</p>
                            <p className="break-words text-sm font-semibold text-stone-900">{Number(addOn.price || 0).toLocaleString()} VNĐ / đêm</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}

              {step === 3 ? (
                <>
                  <SectionHeader eyebrow="Bước 4" title="Thanh toán cọc" description="Xác nhận tổng tiền tạm tính và số tiền cần cọc trước khi chốt đơn." />
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
                    Khoản cọc giúp SE Hotel giữ phòng theo lịch lưu trú đã chọn. Nhân viên khách sạn sẽ hỗ trợ xác nhận chi tiết sau khi đặt phòng.
                  </div>
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
                  disabled={submitting}
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
    </CustomerShell>
  );
}
