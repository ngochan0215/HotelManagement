import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/room`;
const BASE_URL_ = `${API_BASE_URL}/room-category`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const roomApi = {
  // room-category
  getAllCategories: async () => {
    const response = await axios.get(`${BASE_URL_}/all`);
    return response.data;
  },

  getCategoryById: async (id) => {
    const response = await axios.get(`${BASE_URL_}/${id}`);
    return response.data;
  },

  createCategory: async (formData) => {
    const response = await axios.post(`${BASE_URL_}/add`, formData, {
      headers: {
        ...getAuthHeader().headers,
        "Content-Type": "multipart/form-data"
      },
    });
    return response.data;
  },

  updateCategory: async (id, formData) => {
    const response = await axios.put(`${BASE_URL_}/${id}`, formData, {
      headers: {
        ...getAuthHeader().headers,
        "Content-Type": "multipart/form-data"
      },
    });
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await axios.delete(`${BASE_URL_}/${id}`, getAuthHeader());
    return response.data;
  },

  forceDeleteCategory: async (id) => {
    const response = await axios.delete(`${BASE_URL_}/${id}?force=true`, getAuthHeader());
    return response.data;
  },

  getAvailableBy: async (params) => {
    const response = await axios.get(`${BASE_URL_}/available-by`, {
      params,
      ...getAuthHeader(),
    });
    return response.data;
  },

  getDefaultEquipmentsByCategory: async (categoryId) => {
    const response = await axios.get(`${BASE_URL_}/${categoryId}/default-equipments`, getAuthHeader());
    return response.data;
  },

  // room
  getAllRooms: async () => {
    const response = await axios.get(`${BASE_URL}/all`);
    return response.data;
  },

  getRoomById: async (id) => {
    const response = await axios.get(`${BASE_URL}/${id}`, getAuthHeader());
    return response.data;
  },

  createRoom: async (data) => {
    const response = await axios.post(`${BASE_URL}/add`, data, getAuthHeader());
    return response.data;
  },

  updateRoom: async (id, data) => {
    const response = await axios.put(`${BASE_URL}/${id}`, data, getAuthHeader());
    return response.data;
  },

  deleteRoom: async (id) => {
    const response = await axios.delete(`${BASE_URL}/${id}`, getAuthHeader());
    return response.data;
  },

  getRoomStatusSummary: async () => {
    const response = await axios.get(`${BASE_URL}/statistic/status`, getAuthHeader());
    return response.data;
  },

  getTopRoomTypes: async (limit = 5) => {
    const response = await axios.get(
      `${BASE_URL}/statistic/top-booked`,
      {
        ...getAuthHeader(),
        params: { limit },
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

};