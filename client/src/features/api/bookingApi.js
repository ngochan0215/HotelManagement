import axios from "axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = "http://localhost:3000/booking";
const BASE_URL_ = "http://localhost:3000";

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

    createBooking: async() => {
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
        `${BASE_URL_}/manager/calendar/rooms`,
        {
            ...getAuthHeader(),
            params: { date },
        }
        );
        return response.data;
    },
};