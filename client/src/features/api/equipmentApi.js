import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/equipments`;
const TICKETS_BASE = `${BASE_URL}/tickets`;
const EMPLOYEES_BASE = `${API_BASE_URL}/employees`;

export const equipmentApi = {
  // categories

  getAllCategories: async (params) => {
    const res = await axios.get(`${BASE_URL}/categories`, {
      ...getAuthHeader(),
      params: params
    });
    return res.data;
  },
  createCategory: async (data) => {
    const res = await axios.post(`${BASE_URL}/categories`, data, getAuthHeader());
    return res.data;
  },
  updateCategory: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/categories/${id}`, data, getAuthHeader());
    return res.data;
  },
  deleteCategory: async (id) => {
    const res = await axios.delete(`${BASE_URL}/categories/${id}`, getAuthHeader());
    return res.data;
  },

  // equipments

  getAllEquipments: async (params) => {
    const res = await axios.get(`${BASE_URL}/`, {
        ...getAuthHeader(),
        params: params
    });
    return res.data;
  },

  getEquipmentById: async (id) => {
    const res = await axios.get(`${BASE_URL}/${id}`, getAuthHeader());
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

  // import tickets

  getAllImportTickets: async () => {
    const res = await axios.get(`${TICKETS_BASE}/import`, getAuthHeader());
    return res.data;
  },

  getImportTicketById: async (id) => {
    const res = await axios.get(`${TICKETS_BASE}/import/${id}`, getAuthHeader());
    return res.data;
  },

  getOutOfStockCategories: async () => {
    const res = await axios.get(`${BASE_URL}/categories/out-of-stock`, getAuthHeader());
    return res.data;
  },

  createImportTicket: async (data) => {
    const res = await axios.post(`${TICKETS_BASE}/import`, data, getAuthHeader());
    return res.data;
  },
  
  autoCreateImportTicket: async (data = {}) => {
    const res = await axios.post(`${TICKETS_BASE}/import/auto-create`, data, getAuthHeader());
    return res.data;
  },

  confirmImportTicket: async (id) => {
    const res = await axios.post(`${TICKETS_BASE}/import/mark-confirmed/${id}`, {}, getAuthHeader());
    return res.data;
  },

  updateImportTicket: async (id, data) => {
    const res = await axios.patch(`${TICKETS_BASE}/import/${id}`, data, getAuthHeader());
    return res.data;
  },

  deleteImportTicket: async (id) => {
    const res = await axios.delete(`${TICKETS_BASE}/import/${id}`, getAuthHeader());
    return res.data;
  },

  // install tickets

  getAllInstallTickets: async () => {
    const res = await axios.get(`${TICKETS_BASE}/install`, getAuthHeader());
    return res.data;
  },

  getAvailableTechnicians: async () => {
    const res = await axios.get(`${EMPLOYEES_BASE}/available-technicians`, getAuthHeader());
    return res.data;
  },

  getSmartInstallSuggestions: async (room_id) => {
    const res = await axios.get(`${TICKETS_BASE}/install/smart-suggestions`, {
      ...getAuthHeader(),
      params: { room_id }
    });
    return res.data;
  },

  createInstallTicket: async (data) => {
    const res = await axios.post(`${TICKETS_BASE}/install`, data, getAuthHeader());
    return res.data;
  },

  createUninstallTicket: async (data) => {
    const res = await axios.post(`${TICKETS_BASE}/uninstall`, data, getAuthHeader());
    return res.data;
  },

  startInstallTicket: async (id) => {
    const res = await axios.post(`${TICKETS_BASE}/install/mark-started/${id}`, {}, getAuthHeader());
    return res.data;
  },

  completeInstallTicket: async (id) => {
    const res = await axios.post(`${TICKETS_BASE}/install/mark-completed/${id}`, {}, getAuthHeader());
    return res.data;
  },

  confirmInstallTicket: async (id) => {
    const res = await axios.post(`${TICKETS_BASE}/install/mark-confirmed/${id}`, {}, getAuthHeader());
    return res.data;
  },

  updateInstallTicket: async (id, data) => {
    const res = await axios.patch(`${TICKETS_BASE}/install/${id}`, data, getAuthHeader());
    return res.data;
  },

  getMyInstallTickets: async (params = {}) => {
    const res = await axios.get(`${TICKETS_BASE}/install/my`, {
      ...getAuthHeader(),
      params
    });
    return res.data;
  },

  getEquipmentInstallById: async (id) => {
    const res = await axios.get(`${TICKETS_BASE}/install/${id}`, getAuthHeader());
    return res.data;
  },
  
  deleteInstallTicket: async (id) => {
    const res = await axios.delete(`${TICKETS_BASE}/install/${id}`, getAuthHeader());
    return res.data;
  }
};
