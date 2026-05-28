import { useState } from "react";
import { Search } from "lucide-react";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import { HOTEL_IMAGE_SETS } from "../components/imageCatalog.js";
import { EmptyState, HotelImage, SectionHeader, StatusBadge } from "../components/sitePrimitives.jsx";

function getStatusTone(status) {
  if (status === "confirmed" || status === "completed") return "success";
  if (status === "pending") return "warning";
  return "info";
}

export default function MyBookingsPage() {
  const [query, setQuery] = useState({ bookingCode: "", email: "", phone: "" });
  const [bookings, setBookings] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleLookup = async (e) => {
    e.preventDefault();
    const res = await customerPortalApi.lookupBookings(query);
    setBookings(res.bookings || []);
    setSearched(true);
  };

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start">
          <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-stone-950 text-white shadow-sm">
            <HotelImage src={HOTEL_IMAGE_SETS.hero[2]} alt="Khu vực tiếp khách của SE Hotel" ratio="wide" fallbackLabel="SE Hotel" className="rounded-none" />
            <div className="p-7">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">
                Tra cứu đặt phòng
              </p>
              <h1 className="break-words text-3xl font-semibold tracking-tight text-white">
                Tìm lại đặt phòng bằng mã đơn và email
              </h1>
              <p className="mt-3 text-sm leading-7 text-stone-300">
                Số điện thoại chỉ là trường phụ để hỗ trợ khi cần.
              </p>
            </div>
          </div>

          <div className="min-w-0 rounded-[32px] border border-stone-200 bg-white p-6 shadow-[0_18px_48px_rgba(28,25,23,0.08)] md:p-7">
            <form onSubmit={handleLookup} className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-medium text-stone-700">
                Mã đặt phòng
                <input value={query.bookingCode} onChange={(e) => setQuery((prev) => ({ ...prev, bookingCode: e.target.value }))} placeholder="Ví dụ: SE123456" className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-700">
                Email đặt phòng
                <input type="email" value={query.email} onChange={(e) => setQuery((prev) => ({ ...prev, email: e.target.value }))} placeholder="ban@email.com" className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
              </label>
              <label className="grid gap-2 text-sm font-medium text-stone-700 md:col-span-2">
                Số điện thoại (không bắt buộc)
                <input value={query.phone} onChange={(e) => setQuery((prev) => ({ ...prev, phone: e.target.value }))} placeholder="09xxxxxxxx" className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />
              </label>
              <div className="md:col-span-2">
                <button type="submit" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-stone-800">
                  <Search size={16} />
                  Tra cứu đặt phòng
                </button>
              </div>
            </form>

            <div className="mt-6 space-y-4">
              {bookings.map((item, index) => (
                <article key={item.id || item._id} className="min-w-0 overflow-hidden rounded-[28px] border border-stone-200 bg-stone-50">
                  <div className="grid gap-0 lg:grid-cols-[minmax(0,0.32fr)_minmax(0,0.68fr)]">
                    <HotelImage src={HOTEL_IMAGE_SETS.rooms[index % HOTEL_IMAGE_SETS.rooms.length]} alt="Hình ảnh minh họa đơn đặt phòng" ratio="square" fallbackLabel="Đơn đặt phòng" className="rounded-none" />
                    <div className="min-w-0 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Mã đặt phòng</p>
                          <h2 className="mt-2 break-words text-xl font-semibold text-stone-950">{item.booking_code || item.id || item._id}</h2>
                        </div>
                        <StatusBadge tone={getStatusTone(item.status)}>{item.status || "pending"}</StatusBadge>
                      </div>
                      <div className="mt-5 grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-sm text-stone-500">Nhận phòng</p>
                          <p className="mt-2 font-semibold text-stone-900">{item.expected_checkin?.slice(0, 10) || "--"}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-sm text-stone-500">Trả phòng</p>
                          <p className="mt-2 font-semibold text-stone-900">{item.expected_checkout?.slice(0, 10) || "--"}</p>
                        </div>
                        <div className="rounded-2xl bg-white p-4">
                          <p className="text-sm text-stone-500">Tổng tiền tạm tính</p>
                          <p className="mt-2 break-words font-semibold text-stone-900">{Number(item.estimated_total || 0).toLocaleString()} VNĐ</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              ))}

              {searched && !bookings.length ? (
                <EmptyState
                  title="Không tìm thấy đơn đặt phòng"
                  description="Kiểm tra lại mã đặt phòng hoặc email để thử lại."
                />
              ) : null}

              {!searched ? (
                <EmptyState
                  title="Sẵn sàng tra cứu đặt phòng"
                  description="Nhập mã đặt phòng và email để xem lại trạng thái đơn."
                />
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </CustomerShell>
  );
}
