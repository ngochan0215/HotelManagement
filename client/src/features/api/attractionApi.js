import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const BASE = `${API_BASE_URL}/attractions`;

export const attractionApi = {
    getAll: (params = {}) =>
        axios.get(BASE, { params }).then(r => r.data),

    getById: (id) =>
        axios.get(`${BASE}/${id}`).then(r => r.data),
};
