//mock data
export const dashboardApi = {
  getOverview: () =>
    Promise.resolve({
      data: {
        revenue: 7852000,
        revenueChangePercent: 2.1,
        updatedAt: "2025-11-03 02:17",

        roomStatus: {
          empty: 85,
          busy: 85,
          repair: 92,
        },

        cancelReasons: [
          { label: "Đổi lịch trình", value: 40, count: 1890 },
          { label: "Đặt nhầm", value: 32, count: 1520 },
          { label: "Lý do khác", value: 28, count: 1310 },
        ],

        topRoomTypes: [
          { name: "Phòng VIP Hướng Biển", price: 1200000 },
          { name: "Phòng Deluxe Đôi", price: 950000 },
          { name: "Phòng Standard", price: 650000 },
          { name: "Phòng Suite Cao Cấp", price: 1800000 },
        ],
      },
    }),

  getBookingStats: () =>
    Promise.resolve({
      data: {
        total: 2568,
        percentChange: -2.1,
        updatedAt: "2025-11-03 02:17",
        chart: [
          { day: 1, current: 120, lastWeek: 150 },
          { day: 2, current: 160, lastWeek: 130 },
          { day: 3, current: 100, lastWeek: 200 },
          { day: 4, current: 180, lastWeek: 140 },
          { day: 5, current: 140, lastWeek: 160 },
          { day: 6, current: 210, lastWeek: 175 },
        ],
      },
    }),
};
