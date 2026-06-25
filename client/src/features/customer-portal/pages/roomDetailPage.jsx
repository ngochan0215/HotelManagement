import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight } from "lucide-react";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import { AmenityPill, EmptyState } from "../components/sitePrimitives.jsx";

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

function isNotFoundError(message) {
  const text = String(message || "").toLowerCase();
  return text.includes("không tìm thấy") || text.includes("not found");
}

function buildBookingUrl(roomId, search) {
  const params = new URLSearchParams(search);
  params.set("roomId", roomId);
  return `/hotel/book?${params.toString()}`;
}

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const location = useLocation();
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const isMountedRef = useRef(true);
  const preloadCacheRef = useRef(new Map());
  const transitionTimerRef = useRef(null);
  const transitionLockRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    isMountedRef.current = true;

    const load = async () => {
      if (!roomId) {
        if (!mounted) return;
        setLoading(false);
        setNotFound(true);
        return;
      }

      setLoading(true);
      setError("");
      setNotFound(false);

      try {
        const { room: data } = await customerPortalApi.getRoomById(roomId);
        if (!mounted) return;
        setRoom(data || null);
      } catch (e) {
        if (!mounted) return;
        const message = e.message || "Không thể tải thông tin phòng.";
        setRoom(null);
        if (isNotFoundError(message)) {
          setNotFound(true);
        } else {
          setError(message);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
      isMountedRef.current = false;
    };
  }, [roomId, retryCount]);

  const images = useMemo(
    () => (Array.isArray(room?.images) ? room.images.filter(Boolean) : []),
    [room],
  );

  const amenities = useMemo(
    () =>
      (room?.default_equipments || [])
        .map((item) => item?.equipment_category?.name)
        .filter(Boolean),
    [room],
  );

  useEffect(() => {
    setActiveImageIndex(0);
    setShowAllAmenities(false);
    setIsTransitioning(false);
    transitionLockRef.current = false;
  }, [roomId]);

  useEffect(() => {
    images.forEach((src) => {
      void preloadImage(src);
    });
  }, [images]);

  useEffect(
    () => () => {
      if (transitionTimerRef.current) {
        window.clearTimeout(transitionTimerRef.current);
      }
      transitionLockRef.current = false;
    },
    [],
  );

  const capacityText = useMemo(() => {
    const adults = toNumber(room?.max_adults);
    const children = toNumber(room?.max_children);

    if (!adults && !children) return "";
    if (adults && children) return `${adults} người lớn · ${children} trẻ em`;
    if (adults) return `Tối đa ${adults} khách`;
    return `Tối đa ${children} khách`;
  }, [room]);

  const priceText = room?.price ? `${Number(room.price).toLocaleString()} VNĐ/đêm` : "";
  const visibleAmenities = showAllAmenities ? amenities : amenities.slice(0, 6);
  const bookingHref = room?._id ? buildBookingUrl(room._id, location.search) : "";
  const mainImage = images[activeImageIndex] || "";
  const hasMultipleImages = images.length > 1;

  function preloadImage(src) {
    if (!src) return Promise.resolve(false);

    const cached = preloadCacheRef.current.get(src);
    if (cached) return cached;

    const promise = new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = src;
    });

    preloadCacheRef.current.set(src, promise);
    return promise;
  }

  async function changeImage(direction) {
    if (!hasMultipleImages || transitionLockRef.current) return;
    transitionLockRef.current = true;
    setIsTransitioning(true);

    const nextIndex =
      direction === "prev"
        ? (activeImageIndex - 1 + images.length) % images.length
        : (activeImageIndex + 1) % images.length;
    const nextSrc = images[nextIndex];
    const isLoaded = await preloadImage(nextSrc);

    if (!isMountedRef.current) return;

    if (!isLoaded) {
      transitionLockRef.current = false;
      setIsTransitioning(false);
      return;
    }

    setActiveImageIndex(nextIndex);

    if (transitionTimerRef.current) {
      window.clearTimeout(transitionTimerRef.current);
    }

    transitionTimerRef.current = window.setTimeout(() => {
      if (isMountedRef.current) {
        setIsTransitioning(false);
        transitionLockRef.current = false;
      }
    }, 300);
  }

  const goPrevImage = () => {
    void changeImage("prev");
  };

  const goNextImage = () => {
    void changeImage("next");
  };

  if (loading) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <style>{`
            .room-detail-gallery {
              width: 100%;
            }
            .room-detail-image-shell {
              position: relative;
              width: 100%;
            }
            .room-detail-image-surface {
              position: relative;
              width: 100%;
              aspect-ratio: 16 / 10;
              max-height: 480px;
              overflow: hidden;
              border-radius: 28px;
              background: #f3efe8;
            }
            .room-detail-image-surface > img,
            .room-detail-main-image {
              width: 100%;
              height: 100%;
              display: block;
              object-fit: cover;
            }
            .room-detail-main-image-empty {
              display: flex;
              width: 100%;
              height: 100%;
              align-items: center;
              justify-content: center;
              color: #78716c;
              font-size: 0.875rem;
              font-weight: 500;
            }
            .room-detail-image-transition {
              animation: roomDetailFade 240ms ease both;
            }
            .room-detail-carousel-button {
              position: absolute;
              top: 50%;
              z-index: 2;
              display: inline-flex;
              height: 48px;
              width: 48px;
              align-items: center;
              justify-content: center;
              border-radius: 9999px;
              border: 1px solid rgba(255, 255, 255, 0.7);
              background: rgba(28, 25, 23, 0.58);
              color: #fff;
              box-shadow: 0 10px 24px rgba(28, 25, 23, 0.24);
              transform: translateY(-50%);
              transition: background-color 180ms ease, transform 180ms ease;
            }
            .room-detail-carousel-button:hover {
              background: rgba(28, 25, 23, 0.78);
            }
            .room-detail-carousel-prev {
              left: 16px;
            }
            .room-detail-carousel-next {
              right: 16px;
            }
            .room-detail-carousel-indicator {
              position: absolute;
              bottom: 14px;
              right: 14px;
              z-index: 2;
              border-radius: 9999px;
              background: rgba(28, 25, 23, 0.62);
              color: #fff;
              font-size: 0.75rem;
              font-weight: 600;
              line-height: 1;
              padding: 0.5rem 0.75rem;
              backdrop-filter: blur(10px);
            }
            @keyframes roomDetailFade {
              from {
                opacity: 0;
                transform: scale(0.995);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
            @media (max-width: 768px) {
              .room-detail-image-surface {
                aspect-ratio: 4 / 3;
                max-height: 360px;
                border-radius: 22px;
              }
              .room-detail-carousel-button {
                height: 42px;
                width: 42px;
              }
              .room-detail-carousel-prev {
                left: 12px;
              }
              .room-detail-carousel-next {
                right: 12px;
              }
            }
          `}</style>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
            <div className="space-y-4">
              <div className="h-4 w-24 animate-pulse rounded-full bg-stone-200" />
              <div className="h-10 w-2/3 animate-pulse rounded-2xl bg-stone-200" />
              <div className="h-4 w-full animate-pulse rounded-full bg-stone-200" />
              <div className="room-detail-gallery">
                <div className="room-detail-image-surface animate-pulse bg-stone-200" />
              </div>
            </div>
            <div className="h-[320px] rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm" />
          </div>
        </section>
      </CustomerShell>
    );
  }

  if (notFound) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <EmptyState title="Không tìm thấy phòng này." description="Phòng có thể đã bị xóa hoặc liên kết không còn hợp lệ." />
        </section>
      </CustomerShell>
    );
  }

  if (error) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <div className="rounded-[30px] border border-red-200 bg-red-50 px-6 py-8 text-center shadow-sm">
            <p className="text-lg font-semibold text-red-800">Không thể tải thông tin phòng.</p>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => setRetryCount((count) => count + 1)}
              className="mt-5 inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              Thử lại
            </button>
          </div>
        </section>
      </CustomerShell>
    );
  }

  if (!room) return null;

  return (
    <CustomerShell>
      <style>{`
        .room-detail-gallery {
          width: 100%;
        }
        .room-detail-image-shell {
          position: relative;
          width: 100%;
        }
        .room-detail-image-surface {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          max-height: 480px;
          overflow: hidden;
          border-radius: 28px;
          background: #f3efe8;
        }
        .room-detail-image-surface > img,
        .room-detail-main-image {
          width: 100%;
          height: 100%;
          display: block;
          object-fit: cover;
        }
        .room-detail-main-image-empty {
          display: flex;
          width: 100%;
          height: 100%;
          align-items: center;
          justify-content: center;
          color: #78716c;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .room-detail-image-transition {
          animation: roomDetailFade 240ms ease both;
        }
        .room-detail-carousel-button {
          position: absolute;
          top: 50%;
          z-index: 2;
          display: inline-flex;
          height: 48px;
          width: 48px;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          border: 1px solid rgba(255, 255, 255, 0.7);
          background: rgba(28, 25, 23, 0.58);
          color: #fff;
          box-shadow: 0 10px 24px rgba(28, 25, 23, 0.24);
          transform: translateY(-50%);
          transition: background-color 180ms ease, transform 180ms ease;
        }
        .room-detail-carousel-button:hover {
          background: rgba(28, 25, 23, 0.78);
        }
        .room-detail-carousel-prev {
          left: 16px;
        }
        .room-detail-carousel-next {
          right: 16px;
        }
        .room-detail-carousel-indicator {
          position: absolute;
          bottom: 14px;
          right: 14px;
          z-index: 2;
          border-radius: 9999px;
          background: rgba(28, 25, 23, 0.62);
          color: #fff;
          font-size: 0.75rem;
          font-weight: 600;
          line-height: 1;
          padding: 0.5rem 0.75rem;
          backdrop-filter: blur(10px);
        }
        @keyframes roomDetailFade {
          from {
            opacity: 0;
            transform: scale(0.995);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        @media (max-width: 768px) {
          .room-detail-image-surface {
            aspect-ratio: 4 / 3;
            max-height: 360px;
            border-radius: 22px;
          }
          .room-detail-carousel-button {
            height: 42px;
            width: 42px;
          }
          .room-detail-carousel-prev {
            left: 12px;
          }
          .room-detail-carousel-next {
            right: 12px;
          }
        }
      `}</style>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="min-w-0 space-y-8">
            <header className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Hạng phòng</p>
              <div className="space-y-3">
                <h1 className="break-words text-3xl font-semibold tracking-tight text-stone-950 md:text-5xl">
                  {room.category_name}
                </h1>
                <p className="max-w-3xl break-words text-sm leading-7 text-stone-600 md:text-base line-clamp-2">
                  {room.description || "Chưa có mô tả."}
                </p>
              </div>

              <div className="flex min-w-0 flex-wrap gap-2">
                {capacityText ? <AmenityPill>{capacityText}</AmenityPill> : null}
                {room.price ? <AmenityPill>{priceText}</AmenityPill> : null}
                {!capacityText && !room.price ? <span className="text-sm text-stone-500">Đang cập nhật thông tin phòng.</span> : null}
              </div>
            </header>

            <div className="room-detail-gallery">
              <div className="room-detail-image-shell">
                {mainImage ? (
                  <div className="room-detail-image-surface border border-stone-200 shadow-sm">
                    <img
                      key={`${mainImage}-${activeImageIndex}`}
                      src={mainImage}
                      alt={room.category_name ? `Ảnh phòng ${room.category_name}` : "Ảnh phòng"}
                      loading="eager"
                      fetchPriority="high"
                      draggable="false"
                      className={`room-detail-main-image ${isTransitioning ? "room-detail-image-transition" : ""}`}
                    />
                    {hasMultipleImages ? (
                      <>
                        <button
                          type="button"
                          onClick={goPrevImage}
                          className="room-detail-carousel-button room-detail-carousel-prev"
                          aria-label="Ảnh trước"
                          disabled={isTransitioning}
                        >
                          <ArrowLeft size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={goNextImage}
                          className="room-detail-carousel-button room-detail-carousel-next"
                          aria-label="Ảnh tiếp theo"
                          disabled={isTransitioning}
                        >
                          <ArrowRight size={20} />
                        </button>
                        <div className="room-detail-carousel-indicator">
                          {activeImageIndex + 1} / {images.length}
                        </div>
                      </>
                    ) : null}
                  </div>
                ) : (
                  <div className="room-detail-image-surface border border-stone-200 shadow-sm">
                    <div className="room-detail-main-image-empty">Chưa có hình ảnh phòng</div>
                  </div>
                )}
              </div>
            </div>

            <section className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold text-stone-950">Tiện nghi nổi bật</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-500">
                    {amenities.length ? `Hiển thị ${visibleAmenities.length} trong ${amenities.length} tiện nghi.` : "Chưa có thông tin tiện nghi."}
                  </p>
                </div>
                {amenities.length > 6 ? (
                  <button
                    type="button"
                    onClick={() => setShowAllAmenities((value) => !value)}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
                  >
                    {showAllAmenities ? "Thu gọn" : "Xem thêm tiện nghi"}
                  </button>
                ) : null}
              </div>

              <div className="mt-5 flex min-w-0 flex-wrap gap-2">
                {visibleAmenities.length ? (
                  visibleAmenities.map((item) => <AmenityPill key={item}>{item}</AmenityPill>)
                ) : (
                  <span className="text-sm text-stone-600">Chưa có thông tin tiện nghi.</span>
                )}
              </div>
            </section>
          </div>

          <aside className="h-fit min-w-0 rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_18px_48px_rgba(28,25,23,0.08)] lg:sticky lg:top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Giá mỗi đêm</p>
            <p className="mt-3 break-words text-3xl font-semibold text-stone-950 md:text-4xl">
              {priceText || "Xem giá theo ngày"}
            </p>
            <p className="mt-2 text-sm leading-7 text-stone-600">
              {room.price ? "Giá tham khảo cho mỗi đêm lưu trú." : "Giá sẽ được xác nhận theo ngày lưu trú."}
            </p>

            <div className="mt-6 space-y-3 rounded-[26px] bg-stone-50 p-5 text-sm leading-7 text-stone-700">
              <div className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-stone-900" />
                <span>{capacityText || "Chưa có thông tin sức chứa."}</span>
              </div>
              {location.search ? (
                <div className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-stone-900" />
                  <span>Giữ nguyên ngày lưu trú khi tiếp tục đặt phòng.</span>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <span className="mt-2 h-2 w-2 rounded-full bg-stone-900" />
                  <span>Chọn ngày lưu trú ở bước tiếp theo.</span>
                </div>
              )}
              <div className="flex items-start gap-3">
                <span className="mt-2 h-2 w-2 rounded-full bg-stone-900" />
                <span>Giá có thể thay đổi theo ngày lưu trú.</span>
              </div>
            </div>

            <Link
              to={bookingHref}
              className="mt-6 inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-center text-sm font-semibold leading-5 text-white transition hover:bg-stone-800"
            >
              Đặt phòng ngay
              <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
      </section>
    </CustomerShell>
  );
}
