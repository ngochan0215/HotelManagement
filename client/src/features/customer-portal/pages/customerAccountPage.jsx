import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Mail,
  MessageCircle,
} from "lucide-react";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import SharedAuthForm from "../components/sharedAuthForm.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { sendVerificationEmail } from "../../auth/api/authApi.js";
import { StatusBadge } from "../components/sitePrimitives.jsx";

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
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return "--";
  return new Intl.NumberFormat("vi-VN").format(amount);
}

function normalizeStatus(status) {
  return String(status || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function getStatusMeta(status) {
  const normalized = normalizeStatus(status);
  if (["confirmed", "approved", "paid"].includes(normalized)) {
    return { label: "Đã xác nhận", tone: "success" };
  }
  if (["pending", "waiting", "processing"].includes(normalized)) {
    return { label: "Đang chờ", tone: "warning" };
  }
  if (["checked_in", "in_house"].includes(normalized)) {
    return { label: "Đang lưu trú", tone: "info" };
  }
  if (["checked_out", "completed", "done"].includes(normalized)) {
    return { label: "Hoàn tất", tone: "success" };
  }
  if (["cancelled", "canceled", "rejected", "failed"].includes(normalized)) {
    return { label: "Đã hủy", tone: "info" };
  }
  return { label: status || "Chờ xử lý", tone: "info" };
}

function getBookingTitle(booking) {
  const roomNumber = booking?.rooms?.[0]?.room_info?.room_number || booking?.room_info?.room_number || booking?.room_number;
  const roomName =
    booking?.room_info?.category_name ||
    booking?.rooms?.[0]?.room_info?.category_name ||
    booking?.room_name ||
    booking?.room_type ||
    booking?.category_name;

  if (roomNumber) return `Phòng ${roomNumber}`;
  if (roomName) return roomName;
  return "Đơn đặt phòng";
}

function getBookingRoomLabel(booking) {
  const bookingCode = booking?.booking_code || booking?._id || booking?.id || "--";
  const roomNumber = booking?.rooms?.[0]?.room_info?.room_number || booking?.room_info?.room_number || booking?.room_number;
  const roomName =
    booking?.room_info?.category_name ||
    booking?.rooms?.[0]?.room_info?.category_name ||
    booking?.room_name ||
    booking?.room_type ||
    booking?.category_name;

  if (roomNumber && roomName) return `Mã đơn ${bookingCode} · Phòng ${roomNumber} · ${roomName}`;
  if (roomNumber) return `Mã đơn ${bookingCode} · Phòng ${roomNumber}`;
  if (roomName) return `Mã đơn ${bookingCode} · ${roomName}`;
  return `Mã đơn ${bookingCode}`;
}

function buildBookingLookupUrl(booking, email) {
  const params = new URLSearchParams();
  const lookupCode = booking?._id || booking?.id || booking?.booking_code;
  if (lookupCode) params.set("bookingCode", lookupCode);
  if (email) params.set("email", email);
  return `/hotel/bookings${params.toString() ? `?${params.toString()}` : ""}`;
}

function getBookingSortValue(booking) {
  const raw =
    booking?.createdAt ||
    booking?.created_at ||
    booking?.updatedAt ||
    booking?.updated_at ||
    booking?.expected_checkin ||
    booking?.checkin ||
    booking?.date;
  const timestamp = new Date(raw || 0).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildVerifyEmailUrl(user) {
  const params = new URLSearchParams();
  const userId = user?._id || user?.userId || user?.id;
  const email = user?.email;
  if (userId) params.set("userId", userId);
  if (email) params.set("email", email);
  const query = params.toString();
  return `/verify-email${query ? `?${query}` : ""}`;
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function SearchStartBlock({ onSubmit, searchForm, setSearchForm, searchError, loading, todayInputValue }) {
  return (
    <form onSubmit={onSubmit} className="rounded-[32px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-stone-950">Tìm phòng cho chuyến đi</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Ngày nhận phòng
          <input
            required
            type="date"
            min={todayInputValue}
            value={searchForm.checkin}
            onChange={(e) => setSearchForm((prev) => ({ ...prev, checkin: e.target.value }))}
            className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Ngày trả phòng
          <input
            required
            type="date"
            value={searchForm.checkout}
            onChange={(e) => setSearchForm((prev) => ({ ...prev, checkout: e.target.value }))}
            className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Người lớn
          <input
            required
            type="number"
            min="1"
            value={searchForm.adults}
            onChange={(e) => setSearchForm((prev) => ({ ...prev, adults: e.target.value }))}
            className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
          />
        </label>
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Trẻ em
          <input
            required
            type="number"
            min="0"
            value={searchForm.children}
            onChange={(e) => setSearchForm((prev) => ({ ...prev, children: e.target.value }))}
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
          Tìm phòng
          <ArrowRight size={16} />
        </button>
      </div>

      {searchError ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{searchError}</p>
      ) : null}
    </form>
  );
}

function LoadingCard() {
  return (
    <div className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
      <div className="h-4 animate-pulse bg-stone-100" />
      <div className="p-5 md:p-6">
        <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
        <div className="mt-4 h-7 w-2/3 animate-pulse rounded bg-stone-100" />
        <div className="mt-3 h-4 w-full animate-pulse rounded bg-stone-100" />
        <div className="mt-2 h-4 w-4/5 animate-pulse rounded bg-stone-100" />
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="h-20 animate-pulse rounded-2xl bg-stone-100" />
          <div className="h-20 animate-pulse rounded-2xl bg-stone-100" />
        </div>
      </div>
    </div>
  );
}

function VerifyEmailAlert({ user, onSendVerification, loading, error }) {
  const verified = Boolean(user?.emailVerified ?? user?.email_verified ?? user?.is_email_verified ?? user?.verified);
  if (verified) return null;

  return (
    <div className="rounded-[28px] border border-amber-200 bg-amber-50/95 px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Mail size={18} />
          </div>

          <div className="min-w-0">
            <h2 className="text-base font-semibold text-stone-950">
              Xác thực email
            </h2>

            <p className="mt-1 text-sm leading-6 text-stone-700">
              Xác thực email để bảo vệ tài khoản.
            </p>
          </div>
        </div>

        <div className="flex flex-col items-start gap-3 sm:items-end">
          <button
            type="button"
            onClick={onSendVerification}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Đang gửi..." : "Xác thực ngay"}
            <ArrowRight size={16} />
          </button>

          {error && (
            <p className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function SupportCard() {
  return (
    <div className="rounded-[24px] border border-stone-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-stone-950 text-amber-300">
          <MessageCircle size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-stone-950">Cần hỗ trợ?</h3>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Mở chat với đội hỗ trợ nếu bạn cần hỏi về đặt phòng, thanh toán hoặc thay đổi thông tin.
          </p>
        </div>
      </div>
      <div className="mt-4">
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          Mở chat
        </Link>
      </div>
    </div>
  );
}

function BookingDetailPill({ label, value }) {
  return (
    <div className="rounded-2xl bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">{label}</p>
      <p className="mt-2 break-words text-sm font-semibold text-stone-900">{value}</p>
    </div>
  );
}

function BookingCard({ booking, email }) {
  const statusMeta = getStatusMeta(booking?.status);
  const total = formatMoney(booking?.estimated_total || booking?.total_price || booking?.total);

  return (
    <article className="overflow-hidden rounded-[28px] border border-stone-200 bg-stone-50 shadow-sm">
      <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between md:p-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">
              {booking?.booking_code || booking?._id || booking?.id || "Mã đơn"}
            </p>
            <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
          </div>
          <h3 className="mt-3 break-words text-xl font-semibold tracking-tight text-stone-950">{getBookingTitle(booking)}</h3>
          <p className="mt-2 break-words text-sm leading-6 text-stone-600">{getBookingRoomLabel(booking)}</p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <BookingDetailPill label="Nhận phòng" value={formatDate(booking?.expected_checkin || booking?.checkin)} />
            <BookingDetailPill label="Trả phòng" value={formatDate(booking?.expected_checkout || booking?.checkout)} />
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-start gap-3 md:items-end">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Tổng tiền</p>
          <p className="text-2xl font-semibold tracking-tight text-stone-950">{total === "--" ? "--" : `${total} VNĐ`}</p>
          <Link
            to={buildBookingLookupUrl(booking, email)}
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Xem chi tiết
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
    </article>
  );
}

function EmptyBookingState() {
  return (
    <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/80 px-5 py-6 shadow-sm">
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="max-w-2xl">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-950 text-amber-300">
            <CalendarDays size={20} />
          </div>
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-stone-950">Bạn chưa có đặt phòng nào</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">Chọn phòng phù hợp để bắt đầu.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/hotel/bookings"
            className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
          >
            Tra cứu đặt phòng
          </Link>
          <Link
            to="/hotel/rooms"
            className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Xem phòng
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function CustomerAccountPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [reloadIndex, setReloadIndex] = useState(0);
  const [searchForm, setSearchForm] = useState({
    checkin: "",
    checkout: "",
    adults: 2,
    children: 0,
  });
  const [searchError, setSearchError] = useState("");
  const [sendVerificationLoading, setSendVerificationLoading] = useState(false);
  const [sendVerificationError, setSendVerificationError] = useState("");
    const todayInputValue = getTodayInputValue();
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const loadAccountData = async () => {
      setLoading(true);
      setError("");

      const [profileResult, bookingsResult] = await Promise.allSettled([
        customerPortalApi.getMyProfile(),
        customerPortalApi.getMyBookings({ page: 1, limit: 3 }),
      ]);

      if (cancelled) return;

      setProfile(profileResult.status === "fulfilled" ? profileResult.value : null);

      if (bookingsResult.status === "fulfilled") {
        const payload = bookingsResult.value;
        const nextBookings = Array.isArray(payload)
          ? payload
          : payload?.bookings || payload?.data?.bookings || payload?.data || [];
        setBookings(Array.isArray(nextBookings) ? nextBookings : []);
      } else {
        setBookings([]);
      }

      const messages = [];
      if (profileResult.status === "rejected") messages.push(profileResult.reason?.message || "Không thể tải hồ sơ khách hàng.");
      if (bookingsResult.status === "rejected") messages.push(bookingsResult.reason?.message || "Không thể tải danh sách đặt phòng.");
      setError(messages[0] || "");
      setLoading(false);
    };

    loadAccountData();

    return () => {
      cancelled = true;
    };
  }, [user, reloadIndex]);

  const displayEmail = profile?.email || user?.email || "";
  const displayUserId = user?._id || user?.userId || user?.id || "";

  const displayName = useMemo(() => {
    const rawName =
      profile?.full_name ||
      profile?.name ||
      user?.full_name ||
      user?.name ||
      (displayEmail ? displayEmail.split("@")[0] : "");
    const trimmed = String(rawName || "").trim();
    return trimmed || "bạn";
  }, [displayEmail, profile?.full_name, profile?.name, user?.full_name, user?.name]);

  const emailVerified = Boolean(
    profile?.email_verified ??
      profile?.is_email_verified ??
      profile?.verified ??
      user?.email_verified ??
      user?.is_email_verified ??
      user?.verified,
  );

  const sortedBookings = useMemo(() => {
    return [...bookings].sort((a, b) => getBookingSortValue(b) - getBookingSortValue(a));
  }, [bookings]);

  const recentBookings = sortedBookings.slice(0, 3);
  const heroPrimaryLink = "/hotel/book";

  const handleSearchRooms = (event) => {
    event.preventDefault();
    setSearchError("");

    if (!searchForm.checkin || !searchForm.checkout) {
      setSearchError("Vui lòng chọn ngày nhận phòng và ngày trả phòng.");
      return;
    }
    if (searchForm.checkin < todayInputValue) {
      setSearchError("Ngày nhận phòng không được nằm trong quá khứ.");
      return;
    }

    if (new Date(searchForm.checkout) <= new Date(searchForm.checkin)) {
      setSearchError("Ngày trả phòng phải sau ngày nhận phòng.");
      return;
    }

    if (Number(searchForm.adults) < 1) {
      setSearchError("Số người lớn phải từ 1 trở lên.");
      return;
    }

    if (Number(searchForm.children) < 0) {
      setSearchError("Số trẻ em không được nhỏ hơn 0.");
      return;
    }

    const params = new URLSearchParams();
    params.set("checkin", searchForm.checkin);
    params.set("checkout", searchForm.checkout);
    params.set("adults", String(searchForm.adults));
    params.set("children", String(searchForm.children));
    navigate(`/hotel/rooms?${params.toString()}`);
  };

  const handleSendVerification = async () => {
    if (!displayUserId && !displayEmail) {
      setSendVerificationError("Không có thông tin người dùng để gửi email xác thực.");
      return;
    }

    setSendVerificationError("");
    setSendVerificationLoading(true);

    try {
      await sendVerificationEmail({ userId: displayUserId, email: displayEmail });
      navigate(buildVerifyEmailUrl(user));
    } catch (err) {
      setSendVerificationError(err?.message || "Không thể gửi email xác thực.");
    } finally {
      setSendVerificationLoading(false);
    }
  };

  const handleRetry = () => setReloadIndex((value) => value + 1);

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
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {error ? (
          <div className="mb-6 flex items-start justify-between gap-4 rounded-[22px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="leading-6">Không thể tải đầy đủ dữ liệu tài khoản lúc này. Bạn vẫn có thể tiếp tục sử dụng trang.</p>
            <button type="button" onClick={handleRetry} className="shrink-0 font-semibold text-amber-900 underline decoration-amber-300 underline-offset-4">
              Tải lại
            </button>
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[32px] border border-stone-900 bg-stone-950 text-white shadow-[0_28px_70px_rgba(28,25,23,0.2)]">
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.08),transparent_22%)]" />
            <div className="relative flex flex-col gap-5 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div>
                <h1 className="break-words text-3xl font-semibold tracking-tight md:text-4xl">
                  Xin chào, {displayName}
                </h1>
                <p className="mt-3 text-sm leading-6 text-stone-300">
                  Bạn muốn bắt đầu chuyến lưu trú tiếp theo?
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link to={heroPrimaryLink} className="inline-flex items-center gap-2 rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-amber-200">
                    Đặt phòng mới
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {!emailVerified ? (
          <div className="mt-5">
            <VerifyEmailAlert
              user={user}
              onSendVerification={handleSendVerification}
              loading={sendVerificationLoading}
              error={sendVerificationError}
            />
          </div>
        ) : null}

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <SearchStartBlock
            onSubmit={handleSearchRooms}
            searchForm={searchForm}
            setSearchForm={setSearchForm}
            searchError={searchError}
            loading={false}
            todayInputValue={todayInputValue}
          />

          <div className="grid gap-4">
            <div className="min-w-0 rounded-[32px] border border-stone-200 bg-white/92 p-5 shadow-[0_18px_44px_rgba(28,25,23,0.08)] md:p-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-stone-950">Đặt phòng của tôi</h2>
                </div>
                <Link to="/hotel/bookings" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-800 transition hover:text-stone-950">
                  Xem tất cả
                  <ChevronRight size={16} />
                </Link>
              </div>

              <div className="mt-4 space-y-4">
                {loading && !recentBookings.length ? (
                  <>
                    <LoadingCard />
                    <LoadingCard />
                  </>
                ) : error && !recentBookings.length ? (
                  <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-5 py-6 text-sm text-stone-600">
                    Không thể tải danh sách đặt phòng vào lúc này. Vui lòng thử lại sau ít phút.
                  </div>
                ) : recentBookings.length ? (
                  recentBookings.map((booking) => (
                    <BookingCard key={booking?._id || booking?.id || booking?.booking_code} booking={booking} email={displayEmail} />
                  ))
                ) : (
                  <EmptyBookingState />
                )}
              </div>
            </div>
            <SupportCard />
          </div>
        </div>
      </section>
    </CustomerShell>
  );
}
