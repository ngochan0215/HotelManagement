import axios from "axios";
import API_BASE_URL from "../../config/apiConfig.js";

const getAuthHeader = () => {
  const token = localStorage.getItem("token");
  return { headers: { Authorization: `Bearer ${token}` } };
};

const BASE_URL = `${API_BASE_URL}/employees`;
const SCHEDULES_BASE_URL = `${BASE_URL}/schedules`;

function flattenEarningsFromMyEarnings(apiData) {
  const byDate = apiData?.by_date || {};
  const hourlyRate = apiData?.hourly_rate ?? 0;
  const earnings = [];
  for (const day of Object.values(byDate)) {
    for (const shift of day.shifts || []) {
      earnings.push({
        _id: shift._id,
        period_date: day.work_date,
        work_hours: shift.work_hours,
        hourly_rate: hourlyRate,
        earning_amount: shift.earning_amount,
        status: shift.status,
      });
    }
  }
  return earnings;
}

export const employeeApi = {
  getAllEmployees: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/`, {
      ...getAuthHeader(),
      params
    });
    return res.data;
  },

  getBriefEmployees: async () => {
    const res = await axios.get(`${BASE_URL}/brief`, getAuthHeader());
    return res.data;
  },

  getAllShifts: async (params = {}) => {
    const res = await axios.get(`${BASE_URL}/shifts`, {
      ...getAuthHeader(),
      params,
    });
    return res.data;
  },

  getShiftById: async (id) => {
    const res = await axios.get(`${BASE_URL}/shifts/${id}`, getAuthHeader());
    return res.data;
  },

  createShift: async (data) => {
    const res = await axios.post(`${BASE_URL}/shifts`, data, getAuthHeader());
    return res.data;
  },

  updateShift: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/shifts/${id}`, data, getAuthHeader());
    return res.data;
  },

  deleteShift: async (id) => {
    const res = await axios.delete(`${BASE_URL}/shifts/${id}`, getAuthHeader());
    return res.data;
  },
  
  createEmployee: async (data) => {
    const res = await axios.post(`${BASE_URL}/`, data, getAuthHeader());
    return res.data;
  },

  updateEmployee: async (id, data) => {
    const res = await axios.patch(`${BASE_URL}/${id}`, data, getAuthHeader());
    return res.data;
  },

  getEmployeesByPosition: async (position) => {
      const res = await axios.get(
        `${BASE_URL}/`,
        {
          ...getAuthHeader(),
          params: { position }
        }
      );

      return res.data?.employees ?? [];
  },

  createAccountForExisting: async (employeeId, data) => {
      const url = `${BASE_URL}/create-account/${employeeId}`;
      const res = await axios.post(url, data, getAuthHeader());
      return res.data;
    },

  getProfile: async () => {
      const res = await axios.get(`${BASE_URL}/my-profile`, getAuthHeader());
      return res.data;
  },
    resetPassword: async (employeeId, newPassword) => {
        const url = `${BASE_URL}/reset-password/${employeeId}`;
        const res = await axios.patch(url, { newPassword }, getAuthHeader());
        return res.data;
    },

  toggleBanUser: async (employeeId, isBanned) => {
        const url = `${BASE_URL}/toggle-ban/${employeeId}`;
        const res = await axios.patch(url, { isBanned }, getAuthHeader());
        return res.data;
    },

    getAllSchedules: async (params = {}) => {
      const res = await axios.get(`${SCHEDULES_BASE_URL}`, {
        ...getAuthHeader(),
        params,
      });
      return res.data;
    },

    getScheduleById: async (id) => {
      const res = await axios.get(`${SCHEDULES_BASE_URL}/${id}`, getAuthHeader());
      return res.data;
    },

    getScheduleContractById: async (id, params = {}) => {
      const res = await axios.get(`${SCHEDULES_BASE_URL}/contracts/${id}`, {
        ...getAuthHeader(),
        params,
      });
      return res.data;
    },

    updateScheduleContractStatus: async (id, data) => {
      const res = await axios.patch(`${SCHEDULES_BASE_URL}/contracts/${id}`, data, getAuthHeader());
      return res.data;
    },

    getPendingScheduleRequests: async (params = {}) => {
      const res = await axios.get(`${SCHEDULES_BASE_URL}/pending-requests`, {
        ...getAuthHeader(),
        params,
      });
      return res.data;
    },

    getMySchedule: async (params = {}) => {
      const res = await axios.get(`${SCHEDULES_BASE_URL}/my`, {
        ...getAuthHeader(),
        params,
      });
      return res.data;
    },

    getAvailableShifts: async (params = {}) => {
      const res = await axios.get(`${SCHEDULES_BASE_URL}/available-shifts`, {
        ...getAuthHeader(),
        params,
      });
      return res.data;
    },

    registerSchedule: async (data) => {
      const res = await axios.post(`${SCHEDULES_BASE_URL}`, data, getAuthHeader());
      return res.data;
    },

    updateSchedule: async (id, data) => {
      const res = await axios.patch(`${SCHEDULES_BASE_URL}/${id}`, data, getAuthHeader());
      return res.data;
    },

    deleteSchedule: async (id) => {
      const res = await axios.delete(`${SCHEDULES_BASE_URL}/${id}`, getAuthHeader());
      return res.data;
    },

    cancelScheduleContract: async (id, data = {}) => {
      const res = await axios.post(`${SCHEDULES_BASE_URL}/cancel-contract/${id}`, data, getAuthHeader());
      return res.data;
    },

    getMyAttendanceSummary: async (params = {}) => {
      const res = await axios.get(`${BASE_URL}/attendances/my-summary`, {
        ...getAuthHeader(),
        params,
      });
      return res.data;
    },

    checkInShift: async (scheduleId) => {
      const res = await axios.post(`${BASE_URL}/attendances/check-in/${scheduleId}`, {}, getAuthHeader());
      return res.data;
    },

    checkOutShift: async () => {
      const res = await axios.post(`${BASE_URL}/attendances/check-out`, {}, getAuthHeader());
      return res.data;
    },

    cashOut: async () => {
        const res = await axios.put(`${BASE_URL}/cashOut`, {}, getAuthHeader());
        return res.data;
    },

    getCashoutAmount: async (timespan = 'day') => {
        const res = await axios.get(`${BASE_URL}/cashOut`, {
            ...getAuthHeader(),
            params: { timespan }
        });
        return res.data;
    },

    getAvailableCashout: async () => {
        const res = await axios.get(`${BASE_URL}/cashOut/available`, getAuthHeader());
        return res.data;
    },

    getEarningsHistory: async (params = {}) => {
        const res = await axios.get(`${BASE_URL}/earnings/my`, {
            ...getAuthHeader(),
            params: {
              status: params.status,
              start_date: params.start_date,
              end_date: params.end_date,
              period_date: params.period_date,
            },
        });
        const payload = res.data?.data;
        const earnings = flattenEarningsFromMyEarnings(payload);
        return {
            success: res.data?.success ?? true,
            data: {
                earnings,
                pagination: {
                    page: params.page ?? 1,
                    limit: params.limit ?? 20,
                    total: earnings.length,
                    totalPages: 1,
                },
            },
        };
    },

    getPayoutHistory: async (params = {}) => {
        const res = await axios.get(`${BASE_URL}/payouts`, {
            ...getAuthHeader(),
            params
        });
        return res.data;
    },
};
