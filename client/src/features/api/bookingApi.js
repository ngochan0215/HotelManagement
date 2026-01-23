import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/booking`;
const BASE_URL_ = API_BASE_URL;

export const bookingApi = {
    getCancellationReasonStats: async (params = {}) => {
        const res = await axios.get(`${BASE_URL}/statistics/cancellation-reasons`,
            {
                ...getAuthHeader(),
                params,
            },
        );
        return res.data.data;
    },

    createBooking: async(data) => {
        const res = await axios.post(`${BASE_URL}/add/general`, data, getAuthHeader());
        return res.data;
    },

    previewBooking: async(data) => {
        const res = await axios.post(`${BASE_URL}/preview/general`, data, getAuthHeader());
        return res.data;
    },

    updateBookingStatus: async (bookingId, status) => {
        const res = await axios.put(
            `${BASE_URL}/${bookingId}/update`,
            null,
            {
                ...getAuthHeader(),
                params: { status },
            }
        );
        return res.data;
    },

    getRoomsCalendar: async (date = new Date()) => {
        const response = await axios.get(
            `${BASE_URL}/calendar/rooms`,
        {
            ...getAuthHeader(),
            params: { date },
        }
        );
        return response.data;
    },

    getAllBookings: async () => {
        const res = await axios.get(`${BASE_URL}/all`, getAuthHeader());
        return res.data;
    },

    confirmBooking: async (bookingId) => {
        const res = await axios.put(`${BASE_URL}/${bookingId}/confirm`, {}, getAuthHeader());
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
        const res = await axios.patch(`${BASE_URL}/${bookingId}/cancel`, { reason }, getAuthHeader());
        return res.data;
    },
};