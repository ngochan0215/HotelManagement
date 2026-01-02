import axios from "axios";

const BASE_URL = "http://localhost:3000/incident";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

export const incidentApi = {
  createIncident: async (data) => {
    const res = await axios.post(`${BASE_URL}/add`, data, getAuthHeader());
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

  createCompensationTicket: async (data) => {
      const res = await axios.post(`${BASE_URL}/compensation-ticket/add`, data, getAuthHeader());
      return res.data;
    }
};
