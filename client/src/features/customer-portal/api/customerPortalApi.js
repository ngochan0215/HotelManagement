import axios from "axios";
import API_BASE_URL from "../../../config/apiConfig.js";
import { roomApi } from "../../api/roomApi.js";

const getAuthConfig = () => {
  const token = localStorage.getItem("token");
  return token ? { headers: { Authorization: `Bearer ${token}` } } : {};
};

const mapApiError = (error, fallbackMessage) => {
  const message = error?.response?.data?.message || error?.message;
  throw new Error(message || fallbackMessage);
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

const extractRoomList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.rooms)) return payload.rooms;
  return null;
};

const normalizeRoomCategory = (room, search = {}, categoryMap = {}) => {
  const categoryId = room._id || room.category_id || room.id;
  const category = categoryMap[String(categoryId)] || {};
  const price = Number(room.price ?? category.price ?? 0);
  const normalized = {
    ...category,
    ...room,
    categoryId,
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
    roomId: room.room_id || room.roomId || room.id || null,
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
      const rooms = extractRoomList(data);
      if (!rooms) {
        throw new Error("Dữ liệu loại phòng không hợp lệ.");
      }
      return {
        rooms: rooms.map((room) => normalizeRoomCategory(room)),
        isFallback: false,
      };
    } catch (error) {
      mapApiError(error, "Không thể tải danh sách loại phòng.");
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

      const response = await roomApi.getAvailableBy(params);
      const rooms = extractRoomList(response);
      if (!rooms) {
        throw new Error("Dữ liệu phòng khả dụng không hợp lệ.");
      }
      const normalized = rooms.map((room) => normalizeRoomCategory(room, search));
      return {
        rooms: filterRooms(normalized, search),
        isFallback: false,
      };
    } catch (error) {
      mapApiError(error, "Không thể tải danh sách phòng phù hợp.");
    }
  },

  async getRoomById(id) {
    try {
      const room = await roomApi.getCategoryById(id);
      if (!room) {
        throw new Error("Không tìm thấy loại phòng.");
      }
      return { room: normalizeRoomCategory(room), isFallback: false };
    } catch (error) {
      mapApiError(error, "Không thể tải thông tin phòng.");
    }
  },

  async getBookingAddOns() {
    try {
      const response = await axios.get(`${API_BASE_URL}/services`, {
        params: { limit: 100, status: "active", service_type: "rental,experience" },
        ...getAuthConfig(),
      });
      const rawServices =
        response.data?.services ||
        response.data?.data?.services ||
        response.data?.data ||
        [];
      const services = rawServices.map((item) => ({
        id: item._id,
        name: item.name,
        price: Number(item.price || 0),
        description: item.description || "",
      })).filter((item) => item.id && item.name);
      return { services, isFallback: false };
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        return { services: [], isFallback: true, reason: "Dịch vụ thêm yêu cầu quyền truy cập phù hợp." };
      }
      return { services: [], isFallback: true, reason: "Chưa tải được danh sách dịch vụ thêm." };
    }
  },

  async createBooking(payload) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/bookings/customer`,
        payload,
        getAuthConfig(),
      );
      return {
        success: true,
        bookingId: response.data?.booking_id,
        booking: response.data,
        deposit: response.data?.deposit,
        isFallback: false,
      };
    } catch (error) {
      mapApiError(error, "Không thể tạo booking. Vui lòng thử lại.");
    }
  },

  async lookupBookings({ bookingCode, email, phone }) {
    try {
      const response = await axios.get(`${API_BASE_URL}/bookings/my`, {
        params: { page: 1, limit: 50 },
        ...getAuthConfig(),
      });
      console.log("Lookup bookings response:", response);
      const bookings = response.data?.bookings || [];
      const filtered = bookings.filter((item) => {
        const byCode = bookingCode ? String(item._id || "").toLowerCase() === bookingCode.toLowerCase() : true;
        // const byEmail = email ? String(item.customer_email || "").toLowerCase() === email.toLowerCase() : true;
        // const byPhone = phone ? String(item.customer_phone || "") === phone : true;
        return byCode;
      });
      return { bookings: filtered, isFallback: false };
    } catch (error) {
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        throw new Error("Bạn cần đăng nhập tài khoản khách hàng để xem lịch sử đặt phòng.");
      }
      mapApiError(error, "Không thể tra cứu lịch sử đặt phòng lúc này.");
    }
  },

  async getMyBookings(params = {}) {
    try {
      const response = await axios.get(`${API_BASE_URL}/bookings/my`, {
        params,
        ...getAuthConfig(),
      });
      return response.data;
    } catch (error) {
      mapApiError(error, "Không thể tải danh sách đặt phòng.");
    }
  },

  async getMyBookingDetail(bookingId) {
    try {
      const response = await axios.get(`${API_BASE_URL}/bookings/my/${bookingId}`, getAuthConfig());
      return response.data;
    } catch (error) {
      mapApiError(error, "Không thể tải chi tiết đặt phòng.");
    }
  },

  async getMyProfile() {
    try {
      const response = await axios.get(`${API_BASE_URL}/customers/me`, getAuthConfig());
      return response.data;
    } catch (error) {
      mapApiError(error, "Không thể tải hồ sơ khách hàng.");
    }
  },

  async updateMyProfile(payload) {
    try {
      const response = await axios.patch(`${API_BASE_URL}/customers/me`, payload, getAuthConfig());
      return response.data;
    } catch (error) {
      mapApiError(error, "Không thể cập nhật hồ sơ khách hàng.");
    }
  },

  async getAvailableDiscounts(orderValue = 0) {
    try {
      const response = await axios.get(`${API_BASE_URL}/discounts/available`, {
        params: { orderValue },
      });
      return response.data?.discounts || [];
    } catch {
      return [];
    }
  },

  calculateNights,
};
