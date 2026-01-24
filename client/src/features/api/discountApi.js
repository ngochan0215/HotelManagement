import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/discount`;

export const discountApi = {
  getAllDiscounts: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/all`, {
      ...getAuthHeader(),
      params
    });
    return res.data;
  },

  createDiscount: async (data) => {
    const res = await axios.post(`${BASE_URL}/add`, data, getAuthHeader());
    return res.data;
  },

  updateDiscount: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/update/${id}`, data, getAuthHeader());
    return res.data;
  },

  deleteDiscount: async (id) => {
    const res = await axios.delete(`${BASE_URL}/delete/${id}`, getAuthHeader());
    return res.data;
  },

  getDiscountById: async (id) => {
    const res = await axios.get(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  },

  getAvailableDiscounts: async (customerId, orderValue = 0) => {
    const res = await axios.get(`${BASE_URL}/available`, {
      ...getAuthHeader(),
      params: { customer_id: customerId, order_value: orderValue }
    });
    return res.data;
  }
};