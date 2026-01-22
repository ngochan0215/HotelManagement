import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/employee`;

export const employeeApi = {
  getAllEmployees: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/all`, {
      ...getAuthHeader(),
      params
    });
    return res.data;
  },
  createEmployee: async (data) => {
    const res = await axios.post(`${BASE_URL}/add`, data, getAuthHeader());
    return res.data;
  },

  updateEmployee: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/${id}`, data, getAuthHeader());
    return res.data;
  },

  getEmployeesByPosition: async (position) => {
      const res = await axios.get(
        `${BASE_URL}/all`,
        {
          ...getAuthHeader(),
          params: { position }
        }
      );

      return res.data?.employees ?? [];
  },
};
