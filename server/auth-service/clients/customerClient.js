import axios from "axios";

const customerAPI = axios.create({
  baseURL: process.env.CUSTOMER_SERVICE_URL || "http://localhost:3002",
  timeout: 5000
});

export const customerClient = {
  getCustomerById: async (id) => {
    const res = await customerAPI.get(`/get-customer/${id}`);
    return res.data;
  },

  findCustomerByPhone: async (phone) => {
    const res = await customerAPI.get(`/get-customer-phone/${phone}`);
    return res.data;
  },

  findCustomerByCCCD: async (cccd) => {
    const res = await customerAPI.get(`/get-customer-cccd/${cccd}`);
    return res.data;
  },

  createCustomer: async (id, payload) => {
    const res = await customerAPI.post(`/create-customer/${id}`, payload);
    return res.data;
  }
};