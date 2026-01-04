import axios from "axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};
const BASE_URL = "http://localhost:3000/statistics";

export const statisticApi = {
    getWeeklyRevenue: async () => {
        const res = await axios.get(`${BASE_URL}/revenue-week`, getAuthHeader());
        return res.data;
    },

    getWeeklyBookings: async () => {
        const res = await axios.get(`${BASE_URL}/bookings-week`, getAuthHeader());
        return res.data;
    },

    getRoomReport: async (params) => {
        const res = await axios.get(`${BASE_URL}/reports/room-operation`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    getBookingReport: async (params) => {
        const res = await axios.get(`${BASE_URL}/reports/booking`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    getCustomerReport: async (params) => {
        const res = await axios.get(`${BASE_URL}/reports/customers`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    getEquipmentReport: async (params) => {
        const res = await axios.get(`${BASE_URL}/reports/equipments`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    getServiceReport: async (params) => {
        const res = await axios.get(`${BASE_URL}/reports/services`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    exportReportExcel: async (type, params) => {
        const res = await axios.get(`${BASE_URL}/reports/${type}/excel`, {
            ...getAuthHeader(),
            params,
            responseType: 'blob',
        });
        return res.data;
    }
};