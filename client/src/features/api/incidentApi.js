import axios from "axios";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = "http://localhost:3000/incident";

export const incidentApi = {
  getAllIncidents: async () => {
    const res = await axios.get(`${BASE_URL}/all`, getAuthHeader());
    return res.data;
  },
  createIncident: async (data) => {
    const res = await axios.post(`${BASE_URL}/add`, data, getAuthHeader());
    return res.data;
  },
  updateIncident: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/update/${id}`, data, getAuthHeader());
    return res.data;
  },

  getAllCompensateTickets: async () => {
    const res = await axios.get(`${BASE_URL}/compensation-ticket/all`, getAuthHeader());
    return res.data;
  },

  createCompensation: async (incidentId, data) => {
    const res = await axios.post(`${BASE_URL}/${incidentId}/compensation-ticket/add`, data, getAuthHeader());
    return res.data;
  },

  confirmCompensationPaid: async (ticketId) => {
    const res = await axios.post(`${BASE_URL}/compensation-ticket/confirmed-done`, { id: ticketId }, getAuthHeader());
    return res.data;
  }
};