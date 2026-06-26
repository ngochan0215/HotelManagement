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
} from "../components/sitePrimitives.jsx";

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function buildBookingUrl(roomId, criteria) {
  if (!roomId) return "";
  const params = new URLSearchParams();
  params.set("categoryId", roomId);
  ["checkin", "checkout", "adults", "children"].forEach((key) => {
    const value = criteria[key];
    if (value) params.set(key, value);
  });
  return `/hotel/book?${params.toString()}`;
}

function readFiltersFromParams(params) {
  return {
    checkin: (params.get("checkin") || "").split("T")[0],
    checkout: (params.get("checkout") || "").split("T")[0],
    adults: toNumber(params.get("adults"), 2),
    children: toNumber(params.get("children"), 0),
    roomType: params.get("roomType") || "",
    priceLimit: params.get("priceLimit") || "",
  };
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function RoomsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [filters, setFilters] = useState(() => readFiltersFromParams(searchParams));
  const submittedCriteria = useMemo(() => readFiltersFromParams(searchParams), [searchParamsKey]);
  const hasSubmittedSearch = Boolean(submittedCriteria.checkin && submittedCriteria.checkout);

  const [catalogRooms, setCatalogRooms] = useState([]);
  const [availabilityRooms, setAvailabilityRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [searchValidationError, setSearchValidationError] = useState("");
  const todayInputValue = getTodayInputValue();

  const activeRooms = hasSubmittedSearch ? availabilityRooms : catalogRooms;
  const activeLoading = hasSubmittedSearch ? availabilityLoading : catalogLoading;
  const activeError = hasSubmittedSearch ? availabilityError : catalogError;
  const activeCriteria = hasSubmittedSearch ? submittedCriteria : filters;
  const activeNights = customerPortalApi.calculateNights(activeCriteria.checkin, activeCriteria.checkout);

  const pageEyebrow = hasSubmittedSearch ? "Kết quả tìm phòng" : "Danh mục phòng";
  const pageTitle = hasSubmittedSearch ? "Phòng phù hợp" : "Chọn hạng phòng";
  const pageDescription = hasSubmittedSearch
    ? "Kết quả theo ngày lưu trú bạn đã chọn."
    : "Xem các hạng phòng đang mở bán tại SE Hotel.";

  const loadCatalog = async () => {
    setCatalogLoading(true);
    setCatalogError("");
    try {
      const { rooms: items } = await customerPortalApi.getRooms();
      setCatalogRooms(items);
      setRoomTypes(items);
    } catch (error) {
      setCatalogRooms([]);
      setRoomTypes([]);
      setCatalogError(error.message || "Không thể tải danh sách phòng.");
    } finally {
      setCatalogLoading(false);
    }
  };

  const loadAvailability = async () => {
    if (!hasSubmittedSearch) {
      setAvailabilityRooms([]);
      setAvailabilityError("");
      setAvailabilityLoading(false);
      return;
    }

    setAvailabilityLoading(true);
    setAvailabilityError("");
    try {
      const { rooms: items } = await customerPortalApi.searchRooms({
        checkin: submittedCriteria.checkin,
        checkout: submittedCriteria.checkout,
        adults: submittedCriteria.adults,
        children: submittedCriteria.children,
        roomType: submittedCriteria.roomType,
        maxPrice: submittedCriteria.priceLimit,
      });
      setAvailabilityRooms(items);
    } catch (error) {
      setAvailabilityRooms([]);
      setAvailabilityError(error.message || "Không thể tải danh sách phòng.");
    } finally {
      setAvailabilityLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  useEffect(() => {
    setFilters(readFiltersFromParams(searchParams));
  }, [searchParamsKey]);

  useEffect(() => {
    loadAvailability();
  }, [
    hasSubmittedSearch,
    submittedCriteria.adults,
    submittedCriteria.checkin,
    submittedCriteria.checkout,
    submittedCriteria.children,
    submittedCriteria.priceLimit,
    submittedCriteria.roomType,
  ]);

  const visibleRooms = useMemo(() => {
    if (!hasSubmittedSearch) return activeRooms;

    return activeRooms.filter((room) => {
      const estimatedTotal = Number(room.estimated_total || 0) || Number(room.price || 0) * activeNights;
      const priceMatch = submittedCriteria.priceLimit
        ? estimatedTotal <= Number(submittedCriteria.priceLimit)
        : true;
      const roomTypeKeyword = String(submittedCriteria.roomType || "").trim().toLowerCase();
      const typeMatch = roomTypeKeyword
        ? room._id?.toLowerCase() === roomTypeKeyword || room.category_name?.toLowerCase().includes(roomTypeKeyword)
        : true;
      return priceMatch && typeMatch;
    });
  }, [activeNights, activeRooms, hasSubmittedSearch, submittedCriteria.priceLimit, submittedCriteria.roomType]);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setSearchValidationError("");

    if (!filters.checkin || !filters.checkout) {
      setSearchValidationError("Vui lòng chọn ngày nhận và trả phòng.");
      return;
    }
    if (filters.checkin < todayInputValue) {
      setSearchValidationError("Ngày nhận phòng không được nằm trong quá khứ.");
      return;
    }
    if (new Date(filters.checkout) <= new Date(filters.checkin)) {
      setSearchValidationError("Ngày trả phòng phải sau ngày nhận phòng.");
      return;
    }
    if (Number(filters.adults) < 1) {
      setSearchValidationError("Số người lớn phải từ 1 trở lên.");
      return;
    }
    if (Number(filters.children) < 0) {
      setSearchValidationError("Số trẻ em không được nhỏ hơn 0.");
      return;
    }

    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined) return;

      if (key === "checkin") {
        params.set(key, `${value}T14:00`);
      } else if (key === "checkout") {
        params.set(key, `${value}T12:00`);
      } else {
        params.set(key, value);
      }
    });
    setSearchParams(params);
  };

  const retryActiveLoad = () => {
    if (hasSubmittedSearch) {
      loadAvailability();
    } else {
      loadCatalog();
    }
  };

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)] lg:items-start">
          <SectionHeader eyebrow={pageEyebrow} title={pageTitle} description={pageDescription} />

          <form onSubmit={handleSearch} className="min-w-0 overflow-hidden rounded-[32px] border border-stone-300 bg-white p-4 shadow-[0_18px_48px_rgba(28,25,23,0.10)] ring-1 ring-stone-100 md:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-stone-950">Tìm phòng</p>
                <p className="mt-1 text-sm text-stone-500">Bộ lọc nhanh cho lịch lưu trú của bạn.</p>
              </div>
            </div>

            <div className="grid min-w-0 items-end gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-stone-700">
                <span className="text-[13px] font-medium text-stone-600">Nhận phòng</span>
                <input
                  required
                  type="date"
                  min={todayInputValue}
                  value={filters.checkin}
                  onChange={(e) => handleFilterChange("checkin", e.target.value)}
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-3.5 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
                <p className="mt-3 text-sm text-stone-500">
                  Giờ nhận phòng: <span className="font-semibold">14:00</span>
                </p>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-stone-700">
                <span className="text-[13px] font-medium text-stone-600">Trả phòng</span>
                <input
                  required
                  type="date"
                  value={filters.checkout}
                  onChange={(e) => handleFilterChange("checkout", e.target.value)}
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-3.5 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
                <p className="mt-3 text-sm text-stone-500">
                  Giờ trả phòng: <span className="font-semibold">12:00 (trưa)</span>
                </p>
              </label>

              <div className="grid min-w-0 gap-2">
                <span className="text-[13px] font-medium text-stone-600">Khách</span>
                <div className="grid grid-cols-2 gap-2 rounded-2xl border border-stone-200 bg-white p-1.5">
                  <label className="grid gap-1 rounded-xl px-2 py-1.5">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">Người lớn</span>
                    <input
                      required
                      type="number"
                      min="1"
                      value={filters.adults}
                      onChange={(e) => handleFilterChange("adults", e.target.value)}
                      className="h-9 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>

                  <label className="grid gap-1 rounded-xl px-2 py-1.5">
                    <span className="text-[11px] uppercase tracking-[0.14em] text-stone-400">Trẻ em</span>
                    <input
                      required
                      type="number"
                      min="0"
                      value={filters.children}
                      onChange={(e) => handleFilterChange("children", e.target.value)}
                      className="h-9 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>
              </div>

              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-stone-700">
                <span className="text-[13px] font-medium text-stone-600">Loại phòng</span>
                <select
                  value={filters.roomType}
                  onChange={(e) => handleFilterChange("roomType", e.target.value)}
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-3.5 text-stone-900 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                >
                  <option value="">Tất cả hạng phòng</option>
                  {roomTypes.map((room) => (
                    <option key={room._id} value={room._id}>
                      {room.category_name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex min-w-0 flex-col gap-1.5 text-sm font-medium text-stone-700">
                <span className="text-[13px] font-medium text-stone-600">Ngân sách</span>
                <input
                  type="number"
                  value={filters.priceLimit}
                  onChange={(e) => handleFilterChange("priceLimit", e.target.value)}
                  placeholder="Ví dụ: 3.000.000"
                  className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-3.5 text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>

              <div className="grid min-w-0 gap-2 sm:col-span-2 xl:col-span-1">
                <button
                  type="submit"
                  className="inline-flex h-11 w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-4 text-center text-sm font-semibold text-white shadow-[0_12px_30px_rgba(28,25,23,0.22)] transition hover:bg-stone-800 hover:shadow-[0_16px_36px_rgba(28,25,23,0.28)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Tìm phòng
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>

            {searchValidationError ? (
              <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {searchValidationError}
              </p>
            ) : null}
          </form>
        </div>
      </section>

      <section className="border-t border-stone-200/70 bg-stone-50/70 py-12">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          {activeLoading ? (
            <div className="mb-3 text-sm font-medium text-stone-600">
              {hasSubmittedSearch ? "Đang kiểm tra phòng phù hợp..." : "Đang tải hạng phòng..."}
            </div>
          ) : null}

          {activeLoading ? (
            <LoadingCardGrid count={6} />
          ) : activeError ? (
            <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-8 text-center shadow-sm">
              <p className="text-lg font-semibold text-red-800">
                {hasSubmittedSearch ? "Không thể kiểm tra phòng trống. Vui lòng thử lại." : "Không thể tải danh sách phòng. Vui lòng thử lại."}
              </p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-red-700">
                {activeError}
              </p>
              <button
                type="button"
                onClick={retryActiveLoad}
                className="mt-5 inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Thử lại
              </button>
            </div>
          ) : visibleRooms.length ? (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {visibleRooms.map((room, index) => {
                const amenities = (room.default_equipments || [])
                  .map((item) => item.equipment_category?.name)
                  .filter(Boolean)
                  .slice(0, 3);
                const availableCount = Number(room.available_rooms_count ?? room.available_count ?? 0);
                const totalCapacity = Number(room.max_adults || 0) + Number(room.max_children || 0);
                const roomPrice = Number(room.price || 0);
                const isSearchMode = hasSubmittedSearch;

                return (
                  <article
                    key={room._id}
                    className="flex h-full min-w-0 flex-col overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-[0_18px_48px_rgba(28,25,23,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_56px_rgba(28,25,23,0.12)]"
                  >
                    <HotelImage
                      src={room.images?.[0] || HOTEL_IMAGE_SETS.rooms[index % HOTEL_IMAGE_SETS.rooms.length]}
                      alt={`Hình ảnh phòng ${room.category_name}`}
                      ratio="wide"
                      fallbackLabel={`Phòng ${room.category_name}`}
                      className="shrink-0 rounded-none"
                      overlay={false}
                    />
                    <div className="flex flex-1 flex-col gap-4 p-5 md:p-6">
                      <div className="min-w-0">
                        <h2 className="break-words text-2xl font-semibold leading-tight text-stone-950">{room.category_name}</h2>
                        <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-stone-600">{room.description}</p>
                      </div>

                      <div className="flex min-w-0 flex-wrap gap-2">
                        <span className="inline-flex max-w-full items-center rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-700">
                          Tối đa {totalCapacity} khách
                        </span>
                        {(amenities.length ? amenities : ["Wi‑Fi", "Máy lạnh", "Phòng tắm riêng"]).slice(0, 3).map((item) => (
                          <AmenityPill key={item}>{item}</AmenityPill>
                        ))}
                      </div>

                      <div className="mt-auto flex items-end justify-between gap-4 rounded-2xl bg-stone-50 p-4">
                        <div className="min-w-0">
                          <p className="text-xs text-stone-400">{roomPrice ? "Từ" : "Giá"}</p>
                          <p className="mt-1 break-words text-2xl font-semibold text-stone-950">
                            {roomPrice ? `${roomPrice.toLocaleString()} VNĐ/đêm` : "Xem giá theo ngày"}
                          </p>
                        </div>
                        {isSearchMode && availableCount ? (
                          <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                            Còn {availableCount} phòng
                          </span>
                        ) : null}
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <Link
                          to={`/hotel/rooms/${room._id}`}
                          className="inline-flex min-w-0 items-center justify-center rounded-2xl border border-stone-300 px-4 py-3 text-center text-sm font-semibold leading-5 text-stone-800 transition hover:bg-stone-50"
                        >
                          Xem chi tiết
                        </Link>
                      <Link
                          to={buildBookingUrl(room._id, hasSubmittedSearch ? submittedCriteria : filters) || "/hotel/rooms"}
                          aria-disabled={!room._id}
                          className="inline-flex min-w-0 items-center justify-center rounded-2xl bg-stone-950 px-4 py-3 text-center text-sm font-semibold leading-5 text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
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
              title={hasSubmittedSearch ? "Không tìm thấy phòng phù hợp." : "Chưa có hạng phòng công khai."}
              description={hasSubmittedSearch ? "Hãy thử đổi ngày lưu trú hoặc số khách." : "Vui lòng quay lại sau để xem các hạng phòng đang mở bán."}
            />
          )}
        </div>
      </section>
    </CustomerShell>
  );
}
