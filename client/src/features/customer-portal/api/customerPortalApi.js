import axios from "axios";
import API_BASE_URL from "../../../config/apiConfig.js";
import { roomApi } from "../../api/roomApi.js";

const MOCK_BOOKINGS_KEY = "customer_demo_bookings_v2";

// TODO: Remove fallback room categories after the public room category API is guaranteed in all demo environments.
const FALLBACK_ROOM_CATEGORIES = [
  {
    _id: "fallback-deluxe",
    category_name: "Phòng Deluxe",
    description: "Không gian nghỉ dưỡng thanh lịch, phù hợp cho chuyến đi ngắn ngày.",
    max_adults: 2,
    max_children: 1,
    price: 1200000,
    images: [],
    default_equipments: [],
  },
  {
    _id: "fallback-suite",
    category_name: "Suite hướng phố",
    description: "Hạng phòng rộng rãi với khu tiếp khách riêng và tiện nghi cao cấp.",
    max_adults: 3,
    max_children: 1,
    price: 2200000,
    images: [],
    default_equipments: [],
  },
  {
    _id: "fallback-family",
    category_name: "Phòng gia đình",
    description: "Lựa chọn thoải mái cho gia đình với trẻ em và kỳ nghỉ dài ngày.",
    max_adults: 4,
    max_children: 2,
    price: 2800000,
    images: [],
    default_equipments: [],
  },
];

const MOCK_ADD_ONS = [
  { id: "airport-transfer", name: "Đưa đón sân bay", price: 320000, description: "Đón/trả sân bay riêng cho khách lưu trú." },
  { id: "breakfast", name: "Ăn sáng", price: 180000, description: "Buffet sáng phục vụ mỗi khách / mỗi ngày." },
  { id: "spa", name: "Spa thư giãn", price: 650000, description: "Liệu trình thư giãn 60 phút tại khách sạn." },
  { id: "laundry", name: "Giặt ủi", price: 120000, description: "Gói giặt ủi nhanh trong ngày." },
  { id: "decor", name: "Trang trí phòng", price: 450000, description: "Trang trí sinh nhật / kỷ niệm theo yêu cầu." },
];

const getMockBookings = () => {
  // TODO: Replace localStorage booking store with real customer booking APIs.
  const raw = localStorage.getItem(MOCK_BOOKINGS_KEY);
  return raw ? JSON.parse(raw) : [];
};

const saveMockBookings = (bookings) => {
  // TODO: Replace localStorage booking store with real customer booking APIs.
  localStorage.setItem(MOCK_BOOKINGS_KEY, JSON.stringify(bookings));
};

const calculateNights = (checkin, checkout) => {
  if (!checkin || !checkout) return 1;
  const start = new Date(checkin);
  const end = new Date(checkout);
  const diff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
};

const estimateRoomTotal = (room, search) => {
  const nights = calculateNights(search?.checkin, search?.checkout);
  return Number(room?.price || 0) * nights;
};

const normalizeRoomCategory = (room, search = {}, categoryMap = {}) => {
  const categoryId = room._id || room.category_id || room.id;
  const category = categoryMap[String(categoryId)] || {};
  const price = Number(room.price ?? category.price ?? 0);
  const normalized = {
    ...category,
    ...room,
    _id: categoryId,
    category_name: room.category_name || room.name || category.category_name || "Hạng phòng SE Hotel",
    description: room.description || category.description || "Không gian lưu trú tiện nghi tại SE Hotel.",
    max_adults: Number(room.max_adults ?? room.adults ?? category.max_adults ?? 0),
    max_children: Number(room.max_children ?? room.children ?? category.max_children ?? 0),
    price,
    images: room.images?.length ? room.images : category.images || [],
    default_equipments: room.default_equipments || category.default_equipments || [],
    available_rooms_count: Number(room.available_rooms_count ?? room.availableRooms ?? room.rooms?.length ?? 0),
    available_rooms: room.available_rooms || room.rooms || [],
  };

  return {
    ...normalized,
    estimated_total: Number(room.estimated_total || 0) || estimateRoomTotal(normalized, search),
  };
};

const filterRooms = (rooms, search = {}) =>
  rooms.filter((room) => {
    const adults = Number(search.adults || 1);
    const children = Number(search.children || 0);
    const keyword = (search.roomType || "").trim().toLowerCase();
    const adultMatch = Number(room.max_adults || 0) >= adults;
    const childMatch = Number(room.max_children || 0) >= children;
    const typeMatch = keyword
      ? room._id?.toLowerCase() === keyword || room.category_name?.toLowerCase().includes(keyword)
      : true;
    return adultMatch && childMatch && typeMatch;
  });

export const customerPortalApi = {
  async getRooms() {
    try {
      const data = await roomApi.getAllCategories();
      const rooms = Array.isArray(data) ? data : [];
      return { rooms, isFallback: false };
    } catch (error) {
      return { rooms: FALLBACK_ROOM_CATEGORIES, isFallback: true };
    }
  },

  async searchRooms(search = {}) {
    try {
      const params = {
        checkin: search.checkin,
        checkout: search.checkout,
        adults: search.adults,
        children: search.children,
      };
      if (search.minPrice) params.minPrice = search.minPrice;
      if (search.maxPrice || search.priceLimit) params.maxPrice = search.maxPrice || search.priceLimit;

      const [{ rooms: categories }, response] = await Promise.all([
        this.getRooms(),
        axios.get(`${API_BASE_URL}/rooms/categories/available-by`, { params }),
      ]);
      const categoryMap = Object.fromEntries(categories.map((item) => [String(item._id), item]));
      const rooms = Array.isArray(response.data) ? response.data : response.data?.data || response.data?.rooms || [];
      if (rooms.length) {
        const normalized = rooms.map((room) => normalizeRoomCategory(room, search, categoryMap));
        return {
          rooms: filterRooms(normalized, search),
          isFallback: false,
        };
      }
    } catch {
      // TODO: Remove local filtering fallback after public availability API is stable.
    }

    const { rooms } = await this.getRooms();
    const filtered = filterRooms(rooms, search).map((room) => ({
      ...room,
      estimated_total: estimateRoomTotal(room, search),
    }));
    return { rooms: filtered, isFallback: true };
  },

  async getRoomById(id) {
    try {
      const room = await roomApi.getCategoryById(id);
      return { room, isFallback: false };
    } catch {
      const { rooms } = await this.getRooms();
      const room = rooms.find((item) => item._id === id);
      if (!room) throw new Error("Không tìm thấy loại phòng.");
      // TODO: Remove fallback room detail from list once dedicated endpoint is guaranteed.
      return { room, isFallback: true };
    }
  },

  async getBookingAddOns() {
    // TODO: Replace mock add-ons with public service add-on API for booking flow.
    return { services: MOCK_ADD_ONS, isFallback: true };
  },

  async createBooking(payload) {
    // TODO: Replace localStorage fallback with POST /bookings/customer or POST /bookings/public.
    const bookings = getMockBookings();
    const booking = {
      id: `DEMO-${Date.now()}`,
      booking_code: `SE${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: "pending",
      ...payload,
    };
    bookings.unshift(booking);
    saveMockBookings(bookings);
    return { success: true, bookingId: booking.booking_code, booking, isFallback: true };
  },

  async createDepositPayment(payload) {
    // TODO: Integrate real customer deposit/payment API when public payment flow exists.
    return {
      success: true,
      payment_reference: `PAY-${Date.now()}`,
      isFallback: true,
      ...payload,
    };
  },

  async lookupBookings({ bookingCode, email, phone }) {
    // TODO: Integrate real endpoint: GET /bookings/public-lookup or /bookings/my-bookings.
    const bookings = getMockBookings().filter((item) => {
      const byCode = bookingCode ? (item.booking_code || item.id)?.toLowerCase() === bookingCode.toLowerCase() : true;
      const byEmail = email ? item.customer_email?.toLowerCase() === email.toLowerCase() : true;
      const byPhone = phone ? item.customer_phone === phone : true;
      return byCode && byEmail && byPhone;
    });
    return { bookings, isFallback: true };
  },

  calculateNights,
};
