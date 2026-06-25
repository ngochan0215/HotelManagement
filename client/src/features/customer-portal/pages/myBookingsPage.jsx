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
import SharedAuthForm from "../components/sharedAuthForm.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import "./myBookingsPage.css";

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
  return "Chờ xử lý";
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

function getBookingTitle(booking) {
  const rooms = getRoomEntries(booking);
  if (rooms.length) return getRoomTitle(rooms[0]);
  return "Đơn đặt phòng";
}

function getRoomSummary(booking) {
  const rooms = getRoomEntries(booking);
  if (!rooms.length) return "Chưa có thông tin phòng.";
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
  if (normalized === "pending") return "Chờ xử lý";
  return normalizeStatusLabel(normalized);
}

function getBookingStatusMeta(booking) {
  const status = normalizeStatus(booking?.status);
  const checkin = booking?.expected_checkin ? new Date(booking.expected_checkin) : null;
  const checkout = booking?.expected_checkout ? new Date(booking.expected_checkout) : null;
  const now = new Date();

  if (status === "pending") return { label: "Chờ thanh toán cọc", tone: "warning", group: "pending" };
  if (status === "confirmed") {
    if (checkin && checkin > now) return { label: "Đã xác nhận", tone: "info", group: "upcoming" };
    if (checkout && checkout >= now) return { label: "Đã xác nhận", tone: "success", group: "active" };
    return { label: "Đã xác nhận", tone: "success", group: "upcoming" };
  }
  if (["in_progress", "checked_in"].includes(status)) return { label: "Đang lưu trú", tone: "warning", group: "active" };
  if (["checked_out"].includes(status)) return { label: "Đã trả phòng", tone: "success", group: "completed" };
  if (["completed"].includes(status)) return { label: "Hoàn tất", tone: "success", group: "completed" };
  if (["cancelled", "canceled", "expired"].includes(status)) return { label: "Đã hủy", tone: "info", group: "cancelled" };
  if (status === "failed") return { label: "Thanh toán thất bại", tone: "info", group: "cancelled" };
  return { label: normalizeStatusLabel(status), tone: "info", group: "all" };
}

function getPaymentStatusMeta(paymentDetail, booking) {
  const source = paymentDetail?.data || paymentDetail || {};
  const transaction = source?.transaction || source;
  const receipt = source?.receipt || null;
  const rawStatus = normalizeStatus(transaction?.status || receipt?.status || booking?.payment_status || booking?.receipt_status);

  if (rawStatus === "paid" || rawStatus === "success" || rawStatus === "completed") {
    return { label: "Đã thanh toán", tone: "success" };
  }
  if (rawStatus === "half_paid" || rawStatus === "half-paid") return { label: "Đã thanh toán cọc", tone: "warning" };
  if (rawStatus === "pending" || rawStatus === "unpaid") return { label: "Chờ thanh toán", tone: "warning" };
  if (rawStatus === "failed") return { label: "Thanh toán thất bại", tone: "info" };
  if (rawStatus === "cancelled" || rawStatus === "canceled") return { label: "Đã hủy", tone: "info" };
  if (rawStatus === "refunded") return { label: "Đã hoàn tiền", tone: "info" };
  return { label: normalizeStatusLabel(rawStatus), tone: "info" };
}

function getPaymentOverviewText(booking, paymentDetail) {
  const status = normalizeStatus(booking?.status);
  const paymentStatus = normalizeStatus(paymentDetail?.data?.transaction?.status || paymentDetail?.data?.receipt?.status || booking?.payment_status || booking?.receipt_status);
  const wasPaid = ["paid", "success", "completed", "half_paid", "half-paid"].includes(paymentStatus);

  if (status === "pending") return "Đang chờ thanh toán cọc";
  if (status === "cancelled" || status === "canceled" || status === "expired") {
    if (wasPaid) return "Đơn đã hủy";
    return "Đơn đã hủy. Thanh toán cọc chưa được ghi nhận.";
  }
  if (status === "confirmed") {
    if (wasPaid) return "Đã xác nhận thanh toán cọc";
    return "Đã xác nhận đặt phòng";
  }
  if (status === "in_progress" || status === "checked_in") return "Thanh toán cọc đã ghi nhận";
  if (status === "checked_out") return "Đã trả phòng";
  if (status === "completed") return "Thanh toán đã hoàn tất";
  if (status === "failed") return "Thanh toán thất bại";
  return "Thanh toán cọc chưa hoàn tất";
}

function getAmountSummary(booking) {
  const total = Number(booking?.total_fee || booking?.estimated_total || booking?.total || 0);
  const deposit = Number(booking?.deposit || 0);
  const remaining = Math.max(total - deposit, 0);
  return { total, deposit, remaining };
}

function getPrimaryAction(booking) {
  const status = normalizeStatus(booking?.status);
  if (status === "pending") return { label: "Thanh toán cọc", type: "pay" };
  if (status === "cancelled" || status === "expired") return { label: "Đặt phòng mới", type: "rooms" };
  return { label: "Xem chi tiết", type: "detail" };
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

function BookingMetricCard({ label, value, accent = false, dim = false }) {
  return (
    <div className={`booking-ticket__metric ${accent ? "booking-ticket__metric--accent" : ""} ${dim ? "opacity-80" : ""}`}>
      <p className="booking-ticket__metric-label">{label}</p>
      <p className="booking-ticket__metric-value">{value}</p>
    </div>
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

function BookingCard({ booking, selected, onSelect, onPay, paymentBusy }) {
  const statusMeta = getBookingStatusMeta(booking);
  const action = getPrimaryAction(booking);
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

function DetailRow({ label, value, emphasize = false }) {
  return (
    <div className="booking-detail-row">
      <p className="booking-detail-row__label">{label}</p>
      <p className={`booking-detail-row__value break-words ${emphasize ? "text-base" : ""}`}>{value}</p>
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
}) {
  const resolvedBooking = detail?.booking || booking;
  const rooms = Array.isArray(detail?.rooms) && detail.rooms.length ? detail.rooms : booking?.rooms || [];
  const statusMeta = getBookingStatusMeta(resolvedBooking);
  const paymentMeta = getPaymentStatusMeta(paymentDetail, resolvedBooking);
  const paymentOverviewText = getPaymentOverviewText(resolvedBooking, paymentDetail);
  const { total, deposit, remaining } = getAmountSummary(resolvedBooking);
  const nights = getNightCount(resolvedBooking?.expected_checkin, resolvedBooking?.expected_checkout);
  const adults = Number(resolvedBooking?.adults || 0);
  const children = Number(resolvedBooking?.children || 0);
  const canPay = normalizeStatus(resolvedBooking?.status) === "pending";

  const handleCopy = async () => {
    const code = String(getBookingCode(resolvedBooking));
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
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Chi tiết đặt phòng</p>
          <h3 className="mt-2 break-words text-2xl font-semibold tracking-tight text-stone-950">
            {getBookingTitle(resolvedBooking)}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <BookingStatusBadge tone={statusMeta.tone}>{statusMeta.label}</BookingStatusBadge>
            <BookingStatusBadge tone={paymentMeta.tone}>{paymentMeta.label}</BookingStatusBadge>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-600 transition hover:border-stone-300 hover:text-stone-950"
          aria-label="Đóng"
        >
          <X size={18} />
        </button>
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

            <section className="booking-detail-card__section rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_10px_24px_rgba(28,25,23,0.06)]">
              <BookingSectionTitle
                subtitle="Lưu trú"
                title="Thông tin lưu trú"
                right={<BookingStatusBadge tone={statusMeta.tone}>{statusMeta.label}</BookingStatusBadge>}
              />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <DetailRow label="Nhận phòng" value={formatDate(resolvedBooking?.expected_checkin)} />
                <DetailRow label="Trả phòng" value={formatDate(resolvedBooking?.expected_checkout)} />
                <DetailRow label="Số đêm" value={nights > 0 ? `${nights} đêm` : "--"} />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <DetailRow label="Mã booking" value={getBookingCode(resolvedBooking)} emphasize />
                <DetailRow label="Khách" value={`${adults} người lớn · ${children} trẻ em`} />
              </div>
            </section>

            <section className="booking-detail-card__section rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_10px_24px_rgba(28,25,23,0.06)]">
              <BookingSectionTitle
                subtitle="Thanh toán"
                title="Tổng quan thanh toán"
                right={<BookingStatusBadge tone={paymentMeta.tone}>{paymentMeta.label}</BookingStatusBadge>}
              />
              <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold text-stone-800">
                {paymentOverviewText}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <BookingMetricCard label="Tổng tiền" value={total > 0 ? `${formatMoney(total)} VNĐ` : "--"} dim={statusMeta.group === "cancelled" || statusMeta.group === "completed"} />
                <BookingMetricCard label="Tiền cọc" value={deposit > 0 ? `${formatMoney(deposit)} VNĐ` : "Miễn cọc"} accent={canPay} dim={statusMeta.group === "cancelled" || statusMeta.group === "completed"} />
                <BookingMetricCard label="Còn lại" value={remaining > 0 ? `${formatMoney(remaining)} VNĐ` : "Đã đủ"} dim={statusMeta.group === "cancelled" || statusMeta.group === "completed"} />
              </div>
              {canPay ? (
                <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  <p className="font-semibold text-stone-950">Đơn đang chờ thanh toán cọc.</p>
                  <p className="mt-1 text-stone-700">Vui lòng hoàn tất thanh toán để giữ đặt phòng.</p>
                </div>
              ) : null}
              {statusMeta.group === "cancelled" ? (
                <div className="mt-3 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm leading-6 text-stone-700">
                  Đơn này không còn hiệu lực.
                </div>
              ) : null}
            </section>

            <section className="booking-detail-card__section rounded-[24px] border border-stone-200 bg-white p-4 shadow-[0_10px_24px_rgba(28,25,23,0.06)]">
              <BookingSectionTitle subtitle="Phòng" title="Phòng trong booking" />
              <div className="mt-3 space-y-3">
                {rooms.length ? (
                  rooms.map((room, index) => (
                    <div key={room?.detail_id || room?._id || index} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <p className="text-sm font-semibold text-stone-950">{getRoomTitle(room)}</p>
                      <p className="mt-1 text-sm text-stone-600">
                        {formatDate(room?.expected_checkin)} → {formatDate(room?.expected_checkout)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <BookingStatusBadge tone={room?.status === "checked_out" ? "success" : room?.status === "cancelled" ? "info" : "warning"}>
                          {getRoomStatusLabel(room?.status)}
                        </BookingStatusBadge>
                        {room?.note ? <span className="text-sm text-stone-500">{room.note}</span> : null}
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

          <Link
            to="/hotel/rooms"
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Xem phòng
          </Link>

          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
          >
            <Copy size={16} />
            Copy mã
          </button>
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
  const [reloadIndex, setReloadIndex] = useState(0);
  const [detailReloadIndex, setDetailReloadIndex] = useState(0);
  const [queryHint, setQueryHint] = useState("");
  const queryAppliedRef = useRef(false);

  useEffect(() => {
    setSearchTerm(initialBookingCode);
    setQueryHint(initialBookingCode ? "Đang tìm đơn theo mã đã nhập sẵn trong URL." : "");
  }, [initialBookingCode]);

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

    const loadDetail = async () => {
      setDrawerLoading(true);
      setDrawerError("");
      try {
        const [detailPayload, paymentPayload] = await Promise.allSettled([
          customerPortalApi.getMyBookingDetail(bookingId),
          paymentApi.getPaymentTransactionDetail(bookingId),
        ]);

        if (cancelled) return;

        if (detailPayload.status === "fulfilled") {
          setBookingDetail(detailPayload.value || null);
        } else {
          setBookingDetail({ booking: selectedBooking, rooms: selectedBooking?.rooms || [] });
          setDrawerError(detailPayload.reason?.message || "Không thể tải chi tiết đặt phòng.");
        }

        if (paymentPayload.status === "fulfilled") {
          setPaymentDetail(paymentPayload.value || null);
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
        <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
          <SharedAuthForm embedded />
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
          />
        ) : null}
      </MobileDetailSheet>
    </CustomerShell>
  );
}
