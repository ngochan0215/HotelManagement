import axios from "axios";

const BASE_URL = "http://localhost:3000/room";
const BASE_URL_ = "http://localhost:3000/room-category";

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

  // room
  getAllRooms: async () => {
    const response = await axios.get(`${BASE_URL}/all`);
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

};