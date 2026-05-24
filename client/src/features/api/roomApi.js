import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/rooms`;
const CATEGORIES_BASE = `${BASE_URL}/categories`;
const STATS_BASE = `${BASE_URL}/statistics`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const roomApi = {
  getAllCategories: async () => {
    const response = await axios.get(`${CATEGORIES_BASE}/`);
    return response.data;
  },

  getCategoryById: async (id) => {
    const response = await axios.get(`${CATEGORIES_BASE}/${id}`);
    return response.data;
  },

  createCategory: async (formData) => {
    const response = await axios.post(`${CATEGORIES_BASE}/`, formData, {
      headers: {
        ...getAuthHeader().headers,
        "Content-Type": "multipart/form-data"
      },
    });
    return response.data;
  },

  updateCategory: async (id, formData) => {
    const response = await axios.patch(`${CATEGORIES_BASE}/${id}`, formData, {
      headers: {
        ...getAuthHeader().headers,
        "Content-Type": "multipart/form-data"
      },
    });
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await axios.delete(`${CATEGORIES_BASE}/${id}`, getAuthHeader());
    return response.data;
  },

  forceDeleteCategory: async (id) => {
    const response = await axios.delete(`${CATEGORIES_BASE}/${id}?force=true`, getAuthHeader());
    return response.data;
  },

  getAvailableBy: async (params) => {
    const response = await axios.get(`${CATEGORIES_BASE}/available-by`, {
      params,
      ...getAuthHeader(),
    });
    return response.data;
  },

  getDefaultEquipmentsByCategory: async (categoryId) => {
    const response = await axios.get(`${CATEGORIES_BASE}/default-equipments/${categoryId}`, getAuthHeader());
    return response.data;
  },

  getAllRooms: async (params = {}) => {
    const response = await axios.get(`${BASE_URL}/`, { params });
    const body = response.data;
    if (body?.data != null) {
      return { rooms: body.data, pagination: body.pagination, success: body.success };
    }
    return body;
  },

  getRoomById: async (id) => {
    const response = await axios.get(`${BASE_URL}/${id}`, getAuthHeader());
    return response.data;
  },

  createRoom: async (data) => {
    const response = await axios.post(`${BASE_URL}/`, data, getAuthHeader());
    return response.data;
  },

  updateRoom: async (id, data) => {
    const response = await axios.patch(`${BASE_URL}/${id}`, data, getAuthHeader());
    return response.data;
  },

  deleteRoom: async (id) => {
    const response = await axios.delete(`${BASE_URL}/${id}`, getAuthHeader());
    return response.data;
  },

  getRoomStatusSummary: async () => {
    const response = await axios.get(`${STATS_BASE}/status-summary`, getAuthHeader());
    return response.data;
  },

  getTopRoomTypes: async (limit = 5) => {
    const response = await axios.get(
      `${STATS_BASE}/top-booked`,
      {
        ...getAuthHeader(),
        params: { limit },
      }
    );
    return response.data;
  },

  getRoomsCalendar: async (date = new Date()) => {
    const response = await axios.get(
        `${STATS_BASE}/calendar`,
    {
        ...getAuthHeader(),
        params: { date },
    }
    );
    return response.data;
  },

  completeCleaning: async (roomId) => {
      const res = await axios.post(`${BASE_URL}/${roomId}/cleaning/complete`, {}, getAuthHeader());
      return res.data;
    },

    completeMaintenance: async (roomId) => {
      const res = await axios.post(`${BASE_URL}/${roomId}/maintenance/complete`, {}, getAuthHeader());
      return res.data;
    },

    getRoomEquipments: async (roomId) => {
      const res = await axios.get(`${BASE_URL}/${roomId}/equipments`, getAuthHeader());
      return res.data;
    },

};
