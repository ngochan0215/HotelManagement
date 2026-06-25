import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/services`;

const getAuthHeader = (isMultipart = false) => {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": isMultipart ? "multipart/form-data" : "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return { headers };
};

export const serviceApi = {
  // --- SERVICES ---

  getAllServices: async (params) => {
    const res = await axios.get(`${BASE_URL}/`, { params, ...getAuthHeader() });
    return res.data;
  },

  getServiceById: async (id) => {
    const res = await axios.get(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  },

  createService: async (formData) => {
    const res = await axios.post(`${BASE_URL}/`, formData, getAuthHeader(true));
    return res.data;
  },

  updateService: async (id, formData) => {
    const res = await axios.patch(`${BASE_URL}/${id}`, formData, getAuthHeader(true));
    return res.data;
  },

  deleteService: async (id) => {
    const res = await axios.delete(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  },

  // --- SERVICE CATEGORIES ---

  getAllCategories: async (params) => {
    const res = await axios.get(`${BASE_URL}/categories`, { params, ...getAuthHeader() });
    return res.data;
  },

  getServicesByCategoryId: async (id) => {
    const res = await axios.get(`${BASE_URL}/categories/${id}`, getAuthHeader());
    return res.data;
  },

  createCategory: async (formData) => {
    const res = await axios.post(`${BASE_URL}/categories`, formData, getAuthHeader(true));
    return res.data;
  },

  updateCategory: async (id, formData) => {
    const res = await axios.patch(`${BASE_URL}/categories/${id}`, formData, getAuthHeader(true));
    return res.data;
  },

  deleteCategory: async (id, force = false) => {
    const res = await axios.delete(`${BASE_URL}/categories/${id}`, {
      ...getAuthHeader(),
      params: force ? { force: "true" } : {},
    });
    return res.data;
  },

  // --- IMPORT TICKETS (GOOD TICKETS) ---

  getAllGoodTickets: async (params) => {
    const res = await axios.get(`${BASE_URL}/import-tickets`, { params, ...getAuthHeader() });
    return res.data;
  },

  getGoodTicketById: async (id) => {
    const res = await axios.get(`${BASE_URL}/import-tickets/${id}`, getAuthHeader());
    return res.data;
  },

  getOutOfStockServices: async () => {
    const res = await axios.get(`${BASE_URL}/import-tickets/out-of-stock`, getAuthHeader());
    return res.data;
  },

  createGoodTicket: async (data) => {
    const res = await axios.post(`${BASE_URL}/import-tickets`, data, getAuthHeader());
    return res.data;
  },

  autoCreateGoodTicket: async (data = {}) => {
    const res = await axios.post(`${BASE_URL}/import-tickets/auto-create`, data, getAuthHeader());
    return res.data;
  },

  updateGoodTicket: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/import-tickets/${id}`, data, getAuthHeader());
    return res.data;
  },

  deleteGoodTicket: async (id, force = false) => {
    const res = await axios.delete(`${BASE_URL}/import-tickets/${id}`, {
      ...getAuthHeader(),
      params: force ? { force: "true" } : {},
    });
    return res.data;
  },

  confirmGoodTicket: async (id) => {
    const res = await axios.post(`${BASE_URL}/import-tickets/${id}/confirm`, {}, getAuthHeader());
    return res.data;
  },

  // --- SERVICE USAGE TICKETS ---

  getAllServiceUsage: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/usage-tickets/all`, { ...getAuthHeader(), params });
    return res.data;
  },

  getServiceUsageById: async (id) => {
    const res = await axios.get(`${BASE_URL}/usage-tickets/${id}`, getAuthHeader());
    return res.data;
  },

  createServiceUsage: async (data) => {
    const res = await axios.post(`${BASE_URL}/usage-tickets`, data, getAuthHeader());
    return res.data;
  },

  updateServiceUsage: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/usage-tickets/${id}`, data, getAuthHeader());
    return res.data;
  },

  deleteServiceUsage: async (id, force = false) => {
    const res = await axios.delete(`${BASE_URL}/usage-tickets/${id}`, {
      ...getAuthHeader(),
      params: force ? { force: "true" } : {},
    });
    return res.data;
  },

  confirmServiceUsage: async (id) => {
    const res = await axios.post(`${BASE_URL}/usage-tickets/${id}/confirm`, {}, getAuthHeader());
    return res.data;
  },

  cancelServiceUsage: async (id) => {
    const res = await axios.post(`${BASE_URL}/usage-tickets/${id}/cancel`, {}, getAuthHeader());
    return res.data;
  },

  // --- ASSETS & SLOTS ---

  getAssets: async (params) => {
    const res = await axios.get(`${BASE_URL}/assets`, { params, ...getAuthHeader() });
    return res.data.assets || [];
  },

  createAsset: async (data) => {
    const res = await axios.post(`${BASE_URL}/assets`, data, getAuthHeader());
    return res.data;
  },

  updateAsset: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/assets/${id}`, data, getAuthHeader());
    return res.data;
  },

  deleteAsset: async (id) => {
    const res = await axios.delete(`${BASE_URL}/assets/${id}`, getAuthHeader());
    return res.data;
  },

  getSlots: async (params) => {
    const res = await axios.get(`${BASE_URL}/slots`, { params, ...getAuthHeader() });
    return res.data.slots || [];
  },

  createSlot: async (data) => {
    const res = await axios.post(`${BASE_URL}/slots`, data, getAuthHeader());
    return res.data;
  },

  updateSlot: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/slots/${id}`, data, getAuthHeader());
    return res.data;
  },

  deleteSlot: async (id) => {
    const res = await axios.delete(`${BASE_URL}/slots/${id}`, getAuthHeader());
    return res.data;
  },

  closeSlot: async (id) => {
    const res = await axios.post(`${BASE_URL}/slots/${id}/close`, {}, getAuthHeader());
    return res.data;
  },

  // --- USAGE DETAILS ---

  confirmUsageDetail: async (id) => {
    const res = await axios.post(`${BASE_URL}/usage-details/${id}/confirm`, {}, getAuthHeader());
    return res.data;
  },

  cancelUsageDetail: async (id) => {
    const res = await axios.post(`${BASE_URL}/usage-details/${id}/cancel`, {}, getAuthHeader());
    return res.data;
  },
};
