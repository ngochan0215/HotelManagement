import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE_URL = `${API_BASE_URL}/bookings/reviews`;

export const reviewApi = {
  async getPublicReviews(params = {}) {
    const response = await axios.get(`${BASE_URL}/public`, { params });
    return response.data;
  },
};
