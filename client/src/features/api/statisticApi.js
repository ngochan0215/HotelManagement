import axios from "axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};
const BASE_URL = "http://localhost:3000/statistics";

export const statisticsApi = {
  getWeeklyRevenue: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/revenue-week`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

  getWeeklyBookings: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/bookings-week`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

};