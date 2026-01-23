import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/customer`;

export const customerApi = {
  getAllCustomers: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/all`, {
      ...getAuthHeader(),
      params
    });
    return res.data;
  },

  createCustomer: async (data) => {
    const res = await axios.post(`${API_BASE_URL}/auth/register`, data, getAuthHeader());
    return res.data;
  },

  updateCustomer: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/${id}`, data, getAuthHeader());
    return res.data;
  },

  banCustomer: async (id) => {
    const res = await axios.patch(`${BASE_URL}/${id}/ban`, {}, getAuthHeader());
    return res.data;
  },
};