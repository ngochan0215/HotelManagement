import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/equipment`;

export const equipmentApi = {
  getAllCategories: async () => {
    const res = await axios.get(`${BASE_URL}/category/all`, getAuthHeader());
    return res.data;
  },
  createCategory: async (data) => {
    const res = await axios.post(`${BASE_URL}/category/add`, data, getAuthHeader());
    return res.data;
  },
  updateCategory: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/category/${id}`, data, getAuthHeader());
    return res.data;
  },
  deleteCategory: async (id) => {
    const res = await axios.delete(`${BASE_URL}/category/${id}`, getAuthHeader());
    return res.data;
  },
  getAllEquipments: async (params) => {
      const res = await axios.get(`${BASE_URL}/all`, {
          ...getAuthHeader(),
          params: params
      });
      return res.data;
    },
  updateEquipment: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/${id}`, data, getAuthHeader());
    return res.data;
  },
  deleteEquipment: async (id) => {
    const res = await axios.delete(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  },

  getAllImportTickets: async () => {
    const res = await axios.get(`${BASE_URL}/ticket/all`, getAuthHeader());
    return res.data;
  },
  getImportTicketById: async (id) => {
    const res = await axios.get(`${BASE_URL}/ticket/${id}`, getAuthHeader());
    return res.data;
  },
  getOutOfStockCategories: async () => {
    const res = await axios.get(`${BASE_URL}/ticket/out-of-stock`, getAuthHeader());
    return res.data;
  },
  createImportTicket: async (data) => {
    const res = await axios.post(`${BASE_URL}/ticket/add`, data, getAuthHeader());
    return res.data;
  },
  autoCreateImportTicket: async (data = {}) => {
    const res = await axios.post(`${BASE_URL}/ticket/auto-create`, data, getAuthHeader());
    return res.data;
  },
  confirmImportTicket: async (id) => {
    const res = await axios.post(`${BASE_URL}/ticket/${id}/confirm-import`, {}, getAuthHeader());
    return res.data;
  },

  getAllInstallTickets: async () => {
    const res = await axios.get(`${BASE_URL}/install/all`, getAuthHeader());
    return res.data;
  },
  getAvailableTechnicians: async () => {
    const res = await axios.get(`${BASE_URL}/install/available-technicians`, getAuthHeader());
    return res.data;
  },
  getSmartInstallSuggestions: async (room_id) => {
    const res = await axios.get(`${BASE_URL}/install/smart-suggestions`, {
      ...getAuthHeader(),
      params: { room_id }
    });
    return res.data;
  },
  createInstallTicket: async (data) => {
    const res = await axios.post(`${BASE_URL}/install/add`, data, getAuthHeader());
    return res.data;
  },
  createUninstallTicket: async (data) => {
    const res = await axios.post(`${BASE_URL}/install/uninstall`, data, getAuthHeader());
    return res.data;
  },
  startInstallTicket: async (id) => {
    const res = await axios.post(`${BASE_URL}/install/${id}/start`, {}, getAuthHeader());
    return res.data;
  },
  completeInstallTicket: async (id) => {
    const res = await axios.post(`${BASE_URL}/install/${id}/complete`, {}, getAuthHeader());
    return res.data;
  },
  confirmInstallTicket: async (id) => {
    const res = await axios.post(`${BASE_URL}/install/${id}/confirm-install`, {}, getAuthHeader());
    return res.data;
  },
  updateInstallTicket: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/install/${id}`, data, getAuthHeader());
    return res.data;
  },
  getMyInstallTickets: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/install/my-tickets`, {
      ...getAuthHeader(),
      params
    });
    return res.data;
  },
  getEquipmentInstallById: async (id) => {
    const res = await axios.get(`${BASE_URL}/install/${id}`, getAuthHeader());
    return res.data;
  }
};