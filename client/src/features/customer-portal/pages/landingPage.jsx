import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Landmark, MapPin, ShieldCheck, Sparkles, Star, Trees, UtensilsCrossed } from "lucide-react";
import { attractionApi } from "../../api/attractionApi.js";
import { getAttractionImage, getAttractionVisual } from "../../attraction/attractionVisuals.js";
import { customerPortalApi } from "../api/customerPortalApi.js";
import CustomerShell from "../components/customerShell.jsx";
import { HOTEL_IMAGE_SETS } from "../components/imageCatalog.js";
import { serviceApi } from "../../api/serviceApi.js";
import { reviewApi } from "../../api/reviewApi.js";
import {
  AmenityPill,
  HotelImage,
  LoadingCardGrid,
  MetricStrip,
  SectionHeader,
  StatusBadge,
} from "../components/sitePrimitives.jsx";

const fallbackServices = [
  {
    title: "Đưa đón sân bay",
    desc: "Đặt thêm để chuyến đi thuận tiện hơn.",
    image: HOTEL_IMAGE_SETS.services[0],
    icon: Sparkles,
  },
  {
    title: "Ăn sáng tại khách sạn",
    desc: "Buffet sáng tinh gọn, phù hợp cho cả nghỉ dưỡng và công tác.",
    image: HOTEL_IMAGE_SETS.services[1],
    icon: Star,
  },
  {
    title: "Spa và thư giãn",
    desc: "Dịch vụ thêm có thể chọn trước bước xác nhận đặt phòng.",
    image: HOTEL_IMAGE_SETS.services[2],
    icon: ShieldCheck,
  },
];

const amenities = [
  { title: "Hồ bơi vô cực", image: HOTEL_IMAGE_SETS.amenities[0] },
  { title: "Phòng nghỉ thanh lịch", image: HOTEL_IMAGE_SETS.amenities[1] },
  { title: "Không gian thư giãn", image: HOTEL_IMAGE_SETS.amenities[2] },
];

const fallbackTestimonials = [
  { name: "Ngọc Anh", role: "Khách du lịch", content: "Không gian yên tĩnh, đặt phòng nhanh và đội ngũ hỗ trợ rất chu đáo.", rating: 5 },
  { name: "Minh Quân", role: "Khách công tác", content: "Vị trí thuận tiện, phòng sạch đẹp và thông tin giá rất dễ theo dõi.", rating: 5 },
  { name: "Thảo Vy", role: "Khách nghỉ dưỡng", content: "Dịch vụ chỉn chu, tiện nghi đầy đủ và trải nghiệm lưu trú đáng nhớ.", rating: 5 },
];

const getServiceIcon = (type) => {
  switch (type) {
    case "experience":
      return Star;
    case "rental":
      return MapPin;
    case "product":
    default:
      return Sparkles;
  }
};

const nearbyCategoryChips = [
  { value: "", label: "Tất cả" },
  { value: "food", label: "Ăn uống" },
  { value: "cultural", label: "Tham quan" },
  { value: "entertainment", label: "Giải trí" },
  { value: "natural", label: "Thiên nhiên" },
];

const nearbyCategoryMeta = {
  food: { Icon: UtensilsCrossed, label: "Ăn uống" },
  cultural: { Icon: Landmark, label: "Tham quan" },
  entertainment: { Icon: Sparkles, label: "Giải trí" },
  natural: { Icon: Trees, label: "Thiên nhiên" },
  sport: { Icon: MapPin, label: "Vận động" },
  other: { Icon: MapPin, label: "Khác" },
};

const getNearbyDistanceLabel = (distanceKm) => {
  const distance = Number(distanceKm || 0);
  if (!distance) return "Gần khách sạn";
  if (distance <= 2) return "5-10 phút di chuyển";
  if (distance <= 5) return "10-15 phút di chuyển";
  return "Tiện ghé trong ngày";
};

function deriveAmenities(room) {
  return (room.default_equipments || [])
    .map((item) => item.equipment_category?.name)
    .filter(Boolean)
    .slice(0, 3);
}

function getTodayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function LandingPage() {
  const navigate = useNavigate();
  const [featuredRooms, setFeaturedRooms] = useState([]);
  const [roomTypes, setRoomTypes] = useState([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [roomLoadError, setRoomLoadError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [search, setSearch] = useState({
    checkin: "",
    checkout: "",
    adults: 2,
    children: 0,
    roomType: "",
  });
  const [landingServices, setLandingServices] = useState(fallbackServices);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [servicesError, setServicesError] = useState("");
  const [landingTestimonials, setLandingTestimonials] = useState(fallbackTestimonials);
  const [testimonialsLoading, setTestimonialsLoading] = useState(true);
  const [testimonialsError, setTestimonialsError] = useState("");
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [nearbyTotal, setNearbyTotal] = useState(0);
  const [nearbyLoading, setNearbyLoading] = useState(true);
  const [nearbyError, setNearbyError] = useState("");
  const [nearbyCategory, setNearbyCategory] = useState("");
  const slidingServices = [...landingServices, ...landingServices];
  const slidingAmenities = [...amenities, ...amenities];
  const todayInputValue = getTodayInputValue();
  const visibleNearbyPlaces = useMemo(() => {
    const items = Array.isArray(nearbyPlaces) ? [...nearbyPlaces] : [];
    return items
      .sort((a, b) => {
        return Number(a?.distance_km || 0) - Number(b?.distance_km || 0);
      })
      .slice(0, 6);
  }, [nearbyPlaces]);

  const loadRooms = async () => {
    setLoadingRooms(true);
    setRoomLoadError("");
    try {
      const { rooms } = await customerPortalApi.getRooms();
      setRoomTypes(rooms);
      setFeaturedRooms(rooms.slice(0, 3));
    } catch (error) {
      setRoomTypes([]);
      setFeaturedRooms([]);
      setRoomLoadError(error.message || "Không thể tải danh sách phòng.");
    } finally {
      setLoadingRooms(false);
    }
  };

  const loadServices = async () => {
    setServicesLoading(true);
    setServicesError("");
    try {
      const response = await serviceApi.getAllServices({ status: "active", service_type: "experience,rental" });
      const fetchedServices = response?.services || response?.data || [];

      if (Array.isArray(fetchedServices) && fetchedServices.length > 0) {
        setLandingServices(
          fetchedServices.map((service, index) => ({
            title: service.name || `Dịch vụ ${index + 1}`,
            desc: service.description || "Dịch vụ tiện ích giúp kỳ nghỉ thêm trọn vẹn.",
            image: service.images?.[0] || HOTEL_IMAGE_SETS.services[index % HOTEL_IMAGE_SETS.services.length],
            icon: getServiceIcon(service.service_type),
          })),
        );
      } else {
        setLandingServices(fallbackServices);
      }
    } catch (error) {
      setLandingServices(fallbackServices);
      setServicesError(error.message || "Không thể tải dịch vụ.");
    } finally {
      setServicesLoading(false);
    }
  };

  const loadTestimonials = async () => {
    setTestimonialsLoading(true);
    setTestimonialsError("");
    try {
      const response = await reviewApi.getPublicReviews({ limit: 3 });
      const reviews = response?.reviews || response?.data || [];

      if (Array.isArray(reviews) && reviews.length > 0) {
        setLandingTestimonials(
          reviews.map((review, index) => ({
            name: review.customer_info?.full_name || `Khách hàng ${index + 1}`,
            role: "Khách hàng",
            content: review.general_comment || "Trải nghiệm dịch vụ rất tốt.",
            rating: review.general_rating || 5,
          })),
        );
      }
    } catch (error) {
      setTestimonialsError(error.message || "Không thể tải đánh giá khách hàng.");
    } finally {
      setTestimonialsLoading(false);
    }
  };

  useEffect(() => {
    loadRooms();
    loadServices();
    loadTestimonials();
  }, []);

  useEffect(() => {
    const loadNearbyPlaces = async () => {
      setNearbyLoading(true);
      setNearbyError("");
      try {
        const params = {
          page: 1,
          limit: 12,
          max_distance: 8000,
        };
        if (nearbyCategory) {
          params.category = nearbyCategory;
        }

        const response = await attractionApi.getAll(params);
        const attractions = response?.attractions || response?.data?.attractions || [];
        setNearbyTotal(Number(response?.total || response?.data?.total || attractions.length || 0));
        setNearbyPlaces(Array.isArray(attractions) ? attractions : []);
      } catch (error) {
        setNearbyPlaces([]);
        setNearbyTotal(0);
        setNearbyError(error.message || "Không thể tải địa điểm gần khách sạn.");
      } finally {
        setNearbyLoading(false);
      }
    };

    loadNearbyPlaces();
  }, [nearbyCategory]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchError("");
    if (!search.checkin || !search.checkout || search.adults === "" || search.children === "") {
      setSearchError("Vui lòng nhập ngày nhận phòng, ngày trả phòng, số người lớn và số trẻ em.");
      return;
    }
    if (search.checkin < todayInputValue) {
      setSearchError("Ngày nhận phòng không được nằm trong quá khứ.");
      return;
    }
    if (new Date(search.checkout) <= new Date(search.checkin)) {
      setSearchError("Ngày trả phòng phải sau ngày nhận phòng.");
      return;
    }
    if (Number(search.adults) < 1) {
      setSearchError("Số người lớn phải từ 1 trở lên.");
      return;
    }
    if (Number(search.children) < 0) {
      setSearchError("Số trẻ em không được nhỏ hơn 0.");
      return;
    }
    const params = new URLSearchParams(search).toString();
    navigate(`/hotel/rooms?${params}`);
  };

  return (
    <CustomerShell>
      <style>{`
        @keyframes slideLeftLoop {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes slideRightLoop {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        @keyframes fadeUpIn {
          0% { opacity: 0; transform: translateY(18px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .fade-up-in {
          animation: fadeUpIn 700ms ease both;
        }
        .fade-delay-1 { animation-delay: 120ms; }
        .fade-delay-2 { animation-delay: 240ms; }
        .hover-lift {
          transition: transform 320ms ease, box-shadow 320ms ease;
        }
        .hover-lift:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(28,25,23,0.14);
        }
        .hover-zoom-img {
          transition: transform 520ms ease;
        }
        .hover-zoom-wrap:hover .hover-zoom-img {
          transform: scale(1.05);
        }
        .nearby-place-card__imageWrap {
          width: 100%;
          aspect-ratio: 16 / 9;
          overflow: hidden;
          border-radius: 22px 22px 0 0;
          background: linear-gradient(135deg, #f5efe7, #e7d3b7);
        }
        .nearby-place-card__image {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .nearby-place-card__imageWrap--fallback {
          min-height: 160px;
        }
      `}</style>
      <section className="overflow-hidden bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.22),transparent_30%),linear-gradient(135deg,#1c1917_0%,#292524_46%,#92400e_100%)]">
        <div className="mx-auto max-w-7xl px-4 pb-12 pt-8 md:px-6 md:pb-16 md:pt-12">
          <div className="grid min-w-0 items-center gap-8 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)]">
            <div className="min-w-0 text-white">
              <StatusBadge tone="warning">SE Hotel nghỉ dưỡng cao cấp</StatusBadge>
              <h1 className="mt-6 max-w-3xl break-words text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
                Bắt đầu từ ngày lưu trú, chúng tôi gợi ý phòng phù hợp cho bạn
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-stone-200 md:text-lg">
                Chọn ngày nhận phòng, trả phòng và số khách để xem các hạng phòng phù hợp, giá mỗi đêm và tổng tiền tạm tính.
              </p>
              <div className="mt-8 flex min-w-0 flex-wrap gap-3 text-sm text-stone-200">
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2">
                  <MapPin size={16} />
                  <span className="truncate">Quận 1, TP. Hồ Chí Minh</span>
                </span>
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2">
                  <Star size={16} />
                  <span className="truncate">Đặt phòng nhanh và rõ giá</span>
                </span>
              </div>

              <div className="mt-8 rounded-[28px] border border-white/15 bg-white/8 p-4 backdrop-blur">
                <p className="text-sm leading-6 text-stone-200">
                  Khám phá phòng, dịch vụ và những trải nghiệm gần khách sạn trước khi đặt phòng.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => navigate("/hotel/rooms")}
                    className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100"
                  >
                    Xem phòng
                    <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/hotel/rooms")}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Đặt phòng ngay
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/hotel/bookings")}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Đặt phòng của tôi
                  </button>
                </div>
              </div>
            </div>

            <div className="grid min-w-0 max-w-full gap-4 overflow-hidden rounded-[34px] border border-white/15 bg-white/10 p-4 shadow-2xl backdrop-blur md:grid-cols-2">
              <HotelImage src={HOTEL_IMAGE_SETS.hero[0]} alt="Sảnh đón khách sang trọng tại SE Hotel" ratio="wide" fallbackLabel="Sảnh đón khách SE Hotel" className="min-w-0 rounded-[26px] md:col-span-2" overlay={false} />
              <HotelImage src={HOTEL_IMAGE_SETS.hero[1]} alt="Phòng nghỉ cao cấp với ánh sáng ấm áp" ratio="square" fallbackLabel="Phòng nghỉ cao cấp" className="min-w-0 rounded-[26px]" overlay={false} />
              <HotelImage src={HOTEL_IMAGE_SETS.hero[2]} alt="Khu vực thư giãn và tiếp khách của khách sạn" ratio="square" fallbackLabel="Khu vực thư giãn" className="min-w-0 rounded-[26px]" overlay={false} />
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <MetricStrip />
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-[0_18px_50px_rgba(28,25,23,0.08)]">
          <div className="border-b border-stone-200 bg-[linear-gradient(135deg,#fffaf0_0%,#ffffff_55%,#f8f5ef_100%)] px-6 py-6 md:px-8">
            <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">Khám phá gần khách sạn</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950 md:text-4xl">
                  Đi đâu gần SE Hotel?
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600 md:text-base">
                  Gợi ý những nơi dễ ghé để ăn uống, tham quan hoặc dạo chơi trong thời gian lưu trú.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/attractions")}
                className="inline-flex max-w-full items-center justify-center gap-2 self-start rounded-full border border-stone-300 bg-white px-5 py-3 text-center text-sm font-semibold leading-5 text-stone-800 transition hover:border-stone-400 hover:bg-stone-50"
              >
                Xem tất cả địa điểm
                <ArrowRight size={16} />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {nearbyCategoryChips.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => setNearbyCategory(chip.value)}
                  className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                    nearbyCategory === chip.value
                      ? "border-stone-950 bg-stone-950 text-white shadow-sm"
                      : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6 md:p-8">
            {nearbyLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm">
                    <div className="h-44 animate-pulse bg-stone-100" />
                    <div className="space-y-3 p-5">
                      <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
                      <div className="h-6 w-4/5 animate-pulse rounded bg-stone-100" />
                      <div className="h-4 w-full animate-pulse rounded bg-stone-100" />
                      <div className="h-4 w-2/3 animate-pulse rounded bg-stone-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : nearbyError ? (
              <div className="rounded-[28px] border border-stone-200 bg-white px-6 py-10 text-center shadow-sm">
                <p className="text-lg font-semibold text-stone-900">Chưa thể tải địa điểm gần khách sạn</p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">{nearbyError}</p>
              </div>
            ) : visibleNearbyPlaces.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {visibleNearbyPlaces.map((place) => {
                  const visual = getAttractionVisual(place);
                  const config = nearbyCategoryMeta[visual.category] || nearbyCategoryMeta.other;
                  const PlaceIcon = config.Icon;
                  const distanceText = Number(place.distance_km || 0) ? `${Number(place.distance_km).toFixed(1)} km` : "Gần khách sạn";
                  const imageSrc = getAttractionImage(place);

                  return (
                    <article
                      key={place._id || place.xid || place.name}
                      className="group flex min-w-0 flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_16px_40px_rgba(28,25,23,0.08)] transition hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(28,25,23,0.12)]"
                    >
                      <div className="nearby-place-card__imageWrap relative overflow-hidden">
                        <img
                          src={imageSrc}
                          alt={place.name}
                          className="nearby-place-card__image block aspect-[16/9] w-full object-cover transition duration-500 ease-out group-hover:scale-[1.04]"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            e.currentTarget.parentElement?.classList.add("nearby-place-card__imageWrap--fallback");
                          }}
                        />
                        <div className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-stone-800 shadow-sm backdrop-blur">
                          <PlaceIcon size={13} />
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
                            {place.name}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-stone-500">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-1 text-stone-700">
                              <MapPin size={11} />
                              {distanceText}
                            </span>
                            <span className="rounded-full bg-stone-100 px-2.5 py-1">{getNearbyDistanceLabel(place.distance_km)}</span>
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
                          {place.description || "Gợi ý gần SE Hotel để khách dễ ghé ăn uống, tham quan hoặc thư giãn."}
                        </p>

                        <div className="mt-auto flex items-center justify-end gap-3 pt-1">
                          <button
                            type="button"
                            onClick={() => navigate("/attractions")}
                            className="inline-flex shrink-0 items-center justify-center rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-white"
                          >
                            Khám phá
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-[28px] border border-dashed border-stone-300 bg-white/80 px-6 py-10 text-center shadow-sm">
                <p className="text-lg font-semibold text-stone-900">Chưa có địa điểm gần khách sạn</p>
                <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-stone-600">
                  Hệ thống hiện chưa có dữ liệu địa điểm đủ để hiển thị ở khu vực này.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-8 flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <SectionHeader eyebrow="Phòng nổi bật" title="Xem nhanh các hạng phòng đang được ưa chuộng" description="Khách có thể bắt đầu từ đây hoặc dùng trực tiếp bộ lọc tìm phòng phía trên." />
          <button onClick={() => navigate("/hotel/rooms")} className="inline-flex max-w-full items-center justify-center gap-2 self-start rounded-full border border-stone-300 bg-white px-5 py-3 text-center text-sm font-semibold leading-5 text-stone-800 transition hover:border-stone-400 hover:bg-stone-50">
            Xem tất cả phòng
            <ArrowRight size={16} />
          </button>
        </div>

        {loadingRooms ? (
          <LoadingCardGrid count={3} />
        ) : roomLoadError ? (
          <div className="rounded-[28px] border border-red-200 bg-red-50 px-6 py-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-red-800">Không tải được danh sách phòng</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-red-700">
              {roomLoadError}
            </p>
            <button
              type="button"
              onClick={loadRooms}
              className="mt-5 inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {featuredRooms.map((room, index) => {
              const roomAmenities = deriveAmenities(room);
              return (
                <article key={room._id} className="hover-lift fade-up-in flex h-full min-w-0 flex-col overflow-hidden rounded-[30px] border border-stone-200 bg-white shadow-[0_18px_50px_rgba(28,25,23,0.08)]">
                  <div className="hover-zoom-wrap overflow-hidden">
                    <HotelImage
                      src={room.images?.[0] || HOTEL_IMAGE_SETS.rooms[index % HOTEL_IMAGE_SETS.rooms.length]}
                      alt={`Hình ảnh phòng ${room.category_name}`}
                      ratio="wide"
                      fallbackLabel={`Phòng ${room.category_name}`}
                      className="hover-zoom-img shrink-0 rounded-none"
                      overlay={false}
                    />
                  </div>
                  <div className="flex flex-1 flex-col space-y-4 p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">SE Hotel</p>
                        <h3 className="mt-2 break-words text-2xl font-semibold leading-tight text-stone-950">{room.category_name}</h3>
                      </div>
                      <StatusBadge tone="success">Còn phòng</StatusBadge>
                    </div>
                    <div className="flex min-w-0 flex-wrap gap-2">
                      <AmenityPill>{room.max_adults} người lớn</AmenityPill>
                      <AmenityPill>{room.max_children} trẻ em</AmenityPill>
                      {(roomAmenities.length ? roomAmenities : ["Wi‑Fi", "Máy lạnh", "Phòng tắm riêng"]).map((item) => (
                        <AmenityPill key={item}>{item}</AmenityPill>
                      ))}
                    </div>
                    <div className="mt-auto flex flex-col gap-4 pt-2 sm:flex-row sm:items-end sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Giá từ</p>
                        <p className="break-words text-2xl font-semibold text-stone-950">{Number(room.price || 0).toLocaleString()} VNĐ</p>
                      </div>
                      <button
                        type="button"
                        disabled={!room._id}
                        onClick={() => {
                          if (!room._id) return;
                          navigate(`/hotel/book?categoryId=${room._id}`);
                        }}
                        className="inline-flex min-w-0 items-center justify-center rounded-2xl bg-stone-950 px-4 py-3 text-center text-sm font-semibold leading-5 text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Đặt phòng
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="dich-vu" className="bg-white/60 py-14">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mb-8">
            <SectionHeader eyebrow="Dịch vụ khách sạn" title="Dịch vụ giúp kỳ nghỉ trọn vẹn hơn" description="Tận hưởng các lựa chọn tiện ích được chuẩn bị cho cả chuyến đi nghỉ dưỡng và công tác." />
          </div>
          <div className="overflow-hidden rounded-[28px]">
            <div className="flex w-[200%] gap-6" style={{ animation: "slideLeftLoop 32s linear infinite" }}>
              {slidingServices.map((service, index) => {
              const ServiceIcon = service.icon;
              return (
                <article key={`${service.title}-${index}`} className="hover-lift fade-up-in fade-delay-1 w-[calc(50%-1rem)] min-w-[280px] flex-1 overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-sm md:min-w-[320px]">
                  <div className="hover-zoom-wrap overflow-hidden">
                    <HotelImage src={service.image} alt={service.title} ratio="wide" fallbackLabel={service.title} className="hover-zoom-img rounded-none" overlay={false} />
                  </div>
                  <div className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800">
                      <ServiceIcon size={22} />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-stone-950">{service.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-stone-600">{service.desc}</p>
                  </div>
                </article>
              );
            })}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 md:px-6">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="min-w-0 rounded-[32px] border border-stone-200 bg-white p-7 shadow-sm">
            <SectionHeader eyebrow="Tiện nghi" title="Không gian lưu trú tinh tế" description="Từ phòng nghỉ đến khu thư giãn, mọi chi tiết được sắp đặt để khách cảm thấy thoải mái." />
            <div className="mt-6 overflow-hidden rounded-2xl">
              <div className="flex w-[200%] gap-4" style={{ animation: "slideRightLoop 28s linear infinite" }}>
                {slidingAmenities.map((item, index) => (
                  <div key={`${item.title}-${index}`} className="hover-lift fade-up-in fade-delay-2 w-1/6 min-w-[180px] space-y-3">
                    <div className="hover-zoom-wrap overflow-hidden rounded-2xl">
                      <HotelImage src={item.image} alt={item.title} ratio="square" fallbackLabel={item.title} className="hover-zoom-img" overlay={false} />
                    </div>
                    <p className="text-sm font-medium text-stone-800">{item.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="min-w-0 rounded-[32px] border border-stone-200 bg-stone-950 p-7 text-white shadow-sm">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Vì sao chọn SE Hotel</p>
              <h2 className="break-words text-3xl font-semibold tracking-tight text-white md:text-4xl">Dịch vụ đáng tin cậy cho từng kỳ nghỉ</h2>
              <p className="mt-3 text-sm leading-7 text-stone-300 md:text-base">SE Hotel giữ trải nghiệm đặt phòng rõ ràng, thân thiện và nhất quán từ lúc chọn phòng đến khi nhận phòng.</p>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {landingTestimonials.map((item) => (
                <article key={`${item.name}-${item.content}`} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <div className="flex text-amber-300">
                    {Array.from({ length: item.rating || 5 }).map((_, idx) => <Star key={idx} size={14} fill="currentColor" />)}
                  </div>
                  <p className="mt-3 text-sm leading-6 text-stone-200">{item.content}</p>
                  <p className="mt-3 text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-stone-400">{item.role}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </CustomerShell>
  );
}
