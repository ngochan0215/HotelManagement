import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/qr`;

export const qrApi = {
  scanQRCode: async (imageFile) => {
    const formData = new FormData();
    formData.append("image", imageFile);

    const res = await axios.post(`${BASE_URL}/scan`, formData, {
      ...getAuthHeader(),
      headers: {
        ...getAuthHeader().headers,
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },
};
