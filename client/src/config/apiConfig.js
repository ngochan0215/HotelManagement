// API Configuration
// Sử dụng environment variable hoặc fallback về localhost cho development
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default API_BASE_URL;
