import axios from "axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = "http://localhost:3000/customer";

export const customerApi = {
  getAllCustomers: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/all`, {
      ...getAuthHeader(),
      params
    });
    return res.data;
  },

  createCustomer: async (data) => {
    const res = await axios.post(`${BASE_URL}/register`, data, getAuthHeader());
    return res.data;
  },
};