import axios from "axios";

const employeeAPI = axios.create({
  baseURL: process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3003",
  timeout: 5000
});

export const employeeClient = {
  findEmployeeByUserId: async (id) => {
    const res = await employeeAPI.get(`/find-by-userId/${id}`);
    return res.data.employee;
  },

  createEmployee: async ({ userId, payload }) => {
    const res = await employeeAPI.post(`/create-employee/${userId}`, payload);
    return res.data;
  }
};