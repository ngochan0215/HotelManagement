import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/customers`;

export const customerApi = {
  getAllCustomers: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/`, {
      ...getAuthHeader(),
      params
    });
    return res.data;
  },

  createCustomerForUser: async (userId, data) => {
    const res = await axios.post(`${BASE_URL}/create-customer/${userId}`, data, getAuthHeader());
    return res.data;
  },

  registerCustomer: async (data) => {
    const res = await axios.post(`${API_BASE_URL}/auth/register`, {
      ...data,
      system_role: "customer",
    });
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

  unbanCustomer: async (id) => {
    const res = await axios.patch(`${BASE_URL}/${id}/unban`, {}, getAuthHeader());
    return res.data;
  },

  scanQRCode: async (imageFile) => {
    const formData = new FormData();
    formData.append("image", imageFile);

    const res = await axios.post(`${BASE_URL}/create-customer/scan-qr`, formData, {
      ...getAuthHeader(),
      headers: {
        ...getAuthHeader().headers,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },
};
