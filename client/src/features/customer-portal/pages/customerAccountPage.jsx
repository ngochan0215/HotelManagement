import { CalendarCheck, Gift, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import SharedAuthForm from "../components/sharedAuthForm.jsx";
import { SectionHeader, StatusBadge } from "../components/sitePrimitives.jsx";

export default function CustomerAccountPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!user) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-6xl px-4 py-10 md:px-6">
          <SharedAuthForm embedded />
        </section>
      </CustomerShell>
    );
  }

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const [profileData, bookingData] = await Promise.all([
          customerPortalApi.getMyProfile(),
          customerPortalApi.getMyBookings({ page: 1, limit: 4 }),
        ]);
        setProfile(profileData);
        setBookings(bookingData?.bookings || []);
      } catch (e) {
        setError(e.message || "Không thể tải hồ sơ khách hàng.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <StatusBadge tone="warning">Tài khoản SE Hotel</StatusBadge>
          <StatusBadge tone="info">{profile?.user?.email || user.email}</StatusBadge>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <aside className="min-w-0 rounded-[32px] border border-stone-200 bg-stone-950 p-7 text-white shadow-sm">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-300 text-stone-950">
              <UserRound size={28} />
            </div>
            <h1 className="mt-6 break-words text-3xl font-semibold">Xin chào, {profile?.full_name || user.name || "khách hàng SE Hotel"}</h1>
            <p className="mt-3 text-sm leading-7 text-stone-300">
              Quản lý thông tin tài khoản, xem lại lịch sử đặt phòng và theo dõi ưu đãi dành riêng cho bạn.
            </p>

            <div className="mt-7 grid gap-3 text-sm">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-stone-400">Email</p>
                <p className="mt-1 break-words font-semibold">{profile?.user?.email || user.email}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-stone-400">Vai trò</p>
                <p className="mt-1 font-semibold">Khách hàng</p>
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className="rounded-[32px] border border-stone-200 bg-white p-7 shadow-sm">
              <SectionHeader
                eyebrow="Lịch sử đặt phòng"
                title="Các đặt phòng gần đây"
                description="Những đặt phòng bạn thực hiện trên website SE Hotel sẽ được lưu để tra cứu nhanh."
              />
              <div className="mt-6 space-y-4">
                {error ? (
                  <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
                ) : null}
                {loading ? (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-stone-600">
                    Đang tải lịch sử đặt phòng...
                  </div>
                ) : null}
                {bookings.length ? (
                  bookings.slice(0, 4).map((booking) => (
                    <article key={booking.id || booking.booking_code} className="rounded-2xl border border-stone-200 bg-stone-50 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Mã đặt phòng</p>
                          <h2 className="mt-2 break-words text-xl font-semibold text-stone-950">{booking.booking_code || booking.id}</h2>
                        </div>
                        <StatusBadge tone="warning">{booking.status || "pending"}</StatusBadge>
                      </div>
                      <div className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-3">
                        <p><span className="font-semibold text-stone-900">Nhận phòng:</span> {booking.expected_checkin || "--"}</p>
                        <p><span className="font-semibold text-stone-900">Trả phòng:</span> {booking.expected_checkout || "--"}</p>
                        <p><span className="font-semibold text-stone-900">Tổng tiền:</span> {Number(booking.estimated_total || 0).toLocaleString()} VNĐ</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-stone-600">
                    Bạn chưa có đặt phòng nào trên tài khoản.
                  </div>
                )}
              </div>
            </section>

            <div className="grid gap-6 md:grid-cols-2">
              <section className="rounded-[32px] border border-stone-200 bg-white p-7 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                  <Gift size={22} />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-stone-950">Ưu đãi dành riêng</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  SE Hotel sẽ hiển thị các ưu đãi phù hợp khi tài khoản của bạn có lịch sử lưu trú.
                </p>
              </section>

              <section className="rounded-[32px] border border-stone-200 bg-white p-7 shadow-sm">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-800">
                  <CalendarCheck size={22} />
                </div>
                <h2 className="mt-5 text-2xl font-semibold text-stone-950">Thông tin tài khoản</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  Dùng cùng một tài khoản để đặt phòng, tra cứu booking và nhận hỗ trợ từ đội ngũ SE Hotel.
                </p>
              </section>
            </div>
          </div>
        </div>
      </section>
    </CustomerShell>
  );
}
