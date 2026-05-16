import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/bookings`;
const CLEANING_BASE = `${API_BASE_URL}/cleaning-tasks`;

export const bookingApi = {
    getCancellationReasonStats: async (params = {}) => {
        const res = await axios.get(`${BASE_URL}/statistics/cancellation-reasons`,
            {
                ...getAuthHeader(),
                params,
            },
        );
        return res.data;
    },

    getWeeklyRevenue: async () => {
        const res = await axios.get(`${BASE_URL}/statistics/revenue-week`, getAuthHeader());
        return res.data;
    },

    getWeeklyBookings: async () => {
        const res = await axios.get(`${BASE_URL}/statistics/bookings-week`, getAuthHeader());
        return res.data;
    },
    
    getMonthlyBookings: async () => {
        const res = await axios.get(`${BASE_URL}/statistics/bookings-month`, getAuthHeader());
        return res.data;
    },

    createBooking: async (data) => {
        const res = await axios.post(`${BASE_URL}/`, data, getAuthHeader());
        return res.data;
    },

    updateBookingStatus: async (bookingId, status) => {
        const res = await axios.patch(
            `${BASE_URL}/update-status/${bookingId}`,
            null,
            {
                ...getAuthHeader(),
                params: { status },
            }
        );
        return res.data;
    },

    getAllBookings: async () => {
        const res = await axios.get(`${BASE_URL}/`, getAuthHeader());
        const d = res.data;
        return { ...d, result: d.bookings ?? d.result };
    },

    confirmBooking: async (bookingId) => {
        const res = await axios.patch(`${BASE_URL}/confirm-deposited/${bookingId}`, {}, getAuthHeader());
        return res.data;
    },

    checkinBookingDetail: async (bookingId, detailId) => {
        const res = await axios.post(
            `${BASE_URL}/${bookingId}/details/${detailId}/checkin`,
            {},
            getAuthHeader()
        );
        return res.data;
    },
    checkoutBookingDetail: async (bookingId, detailId) => {
        const res = await axios.post(
            `${BASE_URL}/${bookingId}/details/${detailId}/checkout`,
            {},
            getAuthHeader()
        );
        return res.data;
    },
    cancelBookingDetail: async (bookingId, detailId) => {
        const res = await axios.patch(
            `${BASE_URL}/${bookingId}/details/${detailId}/cancel`,
            {},
            getAuthHeader()
        );
        return res.data;
    },
    cancelBooking: async (bookingId, reason) => {
        const body = typeof reason === "string" ? { reason } : reason;
        const res = await axios.patch(`${BASE_URL}/cancel-booking/${bookingId}`, body, getAuthHeader());
        return res.data;
    },

    getAvailableHousekeepers: async () => {
        const res = await axios.get(`${CLEANING_BASE}/available-housekeepers`, getAuthHeader());
        return res.data;
    },
    assignCleaningTask: async (data) => {
        const res = await axios.post(`${CLEANING_BASE}/assign`, data, getAuthHeader());
        return res.data;
    },
    getMyCleaningTasks: async () => {
        const res = await axios.get(`${CLEANING_BASE}/my-tasks`, getAuthHeader());
        return res.data;
    },
    startCleaningTask: async (id) => {
        const res = await axios.post(`${CLEANING_BASE}/${id}/start`, {}, getAuthHeader());
        return res.data;
    },
    completeCleaningTask: async (id, images = []) => {
        const token = localStorage.getItem("token");
        const formData = new FormData();
        images.forEach((file) => formData.append("images", file));
        const res = await axios.post(`${CLEANING_BASE}/${id}/complete`, formData, {
            headers: { Authorization: `Bearer ${token}` },
        });
        return res.data;
    },
    confirmCleaning: async (id) => {
        const res = await axios.post(`${CLEANING_BASE}/${id}/confirm`, {}, getAuthHeader());
        return res.data;
    },
    getAllTasks: async (params = {}) => {
        const res = await axios.get(`${CLEANING_BASE}/`, {
            ...getAuthHeader(),
            params
        });
        return res.data;
    },
    getCleaningTaskByRoom: async (params = {}) => {
        const res = await axios.get(`${CLEANING_BASE}/by-room`, {
            ...getAuthHeader(),
            params
        });
        return res.data;
    },
};
