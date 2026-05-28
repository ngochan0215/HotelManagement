import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import { HOTEL_IMAGE_SETS } from "../components/imageCatalog.js";
import {
  AmenityPill,
  EmptyState,
  HotelImage,
  LoadingCardGrid,
  SectionHeader,
  StatusBadge,
} from "../components/sitePrimitives.jsx";

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildBookingUrl(roomId, criteria) {
  const params = new URLSearchParams();
  params.set("roomId", roomId);
  ["checkin", "checkout", "adults", "children"].forEach((key) => {
    const value = criteria[key];
    if (value) params.set(key, value);
  });
  return `/hotel/book?${params.toString()}`;
}

export default function RoomsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState("");
  const [filters, setFilters] = useState(() => ({
    checkin: searchParams.get("checkin") || "",
    checkout: searchParams.get("checkout") || "",
    adults: toNumber(searchParams.get("adults"), 2),
    children: toNumber(searchParams.get("children"), 0),
    roomType: searchParams.get("roomType") || "",
    priceLimit: searchParams.get("priceLimit") || "",
  }));

  const searchCriteria = useMemo(
    () => ({
      checkin: filters.checkin,
      checkout: filters.checkout,
      adults: toNumber(filters.adults, 2),
      children: toNumber(filters.children, 0),
      roomType: filters.roomType,
      maxPrice: filters.priceLimit,
    }),
    [filters.adults, filters.checkin, filters.checkout, filters.children, filters.priceLimit, filters.roomType],
  );

  const nights = customerPortalApi.calculateNights(searchCriteria.checkin, searchCriteria.checkout);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { rooms: items } = await customerPortalApi.searchRooms(searchCriteria);
        setRooms(items);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [searchCriteria]);

  useEffect(() => {
    const loadRoomTypes = async () => {
      const { rooms: types } = await customerPortalApi.getRooms();
      setRoomTypes(types);
    };
    loadRoomTypes();
  }, []);

  const filtered = useMemo(
    () =>
      rooms.filter((room) => {
        const estimatedTotal = Number(room.estimated_total || 0) || Number(room.price || 0) * nights;
        const byPrice = filters.priceLimit
          ? estimatedTotal <= Number(filters.priceLimit)
          : true;
        return byPrice;
      }),
    [filters.priceLimit, nights, rooms],
  );

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setSearchError("");
    if (!filters.checkin || !filters.checkout || filters.adults === "" || filters.children === "") {
      setSearchError("Vui lòng nhập ngày nhận phòng, ngày trả phòng, số người lớn và số trẻ em.");
      return;
    }
    if (new Date(filters.checkout) <= new Date(filters.checkin)) {
      setSearchError("Ngày trả phòng phải sau ngày nhận phòng.");
      return;
    }
    if (Number(filters.adults) < 1) {
      setSearchError("Số người lớn phải từ 1 trở lên.");
      return;
    }
    if (Number(filters.children) < 0) {
      setSearchError("Số trẻ em không được nhỏ hơn 0.");
      return;
    }
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== "" && value !== null && value !== undefined) params.set(key, value);
    });
    setSearchParams(params);
  };

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
          <SectionHeader
            eyebrow="Kết quả tìm phòng"
            title="Các hạng phòng phù hợp với lịch lưu trú của bạn"
            description="Xem sức chứa, tiện nghi, giá mỗi đêm và tổng tiền tạm tính trước khi chọn phòng."
          />
          <form onSubmit={handleSearch} className="min-w-0 overflow-hidden rounded-[30px] border border-stone-200 bg-white p-5 shadow-sm md:p-6">
            <div className="grid min-w-0 items-end gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-stone-700">
                Ngày nhận phòng
                <input
                  required
                  type="date"
                  value={filters.checkin}
                  onChange={(e) => handleFilterChange("checkin", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-stone-700">
                Ngày trả phòng
                <input
                  required
                  type="date"
                  value={filters.checkout}
                  onChange={(e) => handleFilterChange("checkout", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>
              <div className="grid min-w-0 grid-cols-2 gap-4">
                <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-stone-700">
                  Người lớn
                  <input
                    required
                    type="number"
                    min="1"
                    value={filters.adults}
                    onChange={(e) => handleFilterChange("adults", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </label>
                <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-stone-700">
                  Trẻ em
                  <input
                    required
                    type="number"
                    min="0"
                    value={filters.children}
                    onChange={(e) => handleFilterChange("children", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </label>
              </div>
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-stone-700">
                Loại phòng
                <select
                  value={filters.roomType}
                  onChange={(e) => handleFilterChange("roomType", e.target.value)}
                  className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                >
                  <option value="">Tất cả hạng phòng</option>
                  {roomTypes.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.category_name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex min-w-0 flex-col gap-2 text-sm font-medium text-stone-700">
                Ngân sách tối đa
                <input
                  type="number"
                  value={filters.priceLimit}
                  onChange={(e) => handleFilterChange("priceLimit", e.target.value)}
                  placeholder="Ví dụ: 3.000.000"
                  className="h-12 w-full rounded-2xl border border-stone-200 px-4 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>
              <div className="grid min-w-0 gap-3 sm:col-span-2 xl:col-span-1">
                <div className="flex min-w-0 flex-col justify-center rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  <p className="font-semibold">Lịch lưu trú</p>
                  <p className="truncate">{searchCriteria.checkin || "Chưa chọn"} - {searchCriteria.checkout || "Chưa chọn"}</p>
                  <p className="truncate">{searchCriteria.adults} người lớn, {searchCriteria.children} trẻ em</p>
                </div>
                <button type="submit" className="inline-flex h-12 w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 text-center text-sm font-semibold text-white transition hover:bg-stone-800">
                  Tìm phòng
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
            {searchError ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {searchError}
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <section className="border-t border-stone-200/70 bg-stone-50/70 py-12">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
        {loading ? (
          <LoadingCardGrid count={6} />
        ) : filtered.length ? (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((room, index) => {
              const amenities = (room.default_equipments || [])
                .map((item) => item.equipment_category?.name)
                .filter(Boolean)
                .slice(0, 3);
              const estimatedTotal = Number(room.estimated_total || 0) || Number(room.price || 0) * nights;

              return (
                <article key={room._id} className="flex h-full min-w-0 flex-col overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-[0_18px_48px_rgba(28,25,23,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(28,25,23,0.12)]">
                  <HotelImage
                    src={room.images?.[0] || HOTEL_IMAGE_SETS.rooms[index % HOTEL_IMAGE_SETS.rooms.length]}
                    alt={`Hình ảnh phòng ${room.category_name}`}
                    ratio="wide"
                    fallbackLabel={`Phòng ${room.category_name}`}
                    className="shrink-0 rounded-none"
                  />
                  <div className="flex flex-1 flex-col space-y-5 p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">SE Hotel</p>
                        <h2 className="mt-2 break-words text-2xl font-semibold leading-tight text-stone-950">{room.category_name}</h2>
                        <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-stone-600">{room.description}</p>
                      </div>
                      <StatusBadge tone="success">
                        {room.available_rooms_count ? `${room.available_rooms_count} phòng trống` : "Phù hợp"}
                      </StatusBadge>
                    </div>

                    <div className="flex min-w-0 flex-wrap gap-2">
                      <AmenityPill>Sức chứa {room.max_adults + room.max_children} khách</AmenityPill>
                      <AmenityPill>{room.max_adults} người lớn</AmenityPill>
                      <AmenityPill>{room.max_children} trẻ em</AmenityPill>
                      {(amenities.length ? amenities : ["Wi‑Fi", "Máy lạnh", "Phòng tắm riêng"]).map((item) => (
                        <AmenityPill key={item}>{item}</AmenityPill>
                      ))}
                    </div>

                    <div className="mt-auto grid gap-3 rounded-2xl bg-stone-50 p-4">
                      <div className="flex items-center justify-between gap-4 text-sm text-stone-600">
                        <span className="min-w-0">Giá mỗi đêm</span>
                        <span className="shrink-0 text-right font-semibold text-stone-900">{Number(room.price || 0).toLocaleString()} VNĐ</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sm text-stone-600">
                        <span className="min-w-0">Tổng tiền tạm tính</span>
                        <span className="shrink-0 text-right text-lg font-semibold text-stone-950">{estimatedTotal.toLocaleString()} VNĐ</span>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Link to={`/hotel/rooms/${room._id}`} className="inline-flex min-w-0 items-center justify-center rounded-2xl border border-stone-300 px-4 py-3 text-center text-sm font-semibold leading-5 text-stone-800 transition hover:bg-stone-50">
                        Xem chi tiết
                      </Link>
                      <Link to={buildBookingUrl(room._id, searchCriteria)} className="inline-flex min-w-0 items-center justify-center rounded-2xl bg-stone-950 px-4 py-3 text-center text-sm font-semibold leading-5 text-white transition hover:bg-stone-800">
                        Chọn phòng
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="Chưa có phòng phù hợp"
            description="Hãy đổi ngày lưu trú, số khách hoặc mức giá để xem thêm lựa chọn."
          />
        )}
        </div>
      </section>
    </CustomerShell>
  );
}
