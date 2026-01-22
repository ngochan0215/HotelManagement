import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/incident`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const incidentApi = {
  createIncident: async (data) => {
    const res = await axios.post(`${BASE_URL}/add`, data, getAuthHeader());
    return res.data;
  },

  updateIncident: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/update/${id}`, data, getAuthHeader());
    return res.data;
  },

  assignIncident: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/${id}/assign`, data, getAuthHeader());
    return res.data;
  },

  resolveIncident: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/${id}/resolved`, data, getAuthHeader());
    return res.data;
  },

  getAllIncidents: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/all`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

  getIncidentById: async (id) => {
    const res = await axios.get(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  },

  createCompensationTicket: async (id, data) => {
    const res = await axios.post(`${BASE_URL}/${id}/compensation-ticket/add`, data, getAuthHeader());
    return res.data;
  }
};
