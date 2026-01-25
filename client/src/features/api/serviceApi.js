import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/service`;

const getAuthHeader = (isMultipart = false) => {
  const token = localStorage.getItem("token");
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": isMultipart
        ? "multipart/form-data"
        : "application/json",
    },
  };
};

export const serviceApi = {
  getAllServices: async (params) => {
    const res = await axios.get(`${BASE_URL}/all`, {
      params,
      ...getAuthHeader(),
    });
    return res.data;
  },

  createService: async (formData) => {
    const res = await axios.post(`${BASE_URL}/add`, formData, getAuthHeader(true));
    return res.data;
  },

  updateService: async (id, formData) => {
    const res = await axios.patch(`${BASE_URL}/update/${id}`, formData, getAuthHeader(true));
    return res.data;
  },

  deleteService: async (id) => {
    const res = await axios.delete(`${BASE_URL}/delete/${id}`, getAuthHeader());
    return res.data;
  },

  getAllCategories: async () => {
    const res = await axios.get(`${BASE_URL}/category/all`, getAuthHeader());
    return res.data;
  },

    getOutOfStockServices: async () => {
      const res = await axios.get(`${BASE_URL}/import/out-of-stock`, getAuthHeader());
      return res.data;
    },
    createGoodTicket: async (data) => {
      const res = await axios.post(`${BASE_URL}/import/add`, data, getAuthHeader());
      return res.data;
    },
    autoCreateGoodTicket: async (data = {}) => {
      const res = await axios.post(`${BASE_URL}/import/auto-create`, data, getAuthHeader());
      return res.data;
    },
    getAllGoodTickets: async () => {
      const res = await axios.get(`${BASE_URL}/import/all`, getAuthHeader());
      return res.data;
    },
    confirmGoodTicket: async (id) => {
      const res = await axios.post(`${BASE_URL}/import/${id}/confirm`, {}, getAuthHeader());
      return res.data;
    },

    getAllServiceUsage: async () => {
      const res = await axios.get(`${BASE_URL}/usage/all`, getAuthHeader());
      return res.data;
    },
    createServiceUsage: async (data) => {
      const res = await axios.post(`${BASE_URL}/usage/add`, data, getAuthHeader());
      return res.data;
    },
    confirmServiceUsage: async (id) => {
      const res = await axios.post(`${BASE_URL}/usage/${id}/confirm`, {}, getAuthHeader());
      return res.data;
    },
    cancelServiceUsage: async (id) => {
      const res = await axios.post(`${BASE_URL}/usage/${id}/cancel`, {}, getAuthHeader());
      return res.data;
    },
    getServiceUsageById: async (id) => {
      const res = await axios.get(`${BASE_URL}/usage/${id}`, getAuthHeader());
      return res.data;
    },
    updateServiceUsage: async (id, data) => {
      const res = await axios.patch(`${BASE_URL}/usage/${id}/update`, data, getAuthHeader());
      return res.data;
    },
};
