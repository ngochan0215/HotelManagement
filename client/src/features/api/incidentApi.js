import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/incidents`;

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const incidentApi = {
  createIncident: async (data) => {
    const res = await axios.post(`${BASE_URL}/`, data, getAuthHeader());
    return res.data;
  },

  updateIncident: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/${id}`, data, getAuthHeader());
    return res.data;
  },

  assignIncident: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/mark-assigned/${id}`, data, getAuthHeader());
    return res.data;
  },

  resolveIncident: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/mark-resolved/${id}`, data, getAuthHeader());
    return res.data;
  },

  getAllIncidents: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

  getIncidentById: async (id) => {
    const res = await axios.get(`${BASE_URL}/${id}`, getAuthHeader());
    return res.data;
  },

  closeIncident: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/mark-closed/${id}`, data, getAuthHeader());
    return res.data;
  },

  createCompensationTicket: async (id, data) => {
    const res = await axios.post(`${BASE_URL}/${id}/compensation-tickets/others`, data, getAuthHeader());
    return res.data;
  },

  createCompensationTicketWithDetails: async (id, data) => {
    const res = await axios.post(`${BASE_URL}/${id}/compensation-tickets`, data, getAuthHeader());
    return res.data;
  },

  getAllCompensateTickets: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/compensation-tickets`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

  getCompensateTicketById: async (id) => {
    const res = await axios.get(`${BASE_URL}/compensation-tickets/${id}`, getAuthHeader());
    return res.data;
  },

  confirmCompensationPaid: async (id) => {
    const res = await axios.post(`${BASE_URL}/compensation-tickets/confirm-done/${id}`, {}, getAuthHeader());
    return res.data;
  }
};
