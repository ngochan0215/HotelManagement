import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const ROOM_URL = `${API_BASE_URL}/rooms/statistics`;
const BOOKING_URL = `${API_BASE_URL}/bookings/statistics`;
const EQUIPMENT_URL = `${API_BASE_URL}/equipments/statistics`;
const CUSTOMER_URL = `${API_BASE_URL}/customers/statistics`;

export const statisticApi = {

    getRoomReport: async (params) => {
        const res = await axios.get(`${ROOM_URL}/reports/json`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    getBookingReport: async (params) => {
        const res = await axios.get(`${BOOKING_URL}/reports/json`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    getCustomerReport: async (params) => {
        const res = await axios.get(`${CUSTOMER_URL}/reports/json`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    getEquipmentReport: async (params) => {
        const res = await axios.get(`${EQUIPMENT_URL}/reports/json`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    getServiceReport: async (params) => {
        const res = await axios.get(`${BASE_URL}/reports/json`, {
            ...getAuthHeader(),
            params,
        });
        return res.data;
    },

    exportReportExcel: async (type, params) => {
        const res = await axios.get(`${API_BASE_URL}/${type}/statistics/reports/excel`, {
            ...getAuthHeader(),
            params,
            responseType: 'blob',
        });
        return res.data;
    },

    exportReportPDF: async (type, params) => {
        const res = await axios.get(`${API_BASE_URL}/${type}/statistics/reports/pdf`, {
            ...getAuthHeader(),
            params,
            responseType: 'blob',
        });
        return res.data;
    }
};