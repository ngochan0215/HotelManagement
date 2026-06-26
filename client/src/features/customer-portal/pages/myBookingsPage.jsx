import { useEffect, useState } from "react";
import { ArrowRight, Search, X, CalendarDays, BedDouble, CreditCard, Users, AlertCircle, Receipt, Wrench } from "lucide-react";
import { Link } from "react-router-dom";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import { EmptyState, StatusBadge } from "../components/sitePrimitives.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";

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

function formatMoney(value) {
  const amount = Number(value ?? 0);
  if (Number.isNaN(amount)) return "--";
  return `${amount.toLocaleString("vi-VN")} VNĐ`;
}

const BOOKING_STATUS_LABELS = {
  pending: { label: "Chờ xử lý", tone: "warning" },
  waiting_confirm: { label: "Chờ xác nhận", tone: "warning" },
  confirmed: { label: "Đã xác nhận", tone: "success" },
  in_progress: { label: "Đang xử lý", tone: "info" },
  completed: { label: "Hoàn thành", tone: "success" },
  cancelled: { label: "Đã hủy", tone: "info" },
  expired: { label: "Hết hạn", tone: "info" },
};

const ROOM_STATUS_LABELS = {
  reserved: { label: "Đã đặt trước", tone: "warning" },
  confirmed: { label: "Đã xác nhận", tone: "success" },
  checked_in: { label: "Đã nhận phòng", tone: "success" },
  checked_out: { label: "Đã trả phòng", tone: "info" },
  cancelled: { label: "Đã hủy", tone: "info" },
  pending: { label: "Chờ xử lý", tone: "info" },
};

function getBookingStatus(status) {
  return BOOKING_STATUS_LABELS[status] || { label: "Chờ xử lý", tone: "info" };
}

function getRoomStatus(status) {
  return ROOM_STATUS_LABELS[status] || { label: "Chờ xử lý", tone: "info" };
}

// Màu panel bên phải theo trạng thái booking
const STATUS_PANEL_THEME = {
  pending:         { from: "#d97706", to: "#fbbf24" }, // amber
  waiting_confirm: { from: "#d97706", to: "#fbbf24" }, // amber
  confirmed:       { from: "#059669", to: "#34d399" }, // emerald
  in_progress:     { from: "#2563eb", to: "#60a5fa" }, // blue
  completed:       { from: "#0d9488", to: "#2dd4bf" }, // teal
  cancelled:       { from: "#57534e", to: "#a8a29e" }, // stone
  expired:         { from: "#57534e", to: "#a8a29e" }, // stone
};

function getStatusPanelTheme(status) {
  return STATUS_PANEL_THEME[status] || STATUS_PANEL_THEME.pending;
}

function StatCard({ label, value, sub }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-stone-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-stone-950">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-stone-400">{sub}</p>}
    </div>
  );
}

export default function MyBookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedRooms, setSelectedRooms] = useState([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [serviceUsages, setServiceUsages] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const fetchBookings = async () => {
      setLoading(true);
      setError("");
      try {
        const data = await customerPortalApi.getMyBookings({ page, limit });
        if (cancelled) return;
        setBookings(data?.bookings || []);
        setTotal(data?.total || 0);

        // console.log("Fetched bookings:", data?.bookings || [], "Total:", data?.total || 0);
      } catch (err) {
        if (cancelled) return;
        setError(err?.message || "Không thể tải lịch sử đặt phòng.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchBookings();
    return () => { cancelled = true; };
  }, [user, page, limit]);

  useEffect(() => {
      if (!selectedBookingId) {
        setSelectedBooking(null);
        setSelectedRooms([]);
        setServiceUsages([]);
        setReceipts([]);
        setIncidents([]);
        setDetailError("");
        setDetailLoading(false);
        return;
      }
      let cancelled = false;
      const fetchBookingDetails = async () => {
        setDetailLoading(true);
        setDetailError("");
        try {
          const data = await customerPortalApi.getMyBookingDetail(selectedBookingId);
          console.log("Fetched booking details:", data);
          if (cancelled) return;
          const booking = data?.booking || data;
          const rooms = data?.rooms || booking?.rooms || [];
          setSelectedBooking(booking);
          setSelectedRooms(rooms);
          setServiceUsages(data?.serviceUsages || []);
          setReceipts(data?.receipts || []);
          setIncidents(data?.incidents || []);
        } catch (err) {
          if (cancelled) return;
          setDetailError(err?.message || "Không thể tải chi tiết đặt phòng.");
        } finally {
          if (!cancelled) setDetailLoading(false);
        }
      };
      fetchBookingDetails();
      return () => { cancelled = true; };
    }, [selectedBookingId]);
  const hasBookings = bookings.length > 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-8">

        {/* ── Page header ── */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Tài khoản của bạn</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Lịch sử đặt phòng</h1>
            <p className="mt-1.5 text-sm text-stone-500">Theo dõi trạng thái và chi tiết các đơn đặt phòng của bạn.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700">
              {total} đơn
            </span>
            <Link
              to="/hotel/bookings/lookup"
              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              <Search size={14} />
              Tra cứu đặt phòng
            </Link>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={16} className="shrink-0" />
            {error}
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center rounded-3xl border border-stone-200 bg-white py-20 shadow-sm">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900" />
            <p className="mt-4 text-sm font-medium text-stone-500">Đang tải lịch sử đặt phòng...</p>
          </div>
        )}

        {/* ── Booking list ── */}
        {hasBookings && (
          <div className="space-y-4">
            {bookings.map((booking, bookingIndex) => (
              <article
                key={booking._id || booking.booking_code || bookingIndex}
                className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="grid lg:grid-cols-[1fr_auto]">
                  {/* Left: main info */}
                  <div className="p-6">
                    {/* Top row */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.22em] text-stone-400">Mã đặt phòng</p>
                        <h3 className="mt-1 text-lg font-semibold text-stone-950 tracking-tight">
                          {booking.booking_code || booking._id}
                        </h3>
                      </div>
                      <StatusBadge tone={getBookingStatus(booking.status).tone}>
                        {getBookingStatus(booking.status).label}
                      </StatusBadge>
                    </div>

                    {/* Stats row */}
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <StatCard label="Nhận phòng" value={formatDate(booking.expected_checkin)} />
                      <StatCard label="Trả phòng" value={formatDate(booking.expected_checkout)} />
                      <StatCard label="Tổng phí" value={`${Number(booking.total_fee || 0).toLocaleString()} VNĐ`} />
                      <StatCard label="Số tiền cọc" value={`${Number(booking.deposit || 0).toLocaleString()} VNĐ`} />
                    </div>

                    {/* Footer row */}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap gap-3">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                          <BedDouble size={12} />
                          {booking.rooms?.length || 0} phòng
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                          <Users size={12} />
                          {booking.adults || 0} người lớn
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-600">
                          <Users size={12} />
                          {booking.children || 0} trẻ em
                        </span>
                        {(booking.discount_snapshot?.code || booking.discount_code) && (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            {booking.discount_snapshot?.code || booking.discount_code}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedBookingId(booking._id)}
                        className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-50 hover:border-stone-300"
                      >
                        Xem chi tiết
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Right: room cards — status-colored panel */}
                  {booking.rooms?.length > 0 && (() => {
                    const theme = getStatusPanelTheme(booking.status);
                    return (
                      <div
                        className="relative min-w-[220px] overflow-hidden border-t border-stone-200 p-6 lg:border-t-0 lg:border-l lg:border-l-white/20"
                        style={{ background: `linear-gradient(135deg, ${theme.from}, ${theme.to})` }}
                      >
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.18),transparent_55%)]" />
                        <div className="relative">
                          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/70">Chi tiết phòng</p>
                          <div className="space-y-2">
                            {booking.rooms.map((roomDetail, index) => {
                              return (
                                <div
                                key={`${roomDetail._id || roomDetail.room_id || index}-${index}`}
                                className="rounded-2xl border border-white/15 bg-white/20 p-3 backdrop-blur-sm"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="text-sm font-semibold text-white">
                                      Phòng {roomDetail.room_info?.room_number || "-"}
                                    </p>
                                    {roomDetail.room_info?.category?.name && (
                                      <p className="mt-0.5 text-xs text-white/70">{roomDetail.room_info.category.name}</p>
                                    )}
                                  </div>
                                  <StatusBadge tone={getRoomStatus(roomDetail.status).tone}>
                                    {getRoomStatus(roomDetail.status).label}
                                  </StatusBadge>
                                </div>
                                <p className="mt-2 text-xs font-semibold text-white">
                                  {Number(roomDetail.base_fee || 0).toLocaleString()} VNĐ
                                </p>
                              </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </article>
            ))}

            {/* Pagination */}
            {pageCount > 1 && (
              <div className="flex items-center justify-between rounded-2xl border border-stone-200 bg-white px-5 py-3">
                <p className="text-sm text-stone-500">Trang {page} / {pageCount}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowRight className="rotate-180" size={14} />
                    Trước
                  </button>
                  <button
                    type="button"
                    disabled={page >= pageCount}
                    onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                    className="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Tiếp
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!loading && !hasBookings && !error && (
          <EmptyState
            title={user ? "Bạn chưa có đơn đặt phòng nào" : "Bạn cần đăng nhập để xem lịch sử"}
            description={
              user
                ? "Đặt phòng đầu tiên ngay để xem lại trong lịch sử."
                : "Vui lòng đăng nhập để truy cập trang lịch sử đặt phòng của bạn."
            }
          />
        )}
      </section>

      {/* Detail modal */}
      {selectedBookingId && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="mx-auto my-6 w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/10">

            {/* Modal header */}
            {(() => {
              const modalTheme = getStatusPanelTheme(selectedBooking?.status);
              return (
            <div
              className="relative flex items-start justify-between gap-4 overflow-hidden px-7 py-6"
              style={{ background: `linear-gradient(135deg, ${modalTheme.from}, ${modalTheme.to})` }}
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(255,255,255,0.15),transparent_55%)]" />
              <div className="relative">
                <p className="text-xs uppercase tracking-[0.26em] text-white/70">Chi tiết đặt phòng</p>
                <h3 className="mt-1.5 text-xl font-semibold text-white">
                  {selectedBooking?.booking_code || selectedBookingId}
                </h3>
                <p className="mt-0.5 text-xs text-white/50">
                  #{selectedBooking?._id?.slice(-8).toUpperCase() || "N/A"}
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <StatusBadge tone={getBookingStatus(selectedBooking?.status).tone}>
                    {getBookingStatus(selectedBooking?.status).label}
                  </StatusBadge>
                  <span className="text-xs text-white/60">
                    {formatDate(selectedBooking?.expected_checkin)} → {formatDate(selectedBooking?.expected_checkout)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedBookingId(null)}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
              >
                <X size={17} />
              </button>
            </div>
              );
            })()}

            {/* Modal body */}
            <div className="p-6 md:p-8">
              {detailError ? (
                <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                  <AlertCircle size={16} className="shrink-0" />
                  {detailError}
                </div>
              ) : detailLoading ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="h-10 w-10 animate-spin rounded-full border-2 border-stone-200 border-t-stone-900" />
                  <p className="mt-4 text-sm font-medium text-stone-500">Đang tải chi tiết...</p>
                </div>
              ) : (
                <div className="space-y-6">

                  {/* Quick stats */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <StatCard label="Nhận phòng" value={formatDate(selectedBooking?.expected_checkin)} />
                    <StatCard label="Trả phòng" value={formatDate(selectedBooking?.expected_checkout)} />
                    <StatCard
                      label="Số đêm"
                      value={
                        selectedBooking
                          ? Math.max(1, Math.round((new Date(selectedBooking.expected_checkout) - new Date(selectedBooking.expected_checkin)) / 86400000))
                          : 0
                      }
                    />
                    <StatCard label="Số phòng" value={`${selectedRooms.length} phòng`} />
                  </div>

                  {/* Two-column layout */}
                  <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

                    {/* ── Left column ── */}
                    <div className="space-y-5">

                      {/* Rooms */}
                      <div className="rounded-3xl border border-stone-200 bg-white p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <BedDouble size={15} className="text-stone-500" />
                          <h4 className="text-sm font-semibold text-stone-900">Phòng đã đặt</h4>
                        </div>
                        <div className="space-y-3">
                          {selectedRooms.length ? (
                            selectedRooms.map((room, index) => {
                              return (
                                <div key={room._id || room.room_id || index} className="rounded-2xl border border-stone-100 bg-stone-50 p-4">
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <p className="font-semibold text-stone-950">Phòng {room.room_number || "-"}</p>
                                    {room.category?.name && (
                                      <p className="text-xs text-stone-500">{room.category.name}</p>
                                    )}
                                  </div>
                                  <StatusBadge tone={getRoomStatus(room.status).tone}>
                                    {getRoomStatus(room.status).label}
                                  </StatusBadge>
                                </div>
                                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                                  <div>
                                    <p className="text-xs text-stone-400">Giá cơ bản</p>
                                    <p className="mt-0.5 font-semibold text-stone-900">{formatMoney(room.base_fee)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-stone-400">Phụ thu</p>
                                    <p className="mt-0.5 font-semibold text-stone-900">{formatMoney(room.additional_fee)}</p>
                                  </div>
                                </div>
                              </div>
                              )
                        })
                          ) : (
                            <p className="rounded-2xl bg-stone-50 p-4 text-sm text-stone-500">Không có chi tiết phòng trong đơn này.</p>
                          )}
                        </div>
                      </div>

                      {/* Customer info */}
                      <div className="rounded-3xl border border-amber-100 bg-amber-50 p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Users size={15} className="text-amber-700" />
                          <h4 className="text-sm font-semibold text-stone-900">Thông tin khách hàng</h4>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                          <div>
                            <p className="text-xs text-stone-500">Người lớn</p>
                            <p className="mt-1 font-semibold text-stone-900">{selectedBooking?.adults || 1} người</p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-500">Trẻ em</p>
                            <p className="mt-1 font-semibold text-stone-900">{selectedBooking?.children || 0} em</p>
                          </div>
                        </div>
                      </div>

                      {/* Finance */}
                      <div className="rounded-3xl border border-emerald-100 bg-emerald-50 p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <CreditCard size={15} className="text-emerald-700" />
                          <h4 className="text-sm font-semibold text-stone-900">Tài chính</h4>
                        </div>
                        <div className="space-y-2.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-stone-600">Tổng tiền phòng</span>
                            <span className="font-semibold text-stone-950">{formatMoney(selectedBooking?.total_fee)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-600">Phí dịch vụ</span>
                            <span className="font-semibold text-amber-700">
                              {formatMoney(serviceUsages.reduce((sum, item) => sum + Number(item.total_fee || 0), 0))}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-600">Tiền cọc</span>
                            <span className="font-semibold text-indigo-700">{formatMoney(selectedBooking?.deposit)}</span>
                          </div>
                          {(selectedBooking?.discount_id || selectedBooking?.discount_code) && (
                            <div className="flex justify-between">
                              <span className="text-stone-600">Mã giảm giá</span>
                              <span className="font-semibold text-emerald-700">
                                {selectedBooking?.discount_id?.code || selectedBooking?.discount_code}
                              </span>
                            </div>
                          )}
                          <div className="border-t border-emerald-200 pt-2.5 flex justify-between font-semibold">
                            <span className="text-stone-900">Còn lại</span>
                            <span className="text-stone-950">
                              {formatMoney(Math.max(0, (selectedBooking?.total_fee || 0) - (selectedBooking?.deposit || 0)))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ── Right sidebar ── */}
                    <aside className="space-y-5">

                      {/* Quick overview */}
                      <div className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                        <h4 className="mb-4 text-sm font-semibold text-stone-900">Tổng quan nhanh</h4>
                        <div className="space-y-2.5 text-sm">
                          <div className="flex justify-between">
                            <span className="text-stone-500">Giá dự kiến</span>
                            <span className="font-semibold text-stone-950">{formatMoney(selectedBooking?.estimated_total)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-500">Phòng</span>
                            <span className="font-semibold text-stone-950">{selectedRooms.length} phòng</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-500">Khách</span>
                            <span className="font-semibold text-stone-950">{selectedBooking?.adults || 1} người</span>
                          </div>
                        </div>
                      </div>

                      {/* Services */}
                      <div className="rounded-3xl border border-orange-100 bg-orange-50 p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Wrench size={14} className="text-orange-600" />
                          <h4 className="text-sm font-semibold text-stone-900">Dịch vụ đã sử dụng</h4>
                        </div>
                        {serviceUsages.length ? (
                          <div className="space-y-2">
                            {serviceUsages.map((item, idx) => (
                              <div key={item._id || idx} className="rounded-2xl border border-orange-100 bg-white p-3 text-sm">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="font-semibold text-stone-950">{item.name || item.service_name || `Dịch vụ ${idx + 1}`}</p>
                                  <span className="text-stone-500">{formatMoney(item.total_fee)}</span>
                                </div>
                                {item.status && <p className="mt-1 text-xs text-stone-400">Trạng thái: {item.status}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-orange-600">Chưa có dịch vụ được ghi nhận.</p>
                        )}
                      </div>

                      {/* Receipts */}
                      <div className="rounded-3xl border border-teal-100 bg-teal-50 p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <Receipt size={14} className="text-teal-700" />
                          <h4 className="text-sm font-semibold text-stone-900">Hóa đơn</h4>
                        </div>
                        {receipts.length ? (
                          <div className="space-y-2">
                            {receipts.map((invoice, idx) => (
                              <div key={invoice._id || idx} className="rounded-2xl border border-teal-100 bg-white p-3 text-sm space-y-1.5">
                                <div className="flex justify-between">
                                  <span className="text-stone-500">Mã hóa đơn</span>
                                  <span className="font-semibold text-stone-950">#{invoice._id?.slice(-8).toUpperCase()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-stone-500">Thanh toán</span>
                                  <span className="font-semibold text-stone-950">{invoice.payment || "Không xác định"}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-stone-500">Thành tiền</span>
                                  <span className="font-semibold text-stone-950">{formatMoney(invoice.final_amount)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-teal-600">Chưa có hóa đơn cho đơn này.</p>
                        )}
                      </div>

                      {/* Incidents */}
                      <div className="rounded-3xl border border-rose-100 bg-rose-50 p-5">
                        <div className="mb-4 flex items-center gap-2">
                          <AlertCircle size={14} className="text-rose-600" />
                          <h4 className="text-sm font-semibold text-stone-900">Sự cố & bồi thường</h4>
                        </div>
                        {incidents.length ? (
                          <div className="space-y-2">
                            {incidents.map((inc, idx) => (
                              <div key={inc._id || idx} className="rounded-2xl border border-rose-100 bg-white p-3 text-sm">
                                <p className="font-semibold text-stone-950">{inc.type || "Sự cố"}</p>
                                <p className="mt-0.5 text-xs text-stone-500">{inc.description || "Không có mô tả"}</p>
                                {inc.status && <p className="mt-1.5 text-xs text-rose-600">Trạng thái: {inc.status}</p>}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-rose-600">Không có sự cố hoặc yêu cầu bồi thường nào.</p>
                        )}
                      </div>
                    </aside>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </CustomerShell>
  );
}