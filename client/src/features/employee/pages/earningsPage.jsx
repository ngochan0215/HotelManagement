import React, { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { 
  FiDollarSign, FiTrendingUp, FiClock, FiCheckCircle, 
  FiXCircle, FiLoader, FiRefreshCw, FiCalendar,
  FiArrowDown, FiArrowUp, FiInfo
} from "react-icons/fi";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import Toast from "../../../components/toast.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import { employeeApi } from "../../api/employeeApi.js";

export default function EarningsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    onConfirm: null
  });

  // Data states
  const [availableAmount, setAvailableAmount] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);
  const [earnings, setEarnings] = useState([]);
  const [payouts, setPayouts] = useState([]);
  const [earningsPagination, setEarningsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });
  const [payoutsPagination, setPayoutsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 1
  });

  // Filters
  const [earningsFilter, setEarningsFilter] = useState({
    status: "",
    start_date: "",
    end_date: ""
  });
  const [payoutsFilter, setPayoutsFilter] = useState({
    status: "",
    start_date: "",
    end_date: ""
  });

  // Load data
  const loadAvailableAmount = async () => {
    try {
      const res = await employeeApi.getAvailableCashout();
      if (res.success) {
        setAvailableAmount(res.data || 0);
      }
    } catch (error) {
      console.error("Error loading available amount:", error);
    }
  };

  const loadTotalWithdrawn = async () => {
    try {
      const res = await employeeApi.getCashoutAmount("all");
      if (res.success) {
        setTotalWithdrawn(res.data || 0);
      }
    } catch (error) {
      console.error("Error loading total withdrawn:", error);
    }
  };

  const loadEarnings = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        ...earningsFilter
      };
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === "" || params[key] === null) delete params[key];
      });

      const res = await employeeApi.getEarningsHistory(params);
      if (res.success) {
        setEarnings(res.data.earnings || []);
        setEarningsPagination(res.data.pagination || {});
      }
    } catch (error) {
      setToast({
        type: "error",
        message: "Lỗi khi tải lịch sử thu nhập: " + (error.response?.data?.message || error.message)
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPayouts = async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: 20,
        ...payoutsFilter
      };
      // Remove empty filters
      Object.keys(params).forEach(key => {
        if (params[key] === "" || params[key] === null) delete params[key];
      });

      const res = await employeeApi.getPayoutHistory(params);
      if (res.success) {
        setPayouts(res.data.payouts || []);
        setPayoutsPagination(res.data.pagination || {});
      }
    } catch (error) {
      setToast({
        type: "error",
        message: "Lỗi khi tải lịch sử rút tiền: " + (error.response?.data?.message || error.message)
      });
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (availableAmount <= 0) {
      setToast({
        type: "warning",
        message: "Không có tiền để rút"
      });
      return;
    }

    setConfirmState({
      open: true,
      title: "Xác nhận rút tiền",
      message: `Bạn có chắc chắn muốn rút ${formatCurrency(availableAmount)}?`,
      onConfirm: async () => {
        setWithdrawing(true);
        setConfirmState({ ...confirmState, open: false });
        try {
          const res = await employeeApi.cashOut();
          if (res.success) {
            setToast({
              type: "success",
              message: res.message || "Yêu cầu rút tiền thành công!"
            });
            // Reload data
            await Promise.all([
              loadAvailableAmount(),
              loadTotalWithdrawn(),
              loadPayouts(1)
            ]);
          }
        } catch (error) {
          setToast({
            type: "error",
            message: error.response?.data?.message || "Lỗi khi rút tiền"
          });
        } finally {
          setWithdrawing(false);
        }
      }
    });
  };

  useEffect(() => {
    loadAvailableAmount();
    loadTotalWithdrawn();
  }, []);

  useEffect(() => {
    if (activeTab === "earnings") {
      loadEarnings(1);
    } else if (activeTab === "payouts") {
      loadPayouts(1);
    }
  }, [activeTab, earningsFilter, payoutsFilter]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND"
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      available: { label: "Có thể rút", color: "bg-green-100 text-green-800" },
      pending: { label: "Đang chờ", color: "bg-yellow-100 text-yellow-800" },
      paid: { label: "Đã thanh toán", color: "bg-blue-100 text-blue-800" },
      processing: { label: "Đang xử lý", color: "bg-purple-100 text-purple-800" },
      completed: { label: "Hoàn thành", color: "bg-green-100 text-green-800" },
      failed: { label: "Thất bại", color: "bg-red-100 text-red-800" }
    };
    const statusInfo = statusMap[status] || { label: status, color: "bg-gray-100 text-gray-800" };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    );
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar />
        
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Thu nhập & Rút tiền</h1>
              <p className="text-gray-600">Quản lý thu nhập và rút tiền lương của bạn</p>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm mb-6">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab("overview")}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "overview"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Tổng quan
                  </button>
                  <button
                    onClick={() => setActiveTab("earnings")}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "earnings"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Lịch sử thu nhập
                  </button>
                  <button
                    onClick={() => setActiveTab("payouts")}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === "payouts"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Lịch sử rút tiền
                  </button>
                </nav>
              </div>
            </div>

            {/* Overview Tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-green-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Có thể rút</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {formatCurrency(availableAmount)}
                        </p>
                      </div>
                      <div className="bg-green-100 p-3 rounded-full">
                        <FiDollarSign className="w-6 h-6 text-green-600" />
                      </div>
                    </div>
                    <button
                      onClick={loadAvailableAmount}
                      className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center"
                    >
                      <FiRefreshCw className="w-4 h-4 mr-1" />
                      Làm mới
                    </button>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-blue-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Đã rút</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {formatCurrency(totalWithdrawn)}
                        </p>
                      </div>
                      <div className="bg-blue-100 p-3 rounded-full">
                        <FiTrendingUp className="w-6 h-6 text-blue-600" />
                      </div>
                    </div>
                    <button
                      onClick={loadTotalWithdrawn}
                      className="mt-4 text-sm text-gray-500 hover:text-gray-700 flex items-center"
                    >
                      <FiRefreshCw className="w-4 h-4 mr-1" />
                      Làm mới
                    </button>
                  </div>

                  <div className="bg-white rounded-lg shadow-sm p-6 border-l-4 border-purple-500">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Tổng thu nhập</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">
                          {formatCurrency(availableAmount + totalWithdrawn)}
                        </p>
                      </div>
                      <div className="bg-purple-100 p-3 rounded-full">
                        <FiClock className="w-6 h-6 text-purple-600" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Withdraw Section */}
                <div className="bg-white rounded-lg shadow-sm p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Rút tiền</h2>
                  
                  {availableAmount > 0 ? (
                    <div className="space-y-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <p className="text-sm text-gray-600 mb-2">Số tiền có thể rút</p>
                        <p className="text-3xl font-bold text-gray-900">
                          {formatCurrency(availableAmount)}
                        </p>
                      </div>
                      
                      <button
                        onClick={handleWithdraw}
                        disabled={withdrawing}
                        className="w-full bg-indigo-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {withdrawing ? (
                          <>
                            <FiLoader className="w-5 h-5 mr-2 animate-spin" />
                            Đang xử lý...
                          </>
                        ) : (
                          <>
                            <FiArrowDown className="w-5 h-5 mr-2" />
                            Rút tiền ngay
                          </>
                        )}
                      </button>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start">
                        <FiInfo className="w-5 h-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-blue-800">
                          <p className="font-medium mb-1">Lưu ý:</p>
                          <ul className="list-disc list-inside space-y-1">
                            <li>Tiền sẽ được chuyển vào tài khoản ngân hàng đã đăng ký</li>
                            <li>Thời gian xử lý: 1-3 ngày làm việc</li>
                            <li>Vui lòng đảm bảo thông tin tài khoản ngân hàng chính xác</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FiDollarSign className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">Hiện tại không có tiền để rút</p>
                      <p className="text-sm text-gray-500 mt-2">
                        Tiền lương sẽ được tính sau mỗi ca làm việc
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Earnings History Tab */}
            {activeTab === "earnings" && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h2 className="text-lg font-semibold text-gray-900">Lịch sử thu nhập</h2>
                    
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={earningsFilter.status}
                        onChange={(e) => setEarningsFilter({ ...earningsFilter, status: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="available">Có thể rút</option>
                        <option value="pending">Đang chờ</option>
                        <option value="paid">Đã thanh toán</option>
                      </select>
                      
                      <input
                        type="date"
                        value={earningsFilter.start_date}
                        onChange={(e) => setEarningsFilter({ ...earningsFilter, start_date: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Từ ngày"
                      />
                      
                      <input
                        type="date"
                        value={earningsFilter.end_date}
                        onChange={(e) => setEarningsFilter({ ...earningsFilter, end_date: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Đến ngày"
                      />
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 text-center">
                    <FiLoader className="w-8 h-8 text-gray-400 mx-auto animate-spin" />
                    <p className="mt-4 text-gray-600">Đang tải...</p>
                  </div>
                ) : earnings.length === 0 ? (
                  <div className="p-12 text-center">
                    <FiClock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Chưa có lịch sử thu nhập</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ngày làm việc
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Số giờ
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Mức lương/giờ
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Số tiền
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Trạng thái
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {earnings.map((earning) => (
                            <tr key={earning._id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <FiCalendar className="w-4 h-4 text-gray-400 mr-2" />
                                  <span className="text-sm text-gray-900">
                                    {format(parseISO(earning.period_date), "dd/MM/yyyy")}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {earning.work_hours} giờ
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrency(earning.hourly_rate)}/giờ
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {formatCurrency(earning.earning_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(earning.status)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {earningsPagination.totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                          Trang {earningsPagination.page} / {earningsPagination.totalPages}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadEarnings(earningsPagination.page - 1)}
                            disabled={earningsPagination.page === 1}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                          >
                            Trước
                          </button>
                          <button
                            onClick={() => loadEarnings(earningsPagination.page + 1)}
                            disabled={earningsPagination.page >= earningsPagination.totalPages}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Payouts History Tab */}
            {activeTab === "payouts" && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <h2 className="text-lg font-semibold text-gray-900">Lịch sử rút tiền</h2>
                    
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2">
                      <select
                        value={payoutsFilter.status}
                        onChange={(e) => setPayoutsFilter({ ...payoutsFilter, status: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                      >
                        <option value="">Tất cả trạng thái</option>
                        <option value="pending">Đang chờ</option>
                        <option value="processing">Đang xử lý</option>
                        <option value="completed">Hoàn thành</option>
                        <option value="failed">Thất bại</option>
                      </select>
                      
                      <input
                        type="date"
                        value={payoutsFilter.start_date}
                        onChange={(e) => setPayoutsFilter({ ...payoutsFilter, start_date: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Từ ngày"
                      />
                      
                      <input
                        type="date"
                        value={payoutsFilter.end_date}
                        onChange={(e) => setPayoutsFilter({ ...payoutsFilter, end_date: e.target.value })}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        placeholder="Đến ngày"
                      />
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="p-12 text-center">
                    <FiLoader className="w-8 h-8 text-gray-400 mx-auto animate-spin" />
                    <p className="mt-4 text-gray-600">Đang tải...</p>
                  </div>
                ) : payouts.length === 0 ? (
                  <div className="p-12 text-center">
                    <FiArrowDown className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">Chưa có lịch sử rút tiền</p>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ngày yêu cầu
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Kỳ thanh toán
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Số tiền
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Trạng thái
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Ngày xử lý
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {payouts.map((payout) => (
                            <tr key={payout._id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  <FiCalendar className="w-4 h-4 text-gray-400 mr-2" />
                                  <span className="text-sm text-gray-900">
                                    {format(parseISO(payout.created_at), "dd/MM/yyyy HH:mm")}
                                  </span>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {format(parseISO(payout.period_start), "dd/MM/yyyy")} - {format(parseISO(payout.period_end), "dd/MM/yyyy")}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {formatCurrency(payout.total_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {getStatusBadge(payout.status)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {payout.processed_at 
                                  ? format(parseISO(payout.processed_at), "dd/MM/yyyy HH:mm")
                                  : "-"
                                }
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {payoutsPagination.totalPages > 1 && (
                      <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                        <div className="text-sm text-gray-700">
                          Trang {payoutsPagination.page} / {payoutsPagination.totalPages}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => loadPayouts(payoutsPagination.page - 1)}
                            disabled={payoutsPagination.page === 1}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                          >
                            Trước
                          </button>
                          <button
                            onClick={() => loadPayouts(payoutsPagination.page + 1)}
                            disabled={payoutsPagination.page >= payoutsPagination.totalPages}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-sm disabled:opacity-50"
                          >
                            Sau
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Toast */}
      {toast && (
        <Toast
          type={toast.type}
          message={toast.message}
          onClose={() => setToast(null)}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState({ ...confirmState, open: false })}
      />
    </div>
  );
}
