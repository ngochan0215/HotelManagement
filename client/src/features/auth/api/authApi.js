import axios from "axios";
import API_BASE_URL from "../../../config/apiConfig.js";

const API_URL = `${API_BASE_URL}/auth`;

function normalizeApiError(error, fallbackMessage) {
  const serverData = error?.response?.data;
  const rawMessage =
    (typeof serverData === "object" && serverData?.message) ||
    (typeof serverData === "string" && serverData) ||
    error?.message ||
    fallbackMessage;
  const message = String(rawMessage || "").trim();
  if (!message || message.toLowerCase() === "network error") {
    return fallbackMessage;
  }
  return message;
}

export const loginUser = async (credentials) => {
  try {
    const response = await axios.post(`${API_URL}/login`, credentials, { timeout: 15000 });
    return response.data;
  } catch (error) {
    const errorName = String(error?.name || "");
    const errorCode = String(error?.code || "");
    const errorMessage = String(error?.message || "");
    const isCanceledOrTimeout =
      errorCode === "ERR_CANCELED" ||
      errorCode === "ECONNABORTED" ||
      errorName === "CanceledError" ||
      errorName === "AbortError" ||
      errorMessage.toLowerCase().includes("timeout");

    if (isCanceledOrTimeout) {
      const timeoutError = new Error("Đăng nhập mất quá nhiều thời gian. Vui lòng thử lại.");
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    const serverData = error?.response?.data;
    const message =
      (typeof serverData === "object" && serverData?.message) ||
      (typeof serverData === "string" && serverData) ||
      error?.message ||
      "Đăng nhập thất bại.";
    throw new Error(message);
  }
};

export const loginGoogle = async (credentials) => {
  try {
    const response = await axios.post(`${API_URL}/login-google`, credentials);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error;
  }
};

export const forgotPassword = async (email) => {
  try {
    const response = await axios.post(`${API_URL}/forgot-password`, { email });
    return response.data;
  } catch (error) {
    throw new Error(normalizeApiError(error, "Không thể kết nối đến máy chủ. Vui lòng thử lại."));
  }
};

export const resetPassword = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/reset-password`, data);
    return response.data;
  } catch (error) {
    throw new Error(normalizeApiError(error, "Không thể kết nối đến máy chủ. Vui lòng thử lại."));
  }
};

export const verifyEmail = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/verify-email`, data, { timeout: 15000 });
    return response.data;
  } catch (error) {
    const serverData = error?.response?.data;
    const message =
      (typeof serverData === "object" && serverData?.message) ||
      (typeof serverData === "string" && serverData) ||
      error?.message ||
      "Xác thực email thất bại.";
    throw new Error(message);
  }
};

export const sendVerificationEmail = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/send-verification-email`, data, { timeout: 15000 });
    return response.data;
  } catch (error) {
    const serverData = error?.response?.data;
    const message =
      (typeof serverData === "object" && serverData?.message) ||
      (typeof serverData === "string" && serverData) ||
      error?.message ||
      "Không thể gửi email xác thực.";
    throw new Error(message);
  }
};

export const registerEmployee = async (data) => {
  try {
    const response = await axios.post(
      `${API_URL}/register`,
      {
        ...data,
        system_role: "employee",
      },
      { timeout: 15000 }
    );
    return response.data;
  } catch (error) {
    const errorName = String(error?.name || "");
    const errorCode = String(error?.code || "");
    const errorMessage = String(error?.message || "");
    const isCanceledOrTimeout =
      errorCode === "ERR_CANCELED" ||
      errorCode === "ECONNABORTED" ||
      errorName === "CanceledError" ||
      errorName === "AbortError" ||
      errorMessage.toLowerCase().includes("timeout");

    if (isCanceledOrTimeout) {
      const timeoutError = new Error("Tạo nhân viên mất quá nhiều thời gian. Vui lòng thử lại.");
      timeoutError.isTimeout = true;
      throw timeoutError;
    }

    const serverData = error?.response?.data;
    const message =
      (typeof serverData === "object" && serverData?.message) ||
      (typeof serverData === "string" && serverData) ||
      error?.message ||
      "Tạo nhân viên thất bại.";
    throw new Error(message);
  }
};
