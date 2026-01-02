import axios from "axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};
const BASE_URL = "http://localhost:3000/receipt";

export const receiptApi = {
  getAllReceipts: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/all`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

  getReceiptById: async (id) => {
    const res = await axios.get(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  },

  createReceipt: async (data) => {
    const res = await axios.post(`${BASE_URL}/add`, data, getAuthHeader());
    return res.data;
  },

  updateReceipt: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/update/${id}`, data, getAuthHeader());
    return res.data;
  }
};