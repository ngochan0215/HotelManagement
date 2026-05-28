import axios from "axios";

const BASE = "http://localhost:3000/attractions";

export const attractionApi = {
    getAll: (params = {}) =>
        axios.get(BASE, { params }).then(r => r.data),

    getById: (id) =>
        axios.get(`${BASE}/${id}`).then(r => r.data),
};
