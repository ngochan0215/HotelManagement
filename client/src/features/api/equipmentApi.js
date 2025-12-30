import axios from "axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = "http://localhost:3000/equipment";

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

  getAllEquipments: async () => {
    const res = await axios.get(`${BASE_URL}/all`, getAuthHeader());
    return res.data;
  },
  updateEquipment: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/${id}`, data, getAuthHeader());
    return res.data;
  },
  deleteEquipment: async (id) => {
    const res = await axios.delete(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  }
};