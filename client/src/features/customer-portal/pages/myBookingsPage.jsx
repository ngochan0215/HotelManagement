import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Copy,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import { paymentApi } from "../../api/paymentApi.js";
import { EmptyState } from "../components/sitePrimitives.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import "./myBookingsPage.css";

const CANCELLATION_REASON_OPTIONS = [
  { value: "change_plan", label: "Thay đổi lịch trình" },
  { value: "price_issue", label: "Giá không phù hợp" },
  { value: "find_better_option", label: "Tìm được lựa chọn tốt hơn" },
  { value: "personal_reason", label: "Lý do cá nhân" },
  { value: "no_show", label: "Không đến" },
  { value: "overbooking", label: "Hết phòng" },
  { value: "force_majeure", label: "Bất khả kháng" },
  { value: "early_checkout", label: "Trả phòng sớm" },
  { value: "other", label: "Khác" },
];

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

function formatMoney(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return "--";
  return new Intl.NumberFormat("vi-VN").format(amount);
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function normalizeStatusLabel(status) {
  return "—";
}

function getNightCount(checkin, checkout) {
  if (!checkin || !checkout) return 0;
  const start = new Date(checkin);
  const end = new Date(checkout);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const nights = Math.round((end - start) / (1000 * 60 * 60 * 24));
  return nights > 0 ? nights : 0;
}

function getBookingCode(booking) {
  return booking?.booking_code || booking?._id || booking?.id || "--";
}

function shortBookingCode(booking) {
  const code = String(getBookingCode(booking));
  if (code.length <= 10) return code;
  return `${code.slice(0, 6)}...${code.slice(-4)}`;
}

function getRoomEntries(booking) {
  return Array.isArray(booking?.rooms) ? booking.rooms : [];
}

function getRoomTitle(room) {
  const roomNumber = room?.room_info?.room_number || room?.room_number || "";
  const categoryName = room?.room_info?.category?.name || room?.category?.name || room?.room_type || room?.category_name || "";

  if (roomNumber && categoryName) return `Phòng ${roomNumber} · ${categoryName}`;
  if (roomNumber) return `Phòng ${roomNumber}`;
  if (categoryName) return categoryName;
  return "Phòng lưu trú";
}

function getBookingRoomEntries(booking, detail) {
  const detailRooms = Array.isArray(detail?.rooms) ? detail.rooms : [];
  if (detailRooms.length) return detailRooms;
  return getRoomEntries(booking);
}

function getCustomerInfo(booking) {
  const info = booking?.customer_info || booking?.customer || booking?.customer_detail || booking?.customerDetails || {};
  return {
    fullName:
      info?.full_name ||
      booking?.customer_full_name ||
      booking?.customer_name ||
      booking?.customer?.full_name ||
      "",
    phone:
      info?.phone_number ||
      info?.phone ||
      booking?.customer_phone_number ||
      booking?.customer_phone ||
      booking?.phone_number ||
      booking?.phone ||
      "",
    email:
      info?.email ||
      booking?.customer_email ||
      booking?.email ||
      "",
    cccd:
      info?.CCCD ||
      info?.cccd ||
      booking?.CCCD ||
      booking?.cccd ||
      booking?.identity_number ||
      "",
  };
}

const CANCELLATION_REASON_LABEL_MAP = CANCELLATION_REASON_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {});

function getCancellationReasonLabel(reason) {
  const normalized = String(reason || "").trim();
  if (!normalized) return "";
  return CANCELLATION_REASON_LABEL_MAP[normalized] || normalized;
}

function getCancellationActorLabel(value) {
  const normalized = normalizeStatus(value);
  if (normalized === "customer") return "Khách hàng";
  if (normalized === "employee") return "Khách sạn / Nhân viên";
  if (normalized === "system") return "Hệ thống";
  return "";
}

function getCancellationInfo(booking, detail) {
  const resolvedBooking = detail?.booking || booking || {};
  const detailRooms = Array.isArray(detail?.rooms) ? detail.rooms : [];
  const bookingRooms = Array.isArray(resolvedBooking?.rooms) ? resolvedBooking.rooms : [];
  const rooms = detailRooms.length ? detailRooms : bookingRooms;

  const reasonCodes = [...new Set(
    rooms
      .map((room) => room?.cancellation_reason)
      .filter(Boolean)
      .map((reason) => String(reason).trim())
      .filter(Boolean),
  )];

  const cancelledAt =
    resolvedBooking?.cancelled_at ||
    detail?.cancelled_at ||
    rooms.find((room) => room?.cancelled_at)?.cancelled_at ||
    "";

  const actorRaw =
    resolvedBooking?.cancelled_by ||
    detail?.cancelled_by ||
    rooms.find((room) => room?.cancelled_by)?.cancelled_by ||
    "";

  const actorName =
    resolvedBooking?.cancelled_by_user?.full_name ||
    resolvedBooking?.cancelled_by_user?.name ||
    detail?.cancelled_by_user?.full_name ||
    detail?.cancelled_by_user?.name ||
    "";

  const note =
    resolvedBooking?.cancelled_note ||
    detail?.cancelled_note ||
    resolvedBooking?.note ||
    detail?.note ||
    "";

  return {
    hasBackendData: Boolean(actorRaw || actorName || reasonCodes.length || cancelledAt || note),
    actorLabel: getCancellationActorLabel(actorRaw),
    actorName,
    reasons: reasonCodes.map(getCancellationReasonLabel).filter(Boolean),
    cancelledAt,
    note,
  };
}

function getPaymentSnapshot(booking, paymentDetail) {
  const source = paymentDetail?.data || paymentDetail || {};
  const transaction = source?.transaction || source;
  const receipt = source?.receipt || null;
  const rawStatus = normalizeStatus(transaction?.status || receipt?.status || booking?.payment_status || booking?.receipt_status);
  const total = Number(receipt?.final_amount || booking?.total_fee || booking?.estimated_total || booking?.total || 0);
  const deposit = Number(receipt?.deposit_amount ?? booking?.deposit ?? 0);

  let paid = 0;
  if (rawStatus === "paid" || rawStatus === "success" || rawStatus === "completed") {
    paid = total > 0 ? total : Number(transaction?.amount || 0);
  } else if (rawStatus === "half_paid" || rawStatus === "half-paid") {
    paid = deposit + Number(transaction?.amount || 0);
  } else if (rawStatus === "refunded") {
    paid = 0;
  }

  const amountDueFromReceipt = receipt?.amount_due;
  const remaining = Number.isFinite(Number(amountDueFromReceipt))
    ? Math.max(Number(amountDueFromReceipt), 0)
    : rawStatus === "pending" || rawStatus === "unpaid"
      ? Math.max(total - deposit, 0)
      : Math.max(total - paid, 0);

  return { total, deposit, paid: Math.max(paid, 0), remaining };
}

function getBookingTitle(booking, detail) {
  const rooms = getBookingRoomEntries(booking, detail);
  if (rooms.length) return getRoomTitle(rooms[0]);

  const directRoom = {
    room_info: {
      room_number: booking?.room_info?.room_number || booking?.room_number,
      category: {
        name:
          booking?.room_info?.category?.name ||
          booking?.room_info?.category_name ||
          booking?.category?.name ||
          booking?.category_name ||
          booking?.room_name ||
          booking?.room_type ||
          "",
      },
    },
    room_number: booking?.room_number,
    category: booking?.category,
    category_name: booking?.category_name,
    room_name: booking?.room_name,
    room_type: booking?.room_type,
  };

  const directLabel = getRoomTitle(directRoom);
  if (directLabel && directLabel !== "Phòng lưu trú") return directLabel;

  return "Đơn đặt phòng";
}

function getRoomSummary(booking, detail) {
  const rooms = getBookingRoomEntries(booking, detail);
  if (!rooms.length) return "—";
  const primary = getRoomTitle(rooms[0]);
  if (rooms.length === 1) return primary;
  return `${primary} · +${rooms.length - 1} phòng khác`;
}

function getRoomStatusLabel(status) {
  const normalized = normalizeStatus(status);
  if (normalized === "reserved") return "Đã giữ chỗ";
  if (normalized === "checked_in" || normalized === "in_progress") return "Đang lưu trú";
  if (normalized === "checked_out") return "Đã trả phòng";
  if (normalized === "completed") return "Hoàn tất";
  if (normalized === "cancelled" || normalized === "canceled") return "Đã hủy";
  if (normalized === "pending") return "Chưa cọc";
  return normalizeStatusLabel(normalized);
}

function getBookingStatusMeta(booking) {
  const status = normalizeStatus(booking?.status);
  const paymentStatus = normalizeStatus(booking?.payment_status || booking?.receipt_status);
  const depositSettled = ["paid", "success", "completed", "half_paid", "half-paid"].includes(paymentStatus);

  if (status === "cancelled" || status === "canceled" || status === "expired") return { label: "Đã huỷ", tone: "info", group: "cancelled" };
  if (status === "completed" || (status === "checked_out" && depositSettled)) return { label: "Đã hoàn tất", tone: "success", group: "completed" };
  if (["checked_in", "in_progress"].includes(status)) return { label: "Đã check-in", tone: "success", group: "active" };
  if (status === "confirmed" || depositSettled) return { label: "Đã cọc", tone: "success", group: depositSettled ? "upcoming" : "pending" };
  if (status === "pending" || paymentStatus === "pending" || paymentStatus === "unpaid") return { label: "Chưa cọc", tone: "warning", group: "pending" };
  if (status === "checked_out") return { label: "Đã check-out", tone: "info", group: "completed" };
  if (status === "failed") return { label: "Thanh toán thất bại", tone: "info", group: "cancelled" };
  return { label: "—", tone: "info", group: "all" };
}

function getPaymentStatusMeta(paymentDetail, booking) {
  const source = paymentDetail?.data || paymentDetail || {};
  const transaction = source?.transaction || source;
  const receipt = source?.receipt || null;
  const rawStatus = normalizeStatus(transaction?.status || receipt?.status || booking?.payment_status || booking?.receipt_status);
  const bookingStatus = normalizeStatus(booking?.status);

  if (bookingStatus === "cancelled" || bookingStatus === "canceled" || bookingStatus === "expired") {
    return { label: "Đã huỷ", tone: "info" };
  }

  if (rawStatus === "paid" || rawStatus === "success" || rawStatus === "completed") {
    return { label: "Đã thanh toán đủ", tone: "success" };
  }
  if (rawStatus === "half_paid" || rawStatus === "half-paid") return { label: "Đã cọc", tone: "success" };
  if (rawStatus === "pending" || rawStatus === "unpaid") return { label: "Chưa cọc", tone: "warning" };
  if (rawStatus === "failed") return { label: "Thanh toán thất bại", tone: "info" };
  if (rawStatus === "cancelled" || rawStatus === "canceled") return { label: "Đã huỷ", tone: "info" };
  if (rawStatus === "refunded") return { label: "Đã hoàn tiền", tone: "info" };
  return { label: "—", tone: "info" };
}

function getPaymentOverviewText(booking, paymentDetail) {
  const status = normalizeStatus(booking?.status);
  const paymentStatus = normalizeStatus(paymentDetail?.data?.transaction?.status || paymentDetail?.data?.receipt?.status || booking?.payment_status || booking?.receipt_status);
  const wasPaid = ["paid", "success", "completed", "half_paid", "half-paid"].includes(paymentStatus);

  if (status === "pending") return "Chờ thanh toán cọc để giữ chỗ.";
  if (status === "cancelled" || status === "canceled" || status === "expired") {
    if (wasPaid) return "Đơn đã huỷ, các khoản thanh toán chỉ dùng để đối chiếu.";
    return "Đơn đã huỷ. Chưa ghi nhận thanh toán cọc.";
  }
  if (status === "confirmed") {
    if (wasPaid) return "Đã ghi nhận cọc. Đơn đặt phòng đã được giữ chỗ.";
    return "Đơn đã được xác nhận. Vui lòng hoàn tất thanh toán cọc.";
  }
  if (status === "in_progress" || status === "checked_in") return "Đã ghi nhận cọc. Khách đang lưu trú.";
  if (status === "checked_out") return "Đã hoàn tất lưu trú.";
  if (status === "completed") return "Đơn đã hoàn tất.";
  if (status === "failed") return "Thanh toán thất bại.";
  return "—";
}

function getPaymentTransactionIdentifier(booking) {
  const candidates = [
    booking?.transaction?.booking_code,
    booking?.payment?.booking_code,
    booking?.payment_transaction?.booking_code,
    booking?.payment_transaction?.orderCode,
    booking?.receipt?.booking_code,
    booking?.orderCode,
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const normalized = String(candidate).trim();
    if (!normalized) continue;
    if (/^\d+$/.test(normalized)) return normalized;
  }

  return "";
}

function shouldFetchPaymentTransaction(booking) {
  const status = normalizeStatus(booking?.status);
  if (status === "cancelled" || status === "canceled" || status === "expired") return false;
  return Boolean(getPaymentTransactionIdentifier(booking));
}

function getAmountSummary(booking) {
  const total = Number(booking?.total_fee || booking?.estimated_total || booking?.total || 0);
  const deposit = Number(booking?.deposit || 0);
  const remaining = Math.max(total - deposit, 0);
  return { total, deposit, remaining };
}

function getBookingCancelId(booking) {
  return booking?._id || booking?.id || "";
}

function canCancelBooking(booking) {
  const status = normalizeStatus(booking?.status);
  const allowedStatuses = new Set(["pending", "confirmed", "approved"]);
  if (!allowedStatuses.has(status)) return false;

  const bookingId = getBookingCancelId(booking);
  if (!bookingId) return false;

  const checkin = booking?.expected_checkin ? new Date(booking.expected_checkin) : null;
  if (checkin && !Number.isNaN(checkin.getTime())) {
    const now = new Date();
    if (now >= checkin) return false;
  }

  return true;
}

function getCancelDisabledReason(booking) {
  const status = normalizeStatus(booking?.status);
  if (!getBookingCancelId(booking)) return "Không tìm thấy mã booking để hủy.";
  if (["cancelled", "canceled", "completed", "checked_in", "checked-out", "checked_out", "failed", "expired"].includes(status)) {
    return "Đặt phòng này không thể hủy.";
  }

  const checkin = booking?.expected_checkin ? new Date(booking.expected_checkin) : null;
  if (checkin && !Number.isNaN(checkin.getTime()) && new Date() >= checkin) {
    return "Đặt phòng này đã qua thời gian có thể hủy.";
  }

  return "";
}

function matchesSearchTerm(booking, term) {
  const normalized = String(term || "").trim().toLowerCase();
  if (!normalized) return true;

  const haystacks = [
    getBookingCode(booking),
    booking?.rooms?.[0]?.room_info?.room_number,
    booking?.rooms?.[0]?.room_info?.category?.name,
    booking?.rooms?.map((room) => getRoomTitle(room)).join(" "),
    booking?.status,
  ];

  return haystacks
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalized));
}

function matchesStatusFilter(booking, filterKey) {
  if (filterKey === "all") return true;
  return getBookingStatusMeta(booking).group === filterKey;
}

function sortBookings(bookings, sortBy) {
  const list = [...bookings];
  const valueOf = (booking) => new Date(booking?.created_at || booking?.createdAt || 0).getTime();

  switch (sortBy) {
    case "oldest":
      return list.sort((a, b) => valueOf(a) - valueOf(b));
    case "checkin_soon":
      return list.sort((a, b) => new Date(a?.expected_checkin || 0).getTime() - new Date(b?.expected_checkin || 0).getTime());
    case "total_desc":
      return list.sort((a, b) => Number(b?.total_fee || 0) - Number(a?.total_fee || 0));
    case "total_asc":
      return list.sort((a, b) => Number(a?.total_fee || 0) - Number(b?.total_fee || 0));
    case "newest":
    default:
      return list.sort((a, b) => valueOf(b) - valueOf(a));
  }
}

function StatusTab({ active, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`booking-status-tab ${active ? "booking-status-tab--active" : ""}`}
    >
      <span>{label}</span>
      <span className="booking-status-tab__count">
        {count}
      </span>
    </button>
  );
}

function BookingStatusBadge({ tone = "info", children }) {
  const tones = {
    success: "border-emerald-300 bg-emerald-100 text-emerald-950 shadow-[0_8px_18px_rgba(16,185,129,0.12)]",
    warning: "border-amber-300 bg-amber-200 text-amber-950 shadow-[0_8px_18px_rgba(245,158,11,0.14)]",
    info: "border-stone-300 bg-stone-200 text-stone-900 shadow-[0_8px_18px_rgba(28,25,23,0.06)]",
  };

  return (
    <span className={`inline-flex shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${tones[tone] || tones.info}`}>
      {children}
    </span>
  );
}

function BookingWorkspaceShell({ children }) {
  return (
    <div className="booking-workspace-shell rounded-[30px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(255,250,242,0.92)_100%)] p-3 shadow-[0_20px_50px_rgba(28,25,23,0.08)] md:p-4">
      {children}
    </div>
  );
}

function BookingSectionTitle({ title, subtitle, right }) {
  return (
    <div className="booking-section-title flex items-start justify-between gap-4 rounded-[20px] border border-stone-200 bg-white px-4 py-3 shadow-[0_10px_26px_rgba(28,25,23,0.06)]">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{subtitle}</p>
        <h3 className="mt-1 text-lg font-semibold tracking-tight text-stone-950">{title}</h3>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

function BookingSkeleton() {
  return (
    <div className="animate-pulse rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_14px_32px_rgba(28,25,23,0.08)]">
      <div className="h-4 w-40 rounded-full bg-stone-200" />
      <div className="mt-4 h-6 w-2/3 rounded-full bg-stone-200" />
      <div className="mt-3 h-4 w-5/6 rounded-full bg-stone-200" />
      <div className="mt-5 h-10 w-48 rounded-full bg-stone-200" />
    </div>
  );
}

function EmptySelectedDetail() {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-white px-6 py-10 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-950 text-amber-300">
        <CalendarDays size={22} />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-stone-950">Chọn một đặt phòng để xem chi tiết</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-stone-600">
        Bạn có thể mở một booking bất kỳ để xem phòng, tiền cọc và trạng thái thanh toán.
      </p>
    </div>
  );
}

function GuestLookupForm({ form, setForm, onSubmit, loading, error, initialBookingCode }) {
  return (
    <form onSubmit={onSubmit} className="w-full rounded-[32px] border border-stone-200 bg-white p-5 shadow-[0_18px_46px_rgba(28,25,23,0.08)] md:p-6">
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Tra cứu đặt phòng</p>
        <h1 className="text-3xl font-semibold tracking-tight text-stone-950">Tra cứu đặt phòng</h1>
        <p className="max-w-2xl text-sm leading-6 text-stone-600">
          Nhập mã đặt phòng và email hoặc số điện thoại dùng khi đặt phòng để kiểm tra trạng thái đơn.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Mã đặt phòng
          <input
            value={form.bookingCode}
            onChange={(event) => setForm((prev) => ({ ...prev, bookingCode: event.target.value }))}
            placeholder={initialBookingCode || "Nhập mã đặt phòng"}
            className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Email hoặc số điện thoại
          <input
            value={form.contact}
            onChange={(event) => setForm((prev) => ({ ...prev, contact: event.target.value }))}
            placeholder="ban@email.com hoặc 09xxxxxxxx"
            className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
          Tra cứu
        </button>

        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
        >
          Đăng nhập để xem tất cả đặt phòng của bạn
        </Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      ) : null}
    </form>
  );
}

function BookingCard({ booking, selected, onSelect, onPay, paymentBusy }) {
  const statusMeta = getBookingStatusMeta(booking);
  const { total, deposit, remaining } = getAmountSummary(booking);
  const nights = getNightCount(booking?.expected_checkin, booking?.expected_checkout);
  const roomSummary = getRoomSummary(booking);
  const guestLabel = Number(booking?.adults || booking?.guest_count || 0) + Number(booking?.children || 0)
    ? `${Number(booking?.adults || booking?.guest_count || 0)} người lớn${Number(booking?.children || 0) ? ` · ${Number(booking?.children || 0)} trẻ em` : ""}`
    : "";
  const showRebook = statusMeta.group === "cancelled" || statusMeta.group === "completed";

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(booking)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(booking);
        }
      }}
      className={`booking-ticket booking-ticket--${statusMeta.group} group relative cursor-pointer overflow-hidden p-0 shadow-[0_18px_42px_rgba(28,25,23,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(28,25,23,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 ${
        selected ? "ring-1 ring-stone-950/10 shadow-[0_26px_58px_rgba(28,25,23,0.18)]" : ""
      }`}
    >
      <div className="booking-ticket__surface">
        <div className="booking-ticket__main">
          <div className="booking-ticket__header">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                  <h3 className="booking-ticket__title break-words text-lg font-semibold tracking-tight">
                  {getBookingTitle(booking)}
                </h3>
                <BookingStatusBadge tone={statusMeta.tone}>{statusMeta.label}</BookingStatusBadge>
              </div>
              <p className="booking-ticket__code text-sm">#{shortBookingCode(booking)}</p>
            </div>

            <div className="text-right">
              <p className="booking-ticket__metric-label">Tổng tiền</p>
              <p className="booking-ticket__metric-value">{total > 0 ? `${formatMoney(total)} VNĐ` : "--"}</p>
            </div>
          </div>

          <div className="booking-ticket__meta-row text-sm">
            <span>
              {formatDate(booking?.expected_checkin)} → {formatDate(booking?.expected_checkout)}
            </span>
            <span className="text-stone-300">•</span>
            <span>{nights > 0 ? `${nights} đêm` : "--"}</span>
            {guestLabel ? (
              <>
                <span className="text-stone-300">•</span>
                <span>{guestLabel}</span>
              </>
            ) : null}
          </div>

          <p className="booking-ticket__summary line-clamp-1 text-sm leading-6">{roomSummary}</p>

          <div className="booking-ticket__facts">
            <div className={`booking-ticket__fact ${statusMeta.group === "pending" ? "booking-ticket__fact--accent" : ""}`}>
              <span className="booking-ticket__fact-label">
                {statusMeta.group === "pending" ? "Cọc cần thanh toán" : "Tiền cọc"}
              </span>
              <span className="booking-ticket__fact-value">
                {deposit > 0 ? `${formatMoney(deposit)} VNĐ` : statusMeta.group === "cancelled" ? "--" : "Miễn cọc"}
              </span>
            </div>
            <div className="booking-ticket__fact">
              <span className="booking-ticket__fact-label">Còn lại</span>
              <span className="booking-ticket__fact-value">{remaining > 0 ? `${formatMoney(remaining)} VNĐ` : "Đã đủ"}</span>
            </div>
            {statusMeta.group === "cancelled" ? (
              <div className="booking-ticket__fact booking-ticket__fact--muted">
                <span className="booking-ticket__fact-label">Trạng thái</span>
                <span className="booking-ticket__fact-value">Đơn đã hủy</span>
              </div>
            ) : null}
          </div>

          <div className="booking-ticket__actions">
            {statusMeta.group === "pending" ? (
              <button
                type="button"
                disabled={paymentBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  onPay(booking);
                }}
                className="booking-ticket__action booking-ticket__action--primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {paymentBusy ? <Loader2 size={16} className="animate-spin" /> : null}
                Thanh toán cọc
              </button>
            ) : null}

            {showRebook ? (
              <Link
                to="/hotel/rooms"
                onClick={(event) => event.stopPropagation()}
                className="booking-ticket__action"
              >
                Đặt lại
                <ArrowRight size={16} />
              </Link>
            ) : null}

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onSelect(booking);
              }}
              className="booking-ticket__action"
            >
              Xem chi tiết
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function DetailRow({ label, value, compact = false, className = "" }) {
  if (compact) {
    return (
      <div className={`flex items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5 ${className}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">{label}</p>
        <p className="max-w-[60%] text-right text-sm font-semibold leading-6 text-stone-950 break-words">{value}</p>
      </div>
    );
  }

  return (
    <div className={`booking-detail-row ${className}`}>
      <p className="booking-detail-row__label">{label}</p>
      <p className="booking-detail-row__value break-words">{value}</p>
    </div>
  );
}

function BookingDetailPanel({
  booking,
  detail,
  paymentDetail,
  loading,
  error,
  paymentBusy,
  paymentError,
  onClose,
  onPay,
  onRetry,
  onRequestCancel,
  allowPay = true,
  showCloseButton = true,
  showCancelButton = true,
  sectionLabel = "Chi tiết đặt phòng",
}) {
  const resolvedBooking = detail?.booking || booking;
  const rooms = getBookingRoomEntries(booking, detail);
  const statusMeta = getBookingStatusMeta(resolvedBooking);
  const paymentMeta = getPaymentStatusMeta(paymentDetail, resolvedBooking);
  const paymentOverviewText = getPaymentOverviewText(resolvedBooking, paymentDetail);
  const { total, deposit, remaining } = getAmountSummary(resolvedBooking);
  const { total: paymentTotal, deposit: paymentDeposit, paid: paymentPaid, remaining: paymentRemaining } = getPaymentSnapshot(
    resolvedBooking,
    paymentDetail,
  );
  const nights = getNightCount(resolvedBooking?.expected_checkin, resolvedBooking?.expected_checkout);
  const adults = Number(resolvedBooking?.adults || 0);
  const children = Number(resolvedBooking?.children || 0);
  const canPay = allowPay && normalizeStatus(resolvedBooking?.status) === "pending";
  const bookingTitle = getBookingTitle(resolvedBooking, detail);
  const roomSummary = rooms.length ? getRoomSummary(resolvedBooking, detail) : "—";
  const canCancel = showCancelButton && canCancelBooking(resolvedBooking);
  const cancelDisabledReason = getCancelDisabledReason(resolvedBooking);
  const bookingCode = getBookingCode(resolvedBooking);
  const guestValue = adults > 0 || children > 0
    ? `${adults} người lớn${children ? ` · ${children} trẻ em` : ""}`
    : "--";
  const customerInfo = getCustomerInfo(resolvedBooking);
  const cancellationInfo = getCancellationInfo(resolvedBooking, detail);
  const primaryCancellationReason = cancellationInfo.reasons[0] || rooms.find((room) => room?.cancellation_reason)?.cancellation_reason || "";
  const showCancellationSection = Boolean(cancellationInfo.actorLabel || cancellationInfo.actorName || cancellationInfo.cancelledAt);
  const showCancellationReasonLine = statusMeta.group === "cancelled" && Boolean(primaryCancellationReason);

  const handleCopy = async () => {
    const code = String(bookingCode);
    if (!code || code === "--") return;
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      // silent
    }
  };

  return (
    <div className={`booking-detail-card rounded-[28px] border bg-white shadow-[0_20px_52px_rgba(28,25,23,0.12)] ${
      statusMeta.group === "pending"
        ? "border-amber-200"
        : statusMeta.group === "cancelled"
          ? "border-stone-300"
          : statusMeta.group === "completed"
            ? "border-emerald-200"
            : "border-stone-300"
    }`}>
      <div className={`booking-detail-card__header flex items-start justify-between gap-4 border-b px-5 py-5 ${
        statusMeta.group === "pending"
          ? "border-amber-100 bg-[linear-gradient(180deg,#fff5de_0%,#ffffff_100%)]"
          : statusMeta.group === "cancelled"
            ? "border-stone-100 bg-[linear-gradient(180deg,#f8f8f8_0%,#ffffff_100%)]"
            : statusMeta.group === "completed"
              ? "border-emerald-100 bg-[linear-gradient(180deg,#eefaf2_0%,#ffffff_100%)]"
              : "border-stone-100 bg-[linear-gradient(180deg,#fff5e4_0%,#ffffff_100%)]"
      }`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">{sectionLabel}</p>
          <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-stone-950">
            {bookingTitle}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-medium text-stone-600">
            <span>Mã booking {bookingCode}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
            >
              <Copy size={14} />
              Copy mã
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <BookingStatusBadge tone={statusMeta.tone}>{statusMeta.label}</BookingStatusBadge>
            <BookingStatusBadge tone={paymentMeta.tone}>{paymentMeta.label}</BookingStatusBadge>
          </div>
          {showCancellationReasonLine ? (
            <p className="mt-2 text-sm font-medium text-stone-700">
              Lý do huỷ: {getCancellationReasonLabel(primaryCancellationReason)}
            </p>
          ) : null}
        </div>
        {showCloseButton ? (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

      <div className="space-y-5 px-5 py-5">
        {loading ? (
          <div className="space-y-4">
            <div className="h-24 animate-pulse rounded-[24px] bg-stone-100" />
            <div className="h-24 animate-pulse rounded-[24px] bg-stone-100" />
            <div className="h-24 animate-pulse rounded-[24px] bg-stone-100" />
          </div>
        ) : error ? (
          <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
            <p className="font-semibold">Không thể tải chi tiết đặt phòng.</p>
            <p className="mt-1 leading-6">{error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              <Search size={16} />
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {paymentError ? (
              <div className="rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900 shadow-[0_8px_20px_rgba(245,158,11,0.08)]">
                {paymentError}
              </div>
            ) : null}

            <section className="booking-detail-card__section rounded-[24px] border border-stone-200 bg-white p-3 shadow-[0_10px_24px_rgba(28,25,23,0.06)]">
              <BookingSectionTitle subtitle="Khách hàng" title="Thông tin khách hàng" />
              <div className="mt-3 space-y-2">
                <DetailRow compact label="Họ tên" value={customerInfo.fullName || "—"} />
                <DetailRow compact label="Số điện thoại" value={customerInfo.phone || "—"} />
                <DetailRow compact label="Email" value={customerInfo.email || "—"} />
                <DetailRow compact label="CCCD/CMND" value={customerInfo.cccd || "—"} />
              </div>
            </section>

            <section className="booking-detail-card__section rounded-[24px] border border-stone-200 bg-white p-3 shadow-[0_10px_24px_rgba(28,25,23,0.06)]">
              <BookingSectionTitle
                subtitle="Tóm tắt"
                title="Thông tin lưu trú"
                right={<BookingStatusBadge tone={statusMeta.tone}>{statusMeta.label}</BookingStatusBadge>}
              />
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DetailRow compact label="Nhận phòng" value={formatDate(resolvedBooking?.expected_checkin)} />
                <DetailRow compact label="Trả phòng" value={formatDate(resolvedBooking?.expected_checkout)} />
                <DetailRow compact label="Số đêm" value={nights > 0 ? `${nights} đêm` : "--"} />
                <DetailRow compact label="Khách" value={guestValue} />
                <DetailRow compact label="Phòng / hạng phòng" value={roomSummary} className="sm:col-span-2" />
              </div>
            </section>

            <section className="booking-detail-card__section rounded-[24px] border border-stone-200 bg-white p-3 shadow-[0_10px_24px_rgba(28,25,23,0.06)]">
              <BookingSectionTitle subtitle="Thanh toán" title="Thanh toán" right={<BookingStatusBadge tone={paymentMeta.tone}>{paymentMeta.label}</BookingStatusBadge>} />
              <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-semibold text-stone-800">
                {paymentOverviewText}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <DetailRow compact label="Tổng tiền" value={paymentTotal > 0 ? `${formatMoney(paymentTotal)} VNĐ` : "--"} />
                <DetailRow compact label="Tiền cọc" value={paymentDeposit > 0 ? `${formatMoney(paymentDeposit)} VNĐ` : "Chưa cọc"} />
                <DetailRow compact label="Đã thanh toán" value={paymentPaid > 0 ? `${formatMoney(paymentPaid)} VNĐ` : "0 VNĐ"} />
                <DetailRow compact label="Còn lại" value={paymentRemaining > 0 ? `${formatMoney(paymentRemaining)} VNĐ` : "Đã đủ"} />
              </div>
              {canPay ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900">
                  Đơn đang chờ thanh toán cọc để giữ chỗ.
                </div>
              ) : null}
            </section>

            {showCancellationSection ? (
              <section className="booking-detail-card__section rounded-[24px] border border-stone-200 bg-white p-3 shadow-[0_10px_24px_rgba(28,25,23,0.06)]">
                <BookingSectionTitle subtitle="Huỷ đơn" title="Thông tin huỷ đơn" />
                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {cancellationInfo.actorLabel || cancellationInfo.actorName ? (
                    <DetailRow
                      compact
                      label="Người huỷ"
                      value={cancellationInfo.actorName ? `${cancellationInfo.actorLabel || "—"} · ${cancellationInfo.actorName}` : (cancellationInfo.actorLabel || "—")}
                    />
                  ) : null}
                  {cancellationInfo.reasons.length ? (
                    <DetailRow compact label="Lý do huỷ" value={cancellationInfo.reasons.join(" · ")} />
                  ) : null}
                  {cancellationInfo.cancelledAt ? (
                    <DetailRow compact label="Thời điểm huỷ" value={formatDateTime(cancellationInfo.cancelledAt)} />
                  ) : null}
                </div>
              </section>
            ) : null}

            <section className="booking-detail-card__section rounded-[24px] border border-stone-200 bg-white p-3 shadow-[0_10px_24px_rgba(28,25,23,0.06)]">
              <BookingSectionTitle subtitle="Phòng" title="Danh sách phòng" />
              <div className="mt-3 space-y-2">
                {rooms.length ? (
                  rooms.map((room, index) => (
                    <div key={room?.detail_id || room?._id || index} className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2.5">
                      <p className="text-sm font-semibold text-stone-950">{getRoomTitle(room)}</p>
                      <p className="mt-1 text-sm text-stone-600">
                        {formatDate(room?.expected_checkin)} → {formatDate(room?.expected_checkout)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <BookingStatusBadge tone={room?.status === "checked_out" ? "success" : room?.status === "cancelled" ? "info" : "warning"}>
                          {getRoomStatusLabel(room?.status)}
                        </BookingStatusBadge>
                        {room?.note ? <span className="text-sm text-stone-500">{room.note}</span> : null}
                        {room?.cancellation_reason && statusMeta.group !== "cancelled" ? (
                          <span className="text-sm text-stone-600">
                            Lý do huỷ: {getCancellationReasonLabel(room.cancellation_reason)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-600">
                    Chưa có thông tin chi tiết phòng.
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>

      <div className="booking-detail-card__footer border-t border-stone-100 bg-white px-5 py-4">
        <div className="flex flex-wrap gap-3">
          {canPay ? (
            <button
              type="button"
              onClick={() => onPay(resolvedBooking)}
              disabled={paymentBusy}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(28,25,23,0.24)] ring-1 ring-stone-950/10 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {paymentBusy ? <Loader2 size={16} className="animate-spin" /> : null}
              Thanh toán cọc
            </button>
          ) : null}

          {canCancel ? (
            <button
              type="button"
              onClick={() => onRequestCancel?.(resolvedBooking)}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:border-red-300 hover:bg-red-50"
              title={cancelDisabledReason || "Hủy đặt phòng"}
            >
              Hủy đặt phòng
            </button>
          ) : null}

          <Link
            to="/hotel/rooms"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Xem phòng
          </Link>
        </div>
      </div>
    </div>
  );
}

function MobileDetailSheet({ open, onClose, children }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Đóng chi tiết"
        onClick={onClose}
        className="absolute inset-0 bg-stone-950/45 backdrop-blur-[2px]"
      />
      <div className="absolute inset-x-0 bottom-0 flex justify-center p-0 md:inset-0 md:items-center md:p-6">
        <div className="booking-detail-sheet max-h-[90vh] w-full overflow-hidden rounded-t-[32px] border border-stone-200 bg-white shadow-[0_-18px_50px_rgba(28,25,23,0.14)] md:max-w-4xl md:rounded-[32px] md:shadow-[0_28px_80px_rgba(28,25,23,0.22)]">
          <div className="max-h-[90vh] overflow-y-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}

function CancelBookingConfirmModal({ open, booking, reason, loading, error, onCancel, onConfirm, onReasonChange }) {
  if (!open || !booking) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/45 px-4 py-6 backdrop-blur-[2px]">
      <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-white p-5 shadow-[0_28px_80px_rgba(28,25,23,0.22)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Xác nhận hủy</p>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
          Bạn chắc chắn muốn hủy đặt phòng này?
        </h3>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          {getBookingTitle(booking)} · Mã {getBookingCode(booking)}
        </p>

        <label className="mt-4 grid gap-2 text-sm font-medium text-stone-700">
          Lý do hủy
          <select
            value={reason}
            onChange={(event) => onReasonChange(event.target.value)}
            className="h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          >
            <option value="">Chọn lý do</option>
            {CANCELLATION_REASON_OPTIONS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        {error ? (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="inline-flex flex-1 items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Không
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading || !reason}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            Xác nhận hủy
          </button>
        </div>
      </div>
    </div>
  );
}

function SearchToolbar({
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  statusFilter,
  setStatusFilter,
  onSubmit,
  onReset,
  counts,
  hasActiveFilters,
}) {
  const tabs = [
    { key: "all", label: "Tất cả" },
    { key: "pending", label: "Chờ thanh toán" },
    { key: "upcoming", label: "Sắp tới" },
    { key: "active", label: "Đang lưu trú" },
    { key: "completed", label: "Đã hoàn tất" },
    { key: "cancelled", label: "Đã hủy" },
  ];

  return (
    <div className="customer-bookings-toolbar rounded-[26px] p-4 shadow-[0_18px_40px_rgba(28,25,23,0.08)] md:p-5">
      <div className="customer-bookings-toolbar__header">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Bộ lọc booking</p>
          <h2 className="customer-bookings-toolbar__title text-lg font-semibold tracking-tight">Tìm đơn, lọc trạng thái và sắp xếp</h2>
          <p className="customer-bookings-toolbar__subtitle text-sm">Dò nhanh booking theo mã, ngày và trạng thái.</p>
        </div>
        {hasActiveFilters ? (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 shadow-[0_8px_18px_rgba(28,25,23,0.05)] transition hover:border-stone-400 hover:bg-stone-50"
          >
            <X size={16} />
            Xóa bộ lọc
          </button>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Mã đơn hoặc phòng
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo mã đơn hoặc tên phòng"
              className="h-11 w-full rounded-2xl border border-stone-300 bg-stone-50 py-0 pl-10 pr-4 text-stone-900 outline-none transition placeholder:text-stone-500 focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
            />
          </div>
        </label>

        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Sắp xếp
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="h-11 w-full rounded-2xl border border-stone-300 bg-stone-50 px-4 text-stone-900 outline-none transition focus:border-amber-400 focus:bg-white focus:ring-4 focus:ring-amber-100"
          >
            <option value="newest">Mới nhất</option>
            <option value="checkin_soon">Ngày nhận phòng gần nhất</option>
            <option value="total_desc">Tổng tiền cao nhất</option>
            <option value="total_asc">Tổng tiền thấp nhất</option>
            <option value="oldest">Cũ nhất</option>
          </select>
        </label>
      </form>

      <div className="mt-4 flex flex-nowrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((item) => (
          <StatusTab
            key={item.key}
            active={statusFilter === item.key}
            label={item.label}
            count={counts[item.key] ?? 0}
            onClick={() => setStatusFilter(item.key)}
          />
        ))}
      </div>
    </div>
  );
}

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBookingCode = searchParams.get("bookingCode") || "";
  const [searchTerm, setSearchTerm] = useState(initialBookingCode);
  const [sortBy, setSortBy] = useState("newest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [bookingDetail, setBookingDetail] = useState(null);
  const [paymentDetail, setPaymentDetail] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [drawerError, setDrawerError] = useState("");
  const [paymentBusyId, setPaymentBusyId] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const [reloadIndex, setReloadIndex] = useState(0);
  const [detailReloadIndex, setDetailReloadIndex] = useState(0);
  const [queryHint, setQueryHint] = useState("");
  const [guestLookupForm, setGuestLookupForm] = useState({
    bookingCode: initialBookingCode,
    contact: searchParams.get("contact") || "",
  });
  const [guestLookupLoading, setGuestLookupLoading] = useState(false);
  const [guestLookupError, setGuestLookupError] = useState("");
  const [guestLookupResult, setGuestLookupResult] = useState(null);
  const queryAppliedRef = useRef(false);

  useEffect(() => {
    setSearchTerm(initialBookingCode);
    setQueryHint(initialBookingCode ? "Đang tìm đơn theo mã đã nhập sẵn trong URL." : "");
  }, [initialBookingCode]);

  useEffect(() => {
    if (user) return;
    setGuestLookupForm((prev) => ({
      bookingCode: searchParams.get("bookingCode") || prev.bookingCode,
      contact: searchParams.get("contact") || prev.contact,
    }));
  }, [searchParams, user]);

  useEffect(() => {
    if (!user) {
      setBookings([]);
      return;
    }

    let cancelled = false;

    const loadBookings = async () => {
      setLoading(true);
      setError("");
      try {
        const payload = await customerPortalApi.getMyBookings({ page: 1, limit: 50 });
        if (cancelled) return;
        const nextBookings = Array.isArray(payload)
          ? payload
          : payload?.bookings || payload?.data?.bookings || payload?.data || [];
        setBookings(Array.isArray(nextBookings) ? nextBookings : []);
      } catch (err) {
        if (cancelled) return;
        setError(err.message || "Không thể tải danh sách đặt phòng.");
        setBookings([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadBookings();

    return () => {
      cancelled = true;
    };
  }, [user, reloadIndex]);

  useEffect(() => {
    if (queryAppliedRef.current) return;
    if (!initialBookingCode || !bookings.length) return;

    const normalized = initialBookingCode.trim().toLowerCase();
    if (!normalized) {
      queryAppliedRef.current = true;
      return;
    }

    const match = bookings.find((booking) => {
      const candidates = [booking?._id, booking?.id, booking?.booking_code];
      return candidates
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === normalized);
    });

    if (match) {
      setSelectedBooking(match);
      setQueryHint("");
    } else {
      setQueryHint("Không tìm thấy đặt phòng với mã này.");
    }

    queryAppliedRef.current = true;
  }, [bookings, initialBookingCode]);

  const bookingCounts = useMemo(() => {
    return bookings.reduce(
      (acc, booking) => {
        acc.all += 1;
        const meta = getBookingStatusMeta(booking);
        acc[meta.group] = (acc[meta.group] || 0) + 1;
        return acc;
      },
      { all: 0, pending: 0, upcoming: 0, active: 0, completed: 0, cancelled: 0 },
    );
  }, [bookings]);

  const filteredBookings = useMemo(() => {
    return sortBookings(
      bookings
        .filter((booking) => matchesStatusFilter(booking, statusFilter))
        .filter((booking) => matchesSearchTerm(booking, searchTerm)),
      sortBy,
    );
  }, [bookings, searchTerm, sortBy, statusFilter]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
      statusFilter !== "all" ||
      sortBy !== "newest" ||
      initialBookingCode,
  );

  const handleSearch = (event) => {
    event.preventDefault();
    const trimmed = searchTerm.trim();
    if (trimmed) {
      setSearchParams({ bookingCode: trimmed });
      setQueryHint("");
    } else {
      setSearchParams({});
      setQueryHint("");
    }
  };

  const handleReset = () => {
    setSearchTerm("");
    setSortBy("newest");
    setStatusFilter("all");
    setSearchParams({});
    setQueryHint("");
  };

  const handleGuestLookup = async (event) => {
    event.preventDefault();

    const bookingCode = guestLookupForm.bookingCode.trim();
    const contact = guestLookupForm.contact.trim();

    if (!bookingCode) {
      setGuestLookupError("Vui lòng nhập mã đặt phòng.");
      setGuestLookupResult(null);
      return;
    }

    if (!contact) {
      setGuestLookupError("Vui lòng nhập email hoặc số điện thoại dùng khi đặt phòng.");
      setGuestLookupResult(null);
      return;
    }

    setGuestLookupLoading(true);
    setGuestLookupError("");
    setGuestLookupResult(null);

    try {
      const result = await customerPortalApi.lookupPublicBooking({ bookingCode, contact });
      setGuestLookupResult(result);
    } catch (err) {
      setGuestLookupError(err.message || "Không thể tra cứu đặt phòng.");
    } finally {
      setGuestLookupLoading(false);
    }
  };

  const openBooking = (booking) => {
    if (!booking) return;
    setSelectedBooking(booking);
    setBookingDetail(null);
    setPaymentDetail(null);
    setDrawerError("");
    setPaymentError("");
  };

  const closeBooking = () => {
    setSelectedBooking(null);
    setBookingDetail(null);
    setPaymentDetail(null);
    setDrawerError("");
    setPaymentError("");
    setCancelTarget(null);
    setCancelReason("");
    setCancelError("");
  };

  const requestCancelBooking = (booking) => {
    if (!booking || !canCancelBooking(booking)) return;
    setCancelTarget(booking);
    setCancelReason("");
    setCancelError("");
  };

  const closeCancelDialog = () => {
    if (cancelSubmitting) return;
    setCancelTarget(null);
    setCancelReason("");
    setCancelError("");
  };

  const confirmCancelBooking = async () => {
    const bookingId = getBookingCancelId(cancelTarget);
    if (!bookingId) {
      setCancelError("Không tìm thấy mã booking để hủy.");
      return;
    }

    if (!cancelReason) {
      setCancelError("Vui lòng chọn lý do hủy.");
      return;
    }

    setCancelSubmitting(true);
    setCancelError("");
    try {
      await customerPortalApi.cancelCustomerBooking(bookingId, cancelReason);
      setDrawerError("");
      setPaymentError("");
      setSelectedBooking((prev) => (getBookingCancelId(prev) === bookingId ? { ...prev, status: "cancelled" } : prev));
      setBookingDetail((prev) => (prev && getBookingCancelId(prev.booking || prev) === bookingId
        ? { ...prev, booking: { ...(prev.booking || {}), status: "cancelled" } }
        : prev));
      setBookings((prev) => prev.map((item) => (getBookingCancelId(item) === bookingId ? { ...item, status: "cancelled" } : item)));
      setCancelTarget(null);
      setCancelReason("");
      setReloadIndex((value) => value + 1);
      setDetailReloadIndex((value) => value + 1);
    } catch (err) {
      setCancelError(err.message || "Không thể hủy đặt phòng.");
    } finally {
      setCancelSubmitting(false);
    }
  };

  const handlePayDeposit = async (booking) => {
    const bookingId = booking?._id || booking?.id;
    const paymentUserId = user?._id || user?.userId || user?.id;
    const depositAmount = Number(booking?.deposit || 0);

    if (!paymentUserId) {
      setPaymentError("Vui lòng đăng nhập lại để thanh toán.");
      return;
    }

    if (!bookingId || depositAmount <= 0) {
      setPaymentError("Không thể tạo link thanh toán cho đơn này.");
      return;
    }

    setPaymentBusyId(String(bookingId));
    setPaymentError("");

    try {
      const paymentRes = await paymentApi.createPaymentLink(paymentUserId, {
        booking_id: bookingId,
        amount: depositAmount,
        description: `Tiền cọc đặt phòng #${String(bookingId).slice(-6)}`,
        items: [
          {
            name: "Tiền cọc đặt phòng",
            quantity: 1,
            price: depositAmount,
          },
        ],
      });

      const checkoutUrl = paymentRes?.data?.checkoutUrl;
      if (!checkoutUrl) {
        throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
      }

      window.location.assign(checkoutUrl);
    } catch (err) {
      const message = err.response?.data?.message || err.message || "Không thể tạo lại thanh toán.";
      setPaymentError(message);
      setDrawerError(message);
      setPaymentBusyId("");
    }
  };

  useEffect(() => {
    if (!selectedBooking) return;

    let cancelled = false;
    const bookingId = selectedBooking?._id || selectedBooking?.id;
    const paymentTransactionIdentifier = getPaymentTransactionIdentifier(selectedBooking);

    const loadDetail = async () => {
      setDrawerLoading(true);
      setDrawerError("");
      try {
        try {
          const detailPayload = await customerPortalApi.getMyBookingDetail(bookingId);
          if (cancelled) return;
          setBookingDetail(detailPayload || { booking: selectedBooking, rooms: selectedBooking?.rooms || [] });
        } catch (detailErr) {
          if (cancelled) return;
          setBookingDetail({ booking: selectedBooking, rooms: selectedBooking?.rooms || [] });
          setDrawerError(detailErr?.message || "Không thể tải chi tiết đặt phòng.");
        }

        if (shouldFetchPaymentTransaction(selectedBooking) && paymentTransactionIdentifier) {
          try {
            const paymentPayload = await paymentApi.getPaymentTransactionDetail(paymentTransactionIdentifier);
            if (!cancelled) {
              setPaymentDetail(paymentPayload || null);
            }
          } catch (paymentErr) {
            if (!cancelled) {
              const statusCode = paymentErr?.response?.status;
              if (statusCode !== 400 && statusCode !== 404) {
                setDrawerError(paymentErr?.message || "Không thể tải chi tiết thanh toán.");
              }
              setPaymentDetail(null);
            }
          }
        } else {
          setPaymentDetail(null);
        }
      } catch (err) {
        if (!cancelled) {
          setDrawerError(err.message || "Không thể tải chi tiết đặt phòng.");
        }
      } finally {
        if (!cancelled) setDrawerLoading(false);
      }
    };

    loadDetail();

    return () => {
      cancelled = true;
    };
  }, [detailReloadIndex, selectedBooking]);

  if (!user) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-5xl px-4 py-6 md:px-6">
          <div className="grid gap-6">
            <GuestLookupForm
              form={guestLookupForm}
              setForm={setGuestLookupForm}
              onSubmit={handleGuestLookup}
              loading={guestLookupLoading}
              error={guestLookupError}
              initialBookingCode={initialBookingCode}
            />

            {guestLookupResult ? (
            <BookingDetailPanel
              booking={guestLookupResult.booking}
              detail={guestLookupResult}
              paymentDetail={null}
              loading={false}
              error=""
              paymentBusy={false}
              paymentError=""
              onClose={() => {}}
              onPay={() => {}}
              onRetry={() => {}}
              onRequestCancel={() => {}}
              allowPay={false}
              showCloseButton={false}
              showCancelButton={false}
              sectionLabel="Kết quả tra cứu"
            />
            ) : (
              <EmptyState
                title="Chưa có kết quả tra cứu"
                description="Nhập mã đặt phòng và email hoặc số điện thoại để kiểm tra trạng thái đơn."
              />
            )}
          </div>
        </section>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <section className="customer-bookings-page mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="booking-page-header flex flex-col gap-4 rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(250,247,241,0.98)_100%)] px-4 py-4 shadow-[0_12px_30px_rgba(28,25,23,0.06)] md:flex-row md:items-end md:justify-between md:px-5 md:py-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Đặt phòng của tôi</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-950 md:text-[2rem]">Đặt phòng của tôi</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Theo dõi trạng thái, thanh toán cọc và xem chi tiết đơn.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 shadow-sm">
              <span className="text-stone-500">Đơn</span>
              <span className="text-stone-950">{bookingCounts.all}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 shadow-sm">
              <span>Chờ thanh toán</span>
              <span>{bookingCounts.pending}</span>
            </div>
            <Link
              to="/hotel/rooms"
              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_20px_rgba(28,25,23,0.16)] transition hover:bg-stone-800"
            >
              Xem phòng
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>

        <div className="mt-4">
          <SearchToolbar
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            sortBy={sortBy}
            setSortBy={setSortBy}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onSubmit={handleSearch}
            onReset={handleReset}
            counts={bookingCounts}
            hasActiveFilters={hasActiveFilters}
          />
        </div>

        {queryHint ? (
          <div className="mt-4 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-[0_8px_20px_rgba(245,158,11,0.08)]">
            {queryHint}
          </div>
        ) : null}

        <BookingWorkspaceShell>
          <div className="space-y-3">
            {loading && !bookings.length ? (
              <>
                <BookingSkeleton />
                <BookingSkeleton />
              </>
            ) : null}

            {error ? (
              <div className="rounded-[24px] border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => setReloadIndex((value) => value + 1)}
                    className="inline-flex items-center gap-2 self-start rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    <Search size={16} />
                    Tải lại
                  </button>
                </div>
              </div>
            ) : null}

            {!loading && !error && filteredBookings.length ? (
              filteredBookings.map((booking) => (
                <BookingCard
                  key={booking?._id || booking?.id || booking?.booking_code}
                  booking={booking}
                  selected={String(selectedBooking?._id || selectedBooking?.id || "") === String(booking?._id || booking?.id || "")}
                  onSelect={openBooking}
                  onPay={handlePayDeposit}
                  paymentBusy={paymentBusyId === String(booking?._id || booking?.id || "")}
                />
              ))
            ) : null}

            {!loading && !error && !filteredBookings.length && bookings.length ? (
              <EmptyState title="Không tìm thấy đặt phòng phù hợp" description="Thử đổi từ khóa, trạng thái hoặc sắp xếp khác." />
            ) : null}

            {!loading && !error && !bookings.length ? (
              <EmptyState title="Bạn chưa có đặt phòng nào" description="Chọn phòng phù hợp và đặt chuyến lưu trú đầu tiên của bạn." />
            ) : null}
          </div>
        </BookingWorkspaceShell>
      </section>

      <MobileDetailSheet open={Boolean(selectedBooking)} onClose={closeBooking}>
        {selectedBooking ? (
          <BookingDetailPanel
            booking={selectedBooking}
            detail={bookingDetail}
            paymentDetail={paymentDetail}
            loading={drawerLoading}
            error={drawerError}
            paymentBusy={paymentBusyId === String(selectedBooking?._id || selectedBooking?.id || "")}
            paymentError={paymentError}
            onClose={closeBooking}
            onPay={handlePayDeposit}
            onRetry={() => setDetailReloadIndex((value) => value + 1)}
            onRequestCancel={requestCancelBooking}
          />
        ) : null}
      </MobileDetailSheet>
      <CancelBookingConfirmModal
        open={Boolean(cancelTarget)}
        booking={cancelTarget}
        reason={cancelReason}
        loading={cancelSubmitting}
        error={cancelError}
        onCancel={closeCancelDialog}
        onConfirm={confirmCancelBooking}
        onReasonChange={setCancelReason}
      />
    </CustomerShell>
  );
}
