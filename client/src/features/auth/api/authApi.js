import { useState } from 'react';
import axios from "axios";
import API_BASE_URL from "../../../config/apiConfig.js";

const API_URL = `${API_BASE_URL}/auth`;

export const loginUser = async (credentials) => {
  try {
    const response = await axios.post(`${API_URL}/login`, credentials);
    return response.data;
  } catch (error) {
    throw error.response ? error.response.data : error;
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
    throw error.response ? error.response.data : error;
  }
};

export const resetPassword = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/reset-password`, data);
    return response.data;
  } catch (error) {
    console.log("Error in resetPassword:", error);
    throw error.response ? error.response.data : error;
  }
};

