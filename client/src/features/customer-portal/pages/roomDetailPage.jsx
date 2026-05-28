import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CalendarDays, CheckCircle2, ShieldCheck, Users } from "lucide-react";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import { HOTEL_IMAGE_SETS } from "../components/imageCatalog.js";
import {
  AmenityPill,
  EmptyState,
  HotelImage,
  SectionHeader,
  StatusBadge,
} from "../components/sitePrimitives.jsx";

export default function RoomDetailPage() {
  const { roomId } = useParams();
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setError("");
      try {
        const { room: data } = await customerPortalApi.getRoomById(roomId);
        setRoom(data);
      } catch (e) {
        setError(e.message || "Không thể tải thông tin phòng.");
      }
    };
    load();
  }, [roomId]);

  const amenities = useMemo(
    () =>
      (room?.default_equipments || [])
        .map((item) => item.equipment_category?.name)
        .filter(Boolean),
    [room],
  );

  if (error) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
          <EmptyState title="Không tải được chi tiết phòng" description={error} />
        </section>
      </CustomerShell>
    );
  }

  if (!room) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <HotelImage src={HOTEL_IMAGE_SETS.rooms[0]} alt="Đang tải bộ sưu tập phòng" ratio="wide" fallbackLabel="Đang tải bộ sưu tập phòng..." className="animate-pulse" />
            <div className="space-y-4 rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="h-4 w-24 animate-pulse rounded bg-stone-100" />
              <div className="h-10 w-2/3 animate-pulse rounded bg-stone-100" />
              <div className="h-4 w-full animate-pulse rounded bg-stone-100" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-stone-100" />
            </div>
          </div>
        </section>
      </CustomerShell>
    );
  }

  const fallbackGallery = HOTEL_IMAGE_SETS.rooms;
  const gallery = room.images?.length ? room.images : fallbackGallery;

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="mb-8 flex flex-wrap items-center gap-3">
          <StatusBadge tone="warning">Phòng nổi bật tại SE Hotel</StatusBadge>
          <StatusBadge tone="success">Còn phòng</StatusBadge>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
          <div className="min-w-0 space-y-6">
            <SectionHeader title={room.category_name} description={room.description} />

            <div className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <HotelImage src={gallery[0]} alt={`Ảnh chính phòng ${room.category_name}`} ratio="wide" fallbackLabel={`Phòng ${room.category_name}`} />
              <div className="grid gap-4">
                <HotelImage src={gallery[1] || fallbackGallery[1]} alt={`Góc nhìn thứ hai của phòng ${room.category_name}`} ratio="landscape" fallbackLabel="Không gian phòng nghỉ" />
                <HotelImage src={gallery[2] || fallbackGallery[2]} alt={`Tiện nghi của phòng ${room.category_name}`} ratio="landscape" fallbackLabel="Tiện nghi đi kèm" />
              </div>
            </div>

            <div className="rounded-[30px] border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold text-stone-950">Tiện nghi phòng</h2>
              <div className="mt-5 flex min-w-0 flex-wrap gap-2">
                <AmenityPill>{room.max_adults} người lớn</AmenityPill>
                <AmenityPill>{room.max_children} trẻ em</AmenityPill>
                {(amenities.length ? amenities : ["Wi‑Fi tốc độ cao", "Máy lạnh", "Bàn làm việc", "Phòng tắm riêng"]).map((item) => (
                  <AmenityPill key={item}>{item}</AmenityPill>
                ))}
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-stone-50 p-4">
                  <Users className="text-amber-700" size={20} />
                  <p className="mt-3 text-sm text-stone-500">Sức chứa</p>
                  <p className="break-words text-lg font-semibold text-stone-900">{room.max_adults + room.max_children} khách</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <CalendarDays className="text-amber-700" size={20} />
                  <p className="mt-3 text-sm text-stone-500">Loại lưu trú</p>
                  <p className="break-words text-lg font-semibold text-stone-900">Nghỉ dưỡng / công tác</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-4">
                  <ShieldCheck className="text-amber-700" size={20} />
                  <p className="mt-3 text-sm text-stone-500">Trạng thái</p>
                  <p className="break-words text-lg font-semibold text-stone-900">Sẵn sàng đặt phòng</p>
                </div>
              </div>
            </div>
          </div>

          <aside className="h-fit min-w-0 rounded-[30px] border border-stone-200 bg-white p-6 shadow-[0_18px_48px_rgba(28,25,23,0.08)] lg:sticky lg:top-28">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-stone-400">Giá mỗi đêm</p>
            <p className="mt-3 break-words text-3xl font-semibold text-stone-950 md:text-4xl">{Number(room.price || 0).toLocaleString()} VNĐ</p>
            <p className="mt-2 text-sm leading-7 text-stone-600">Giá tham khảo cho mỗi đêm lưu trú, chưa bao gồm dịch vụ tùy chọn.</p>

            <div className="mt-6 space-y-3 rounded-[26px] bg-amber-50 p-5 text-sm leading-7 text-stone-700">
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="shrink-0 text-amber-700" />
                <span>Xem ảnh và tiện nghi trước khi đặt</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="shrink-0 text-amber-700" />
                <span>Hỗ trợ xác nhận thông tin nhanh chóng</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 size={18} className="shrink-0 text-amber-700" />
                <span>Phù hợp cho cả nghỉ dưỡng và công tác</span>
              </div>
            </div>

            <Link to={`/hotel/book?roomId=${room._id}`} className="mt-6 inline-flex w-full min-w-0 items-center justify-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-center text-sm font-semibold leading-5 text-white transition hover:bg-stone-800">
              Đặt phòng ngay
              <ArrowRight size={16} />
            </Link>
          </aside>
        </div>
      </section>
    </CustomerShell>
  );
}
