import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/receipt`;

export const paymentApi = {
  createPaymentLink: async (userId, transactionData) => {
    const res = await axios.post(
      `${BASE_URL}/paymentLink/${userId}`,
      transactionData,
      getAuthHeader()
    );
    return res.data;
  },

  getPaymentLinkDetail: async (paymentId) => {
    const res = await axios.get(
      `${BASE_URL}/paymentLink/${paymentId}`,
      getAuthHeader()
    );
    return res.data;
  },

  getPaymentTransactionDetail: async (bookingId) => {
    const res = await axios.get(
      `${BASE_URL}/transaction/${bookingId}`,
      getAuthHeader()
    );
    return res.data;
  },

  updateSuccessfulTransaction: async (bookingId) => {
    const res = await axios.patch(
      `${BASE_URL}/transaction/${bookingId}/success`,
      {},
      getAuthHeader()
    );
    return res.data;
  },

  updateFailedTransaction: async (bookingId) => {
    const res = await axios.patch(
      `${BASE_URL}/transaction/${bookingId}/failed`,
      {},
      getAuthHeader()
    );
    return res.data;
  },
};
