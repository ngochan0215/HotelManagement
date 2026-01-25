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
    
    // Cleaning Tasks APIs
    getAvailableHousekeepers: async () => {
        const res = await axios.get(`${BASE_URL}/cleaning/available-housekeepers`, getAuthHeader());
        return res.data;
    },
    assignCleaningTask: async (data) => {
        const res = await axios.post(`${BASE_URL}/cleaning/assign`, data, getAuthHeader());
        return res.data;
    },
    getMyCleaningTasks: async () => {
        const res = await axios.get(`${BASE_URL}/cleaning/my-tasks`, getAuthHeader());
        return res.data;
    },
    startCleaningTask: async (id) => {
        const res = await axios.post(`${BASE_URL}/cleaning/${id}/start`, {}, getAuthHeader());
        return res.data;
    },
    completeCleaningTask: async (id) => {
        const res = await axios.post(`${BASE_URL}/cleaning/${id}/complete`, {}, getAuthHeader());
        return res.data;
    },
    confirmCleaning: async (id) => {
        const res = await axios.post(`${BASE_URL}/cleaning/${id}/confirm`, {}, getAuthHeader());
        return res.data;
    },
    getAllTasks: async (params = {}) => {
        const res = await axios.get(`${BASE_URL}/tasks/all`, {
            ...getAuthHeader(),
            params
        });
        return res.data;
    },
    getCleaningTaskByRoom: async (params = {}) => {
        const res = await axios.get(`${BASE_URL}/cleaning/task-by-room`, {
            ...getAuthHeader(),
            params
        });
        return res.data;
    },
};