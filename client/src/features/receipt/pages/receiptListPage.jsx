import React, { useEffect, useState } from "react";
import {
  FiSearch, FiPrinter, FiPlus, FiCalendar, FiFileText, FiDollarSign, FiCheckCircle, FiTag, FiLogOut,
  FiChevronLeft, FiChevronRight, FiRefreshCw
} from "react-icons/fi";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import ReceiptDetailModal from "../components/receiptDetailModal.jsx";
import CreateReceiptModal from "../components/createReceiptModal.jsx";
import ConfirmPaymentModal from "../components/confirmPaymentModal.jsx";
import { receiptApi } from "../../api/receiptApi.js";
import { paymentApi } from "../../api/paymentApi.js";
import { StatusPill } from "../../../components/ui/label.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";

const PAYMENT_METHOD = {
  cash: "Tiền mặt",
  bank: "Chuyển khoản (PayOS)",
  unknown: "Chưa biết"
};

const STATUS_MAP = {
  paid: {
    label: "Đã thanh toán",
    color: "emerald",
    iconType: "success",
  },
  pending: {
    label: "Chờ thanh toán",
    color: "orange",
    iconType: "neutral",
  },
  "half-paid": {
    label: "Thanh toán một phần",
    color: "yellow",
    iconType: "neutral",
  },
  cancelled: {
    label: "Đã hủy",
    color: "gray",
    iconType: "neutral",
  },
  refunded: {
    label: "Đã hoàn tiền",
    color: "blue",
    iconType: "neutral",
  },
};

export default function ReceiptList() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { user } = useAuth();
  let userId = user?._id;
  if (!userId && user?.token) {
    try { userId = jwtDecode(user.token).userId; } catch (err) {}
  }
  if (!userId) return alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại!");

  const fetchReceipts = async () => {
    setLoading(true);
    try {
      const params = { keyword, status, payment, from_date: fromDate, to_date: toDate };
      const res = await receiptApi.getAllReceipts(params);
      setReceipts(res.receipts || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => { fetchReceipts(); }, 500);
    return () => clearTimeout(timer);
  }, [keyword, status, payment, fromDate, toDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [keyword, status, payment, fromDate, toDate]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentReceipts = receipts.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(receipts.length / itemsPerPage);

  const handlePageChange = (page) => setCurrentPage(page);

  const renderPaginationButtons = () => {
    const pages = [];
    if (totalPages <= 1) return null;

    const delta = 2;
    const left = currentPage - delta;
    const right = currentPage + delta;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        range.push(i);
      }
    }

    let l;
    for (let i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push('...');
        }
      }
      rangeWithDots.push(i);
      l = i;
    }

    return (
      <div className="flex gap-2">
        <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <FiChevronLeft />
        </button>
        {rangeWithDots.map((page, index) => (
           page === '...' ? (
             <span key={`dots-${index}`} className="px-2 py-1 text-gray-400 self-center">...</span>
           ) : (
             <button
                key={page}
                onClick={() => handlePageChange(page)}
                className={`w-8 h-8 rounded-lg text-sm font-bold transition ${
                    currentPage === page
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                    : "border hover:bg-gray-50 text-gray-600"
                }`}
            >
                {page}
            </button>
           )
        ))}
        <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
            <FiChevronRight />
        </button>
      </div>
    );
  };
  // -------------------------

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />

        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                 Quản lý Hóa Đơn
              </h1>
              <p className="text-gray-500 text-sm mt-1">Theo dõi doanh thu và lịch sử thanh toán.</p>
            </div>

            <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-indigo-700 transition shadow-lg shadow-indigo-200"
            >
                <FiPlus size={20}/> Lập Hóa Đơn
            </button>
          </div>

          <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-wrap gap-4 items-center">
             <div className="relative flex-1 min-w-[200px]">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"/>
                <input
                    type="text"
                    placeholder="Tìm tên khách hàng..."
                    className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-200 outline-none"
                    value={keyword}
                    onChange={e => setKeyword(e.target.value)}
                />
             </div>
             <select className="py-2 px-3 border rounded-lg text-sm outline-none" value={status} onChange={e => setStatus(e.target.value)}>
                <option value="">Trạng thái</option>
                <option value="paid">Đã thanh toán</option>
                <option value="pending">Chờ thanh toán</option>
                <option value="half-paid">Thanh toán 1 phần</option>
                <option value="refunded">Đã hoàn tiền</option>
                <option value="cancelled">Đã hủy</option>
             </select>
             <select className="py-2 px-3 border rounded-lg text-sm outline-none" value={payment} onChange={e => setPayment(e.target.value)}>
                <option value="">Phương thức</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank">Chuyển khoản</option>
                <option value="unknown">Chưa biết</option>
             </select>
             <div className="flex items-center gap-2 border px-3 py-2 rounded-lg bg-white">
                <input type="date" className="text-sm outline-none" value={fromDate} onChange={e => setFromDate(e.target.value)} />
                <span>-</span>
                <input type="date" className="text-sm outline-none" value={toDate} onChange={e => setToDate(e.target.value)} />
             </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden min-h-[400px]">
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold border-b border-gray-100">
                    <tr>
                        <th className="py-4 px-6">Mã HĐ</th>
                        <th className="py-4 px-6">Khách hàng</th>
                        <th className="py-4 px-6 text-right">Tổng tiền</th>
                        <th className="py-4 px-6 text-center">Thanh toán</th>
                        <th className="py-4 px-6 text-center">Trạng thái</th>
                        <th className="py-4 px-6 text-center">Ngày tạo</th>
                        <th className="py-4 px-6 text-right">Hành động</th>
                    </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-50">
                    {loading ? (
                        <tr><td colSpan="7" className="text-center py-10 text-gray-400">Đang tải dữ liệu...</td></tr>
                    ) : currentReceipts.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-10 text-gray-400 italic">Không tìm thấy hóa đơn nào.</td></tr>
                    ) : (
                        currentReceipts.map(item => (
                            <tr key={item._id} className="hover:bg-gray-50 transition">
                                <td className="py-4 px-6 font-mono text-xs text-gray-500 font-bold">
                                    #{item._id.slice(-6).toUpperCase()}
                                </td>
                                <td className="py-4 px-6 font-bold text-gray-800">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {item.booking_id?.customer_id?.full_name || "Khách vãng lai"}
                                        {item.discount_snapshot && item.discount_snapshot.discount_amount > 0 && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold" title={`Khuyến mãi: ${item.discount_snapshot.name || item.discount_snapshot.code}`}>
                                                <FiTag size={10}/>
                                                KM
                                            </span>
                                        )}
                                        {(item.status === "pending" || item.status === "half-paid") &&
                                         (item.booking_id?.status === "checked_out" || item.booking_id?.status === "completed") && (
                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold" title="Đã checkout, chờ thanh toán">
                                                <FiLogOut size={10}/>
                                                Đã CO
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-400 font-normal">
                                        {item.booking_id?.customer_id?.phone_number}
                                    </div>
                                </td>
                                <td className="py-4 px-6 text-right font-bold text-indigo-600">
                                    {item.final_amount?.toLocaleString()} đ
                                </td>
                                <td className="py-4 px-6 text-center text-xs">
                                    {item.status === 'pending' ? (
                                        <span className="text-gray-400 italic font-mono">--</span>
                                    ) : (
                                        <span className="px-2 py-1 bg-gray-100 rounded border border-gray-200 font-bold text-gray-600">
                                            {PAYMENT_METHOD[item.payment] || item.payment}
                                        </span>
                                    )}
                                </td>
                                <td className="py-4 px-6 text-center">
                                  {(() => {
                                    const statusInfo = STATUS_MAP[item.status] || {
                                      label: item.status,
                                      color: "gray",
                                      iconType: "neutral",
                                    };

                                    return (
                                      <StatusPill
                                        label={statusInfo.label}
                                        color={statusInfo.color}
                                        iconType={statusInfo.iconType}
                                      />
                                    );
                                  })()}
                                </td>

                                <td className="py-4 px-6 text-center text-gray-500 text-xs">
                                    {new Date(item.created_at).toLocaleDateString("vi-VN")}
                                </td>
                                <td className="py-4 px-6 text-right flex justify-end gap-2">
                                    {item.status === 'pending' && item.deposit_amount > 0 && (
                                        <button
                                            onClick={async () => {
                                              try {
                                                const paymentData = {
                                                  receipt_id: item._id,
                                                  booking_id: item.booking_id?._id || item.booking_id,
                                                  amount: item.deposit_amount,
                                                  description: `Tiền cọc hóa đơn #${item._id.toString().slice(-6)}`,
                                                  items: [{
                                                    name: `Tiền cọc hóa đơn #${item._id.toString().slice(-6)}`,
                                                    quantity: 1,
                                                    price: item.deposit_amount
                                                  }]
                                                };

                                                const paymentRes = await paymentApi.createPaymentLink(userId, paymentData);

                                                if (paymentRes?.success && paymentRes?.data?.checkoutUrl) {
                                                  window.open(paymentRes.data.checkoutUrl, '_blank');
                                                  alert("Đã tạo link thanh toán PayOS. Vui lòng thanh toán tiền cọc trong cửa sổ mới.");
                                                  fetchReceipts();
                                                } else {
                                                  throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
                                                }
                                              } catch (error) {
                                                alert("Lỗi: " + (error.response?.data?.error || error.message));
                                              }
                                            }}
                                            className="flex items-center gap-1 bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-200 transition"
                                            title="Tạo link thanh toán tiền cọc"
                                        >
                                            <FiCheckCircle /> Xác nhận cọc
                                        </button>
                                    )}
                                    {(item.status === 'pending' || item.status === 'half-paid') && (
                                        <>
                                            <button
                                                onClick={async () => {
                                                  if (!window.confirm("Cập nhật hóa đơn để làm mới phí dịch vụ và bồi thường sau checkout?")) return;
                                                  try {
                                                    await receiptApi.refreshReceipt(item._id);
                                                    alert("Đã cập nhật hóa đơn thành công!");
                                                    fetchReceipts();
                                                  } catch (error) {
                                                    alert("Lỗi: " + (error.response?.data?.message || error.message));
                                                  }
                                                }}
                                                className="flex items-center gap-1 bg-blue-100 text-blue-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-blue-200 transition"
                                                title="Cập nhật phí dịch vụ và bồi thường sau checkout"
                                            >
                                                <FiRefreshCw size={14} /> Cập nhật
                                            </button>
                                            <button
                                                onClick={() => setPaymentModalData(item)}
                                                className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-200 transition"
                                                title="Xác nhận thu tiền"
                                            >
                                                <FiDollarSign /> Thu tiền
                                            </button>
                                        </>
                                    )}
                                    <button
                                        onClick={() => setSelectedReceipt(item)}
                                        className="text-gray-500 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition"
                                        title="Xem chi tiết & In"
                                    >
                                        <FiPrinter size={18}/>
                                    </button>
                                </td>
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
          </div>

          {receipts.length > 0 && (
            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                <div className="text-sm text-gray-500">
                    Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, receipts.length)}</b> trong tổng <b>{receipts.length}</b>
                </div>
                {renderPaginationButtons()}
            </div>
          )}

        </div>
      </div>

      {selectedReceipt && (
        <ReceiptDetailModal receipt={selectedReceipt} onClose={() => setSelectedReceipt(null)} />
      )}

      {paymentModalData && (
        <ConfirmPaymentModal
            receipt={paymentModalData}
            onClose={() => setPaymentModalData(null)}
            onSuccess={fetchReceipts}
        />
      )}

      {showCreateModal && (
        <CreateReceiptModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={fetchReceipts}
        />
      )}
    </div>
  );
}