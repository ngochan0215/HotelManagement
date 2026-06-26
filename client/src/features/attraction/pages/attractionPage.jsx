import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Landmark, MapPin, Sparkles, Star, Trees, UtensilsCrossed } from "lucide-react";
import { attractionApi } from "../../api/attractionApi.js";
import { getAttractionFallbackImage, getAttractionVisual } from "../attractionVisuals.js";

const CATEGORIES = [
  { value: "", label: "Tất cả" },
  { value: "food", label: "Ăn uống" },
  { value: "cultural", label: "Tham quan" },
  { value: "entertainment", label: "Giải trí" },
  { value: "natural", label: "Thiên nhiên" },
];

const CATEGORY_META = {
  food: { label: "Ăn uống", icon: UtensilsCrossed },
  cultural: { label: "Tham quan", icon: Landmark },
  entertainment: { label: "Giải trí", icon: Sparkles },
  natural: { label: "Thiên nhiên", icon: Trees },
  sport: { label: "Vận động", icon: MapPin },
  other: { label: "Khác", icon: MapPin },
};

const ratingStars = (rating = 0) => {
  const value = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return Array.from({ length: 5 }, (_, index) => (index < value ? "★" : "☆")).join("");
};

function getDistanceLabel(distanceKm) {
  const distance = Number(distanceKm || 0);
  if (!distance) return "Gần khách sạn";
  if (distance <= 2) return "5–10 phút";
  if (distance <= 5) return "10–15 phút";
  return "Trong ngày";
}

function getMapsUrl(attraction) {
  const lat = attraction.coordinates?.lat;
  const lng = attraction.coordinates?.lng;
  if (lat && lng) {
    return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(attraction.name)}`;
}

function AttractionCard({ attraction, onClick }) {
  const visual = getAttractionVisual(attraction);
  const fallbackImage = getAttractionFallbackImage(visual.category);
  const [imageSrc, setImageSrc] = useState(visual.image || fallbackImage);
  const config = CATEGORY_META[visual.category] || CATEGORY_META.other;
  const CategoryIcon = config.icon;

  useEffect(() => {
    setImageSrc(visual.image || fallbackImage);
  }, [fallbackImage, visual.image]);

  return (
    <article
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_16px_40px_rgba(28,25,23,0.08)] transition ${
        onClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(28,25,23,0.12)]" : ""
      }`}
    >
      <div className="relative overflow-hidden bg-stone-100">
        <img
          src={imageSrc}
          alt={attraction.name}
          className="h-52 w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
          onError={() => {
            if (imageSrc !== fallbackImage) {
              setImageSrc(fallbackImage);
            }
          }}
        />

        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-stone-800 shadow-sm backdrop-blur">
          <CategoryIcon size={13} />
          <span>{config.label}</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3 p-5">
        <div className="min-w-0">
          <h3
            className="break-words text-lg font-semibold leading-tight text-stone-950"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {attraction.name}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
              <Star size={12} fill="currentColor" />
              {ratingStars(attraction.rating)}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
              <MapPin size={12} />
              {Number(attraction.distance_km || 0) ? `${Number(attraction.distance_km).toFixed(1)} km` : "Gần khách sạn"}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
              {getDistanceLabel(attraction.distance_km)}
            </span>
          </div>
        </div>

        <p
          className="text-sm leading-6 text-stone-600"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {attraction.description || "Gợi ý gần SE Hotel để khách dễ ghé ăn uống, tham quan hoặc thư giãn."}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="text-xs font-medium uppercase tracking-[0.2em] text-stone-400">Khám phá quanh khách sạn</span>
          <span className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700">
            Xem chi tiết
            <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
}

function AttractionDetail({ attraction, onClose }) {
  if (!attraction) return null;
  const visual = getAttractionVisual(attraction);
  const fallbackImage = getAttractionFallbackImage(visual.category);
  const [imageSrc, setImageSrc] = useState(visual.image || fallbackImage);

  useEffect(() => {
    setImageSrc(visual.image || fallbackImage);
  }, [fallbackImage, visual.image]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.28)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
              {CATEGORY_META[attraction.category]?.label || "Khám phá"}
            </p>
            <h3 className="mt-2 break-words text-2xl font-semibold text-stone-950">{attraction.name}</h3>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-stone-600">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-700">
                <MapPin size={12} />
                {Number(attraction.distance_km || 0) ? `${Number(attraction.distance_km).toFixed(1)} km` : "Gần khách sạn"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900">
                <Star size={12} fill="currentColor" />
                {ratingStars(attraction.rating)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-50"
          >
            Đóng
          </button>
        </div>

        <div className="grid gap-6 px-6 py-6 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 overflow-hidden rounded-[24px] border border-stone-200 bg-stone-100">
            <img
              src={imageSrc}
              alt={attraction.name}
              className="h-full w-full object-cover"
              style={{ minHeight: 280 }}
              onError={() => {
                if (imageSrc !== fallbackImage) {
                  setImageSrc(fallbackImage);
                }
              }}
            />
          </div>

          <div className="min-w-0">
            <p className="text-sm leading-7 text-stone-600">
              {attraction.description || "Gợi ý gần SE Hotel để khách dễ lên kế hoạch ghé thăm, ăn uống hoặc thư giãn."}
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Loại địa điểm</p>
                <p className="mt-2 text-sm font-medium text-stone-800">{visual.categoryLabel || "Khác"}</p>
              </div>
              <div className="rounded-[20px] border border-stone-200 bg-stone-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Khoảng cách</p>
                <p className="mt-2 text-sm font-medium text-stone-800">
                  {Number(attraction.distance_km || 0) ? `${Number(attraction.distance_km).toFixed(1)} km` : "Gần khách sạn"}
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={getMapsUrl(attraction)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
              >
                Mở Google Maps
                <ArrowRight size={16} />
              </a>
              {attraction.wikipedia_url ? (
                <a
                  href={attraction.wikipedia_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  Wikipedia
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AttractionPage() {
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [category, setCategory] = useState("");
  const [maxDistance, setMaxDistance] = useState("");
  const [page, setPage] = useState(1);
  const LIMIT = 12;

  useEffect(() => {
    const fetchAttractions = async () => {
      setLoading(true);
      setError("");
      try {
        const params = { page, limit: LIMIT };
        if (category) params.category = category;
        if (maxDistance) params.max_distance = Number(maxDistance) * 1000;

        const res = await attractionApi.getAll(params);
        const list = res?.attractions || res?.data?.attractions || [];
        setData(res);
        setItems((prev) => (page === 1 ? list : [...prev, ...list]));
      } catch (err) {
        setError(err?.message || "Không thể tải địa điểm.");
        if (page === 1) setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAttractions();
  }, [category, maxDistance, page]);

  const hasMore = useMemo(() => {
    if (!data) return false;
    return items.length < Number(data.total || 0);
  }, [data, items.length]);

  const applyCategory = (value) => {
    setCategory(value);
    setPage(1);
  };

  const applyDistance = (value) => {
    setMaxDistance(value);
    setPage(1);
  };

  const resetAll = () => {
    setCategory("");
    setMaxDistance("");
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#faf8f4_0%,#f5f2eb_100%)] text-stone-900">
      <div className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 md:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Khám phá quanh khách sạn</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">Địa điểm gần SE Hotel</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
              Gợi ý những nơi dễ ghé để ăn uống, tham quan hoặc thư giãn trong thời gian lưu trú.
            </p>
          </div>

          <button
            type="button"
            onClick={resetAll}
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6 flex flex-wrap gap-2">
          {CATEGORIES.map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => applyCategory(chip.value)}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                category === chip.value
                  ? "border-stone-950 bg-stone-950 text-white shadow-sm"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              {chip.label}
            </button>
          ))}

          {[
            { label: "Dưới 2 km", value: "2" },
            { label: "Dưới 5 km", value: "5" },
            { label: "Dưới 10 km", value: "10" },
          ].map((chip) => (
            <button
              key={chip.value}
              type="button"
              onClick={() => applyDistance(chip.value)}
              className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                maxDistance === chip.value
                  ? "border-emerald-700 bg-emerald-700 text-white shadow-sm"
                  : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="rounded-[28px] border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
            <p className="text-lg font-semibold text-stone-900">Chưa thể tải địa điểm</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">{error}</p>
          </div>
        ) : null}

        <section className="space-y-4">
          {items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => (
                <AttractionCard key={item._id || item.xid || item.name} attraction={item} onClick={() => setSelected(item)} />
              ))}
            </div>
          ) : loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
                  <div className="h-52 animate-pulse bg-stone-100" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
                    <div className="h-6 w-4/5 animate-pulse rounded bg-stone-100" />
                    <div className="h-4 w-full animate-pulse rounded bg-stone-100" />
                    <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/80 px-6 py-12 text-center shadow-sm">
              <p className="text-lg font-semibold text-stone-900">Không tìm thấy địa điểm nào</p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
                Hãy thử bỏ bớt bộ lọc để xem thêm gợi ý quanh SE Hotel.
              </p>
            </div>
          )}
        </section>

        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page === 1 || loading}
            className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Trước
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!hasMore || loading}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-stone-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Xem thêm
            <ArrowRight size={16} />
          </button>
        </div>
      </main>

      <AttractionDetail attraction={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
