import axios from "axios";

const BASE_URL = "http://localhost:3000/equipment";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const equipmentApi = {
  // equipment-category
  getAllCategories: async () => {
    const response = await axios.get(`${BASE_URL}/category/all`, getAuthHeader());
    return response.data.categories;
  },

  getCategoryById: async (id) => {
    const response = await axios.get(`${BASE_URL}/category/${id}`);
    return response.data;
  },

  createCategory: async (formData) => {
    const response = await axios.post(`${BASE_URL}/category/add`, formData, {
      headers: {
        ...getAuthHeader().headers,
        "Content-Type": "multipart/form-data"
      },
    });
    return response.data;
  },

  updateCategory: async (id, formData) => {
    const response = await axios.put(`${BASE_URL}/category/${id}`, formData, {
      headers: {
        ...getAuthHeader().headers,
        "Content-Type": "multipart/form-data"
      },
    });
    return response.data;
  },

  deleteCategory: async (id) => {
    const response = await axios.delete(`${BASE_URL}/category/${id}`, getAuthHeader());
    return response.data;
  },

  // equipment
};