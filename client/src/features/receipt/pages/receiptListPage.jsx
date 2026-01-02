import React, { useEffect, useState } from "react";
import { FiSearch, FiPrinter, FiPlus, FiCalendar, FiFileText, FiDollarSign } from "react-icons/fi";
import Sidebar from "../../../components/sidebar";
import Topbar from "../../../components/topbar";
import ReceiptDetailModal from "../components/receiptDetailModal";
import CreateReceiptModal from "../components/createReceiptModal";
import ConfirmPaymentModal from "../components/confirmPaymentModal";
import { receiptApi } from "../../api/receiptApi";
import { StatusPill } from "../../../components/ui/label";

const PAYMENT_METHOD = {
  cash: "Tiền mặt",
  card: "Thẻ / POS",
  bank: "Chuyển khoản",
  "e-wallet": "Ví điện tử"
};

export default function ReceiptList() {
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState("");
  const [payment, setPayment] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

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

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />

        <div className="p-8 max-w-7xl mx-auto space-y-6">
          <div className="flex justify-between items-end border-b border-gray-200 pb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <FiFileText className="text-indigo-600"/> Quản lý Hóa Đơn
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
             </select>
             <select className="py-2 px-3 border rounded-lg text-sm outline-none" value={payment} onChange={e => setPayment(e.target.value)}>
                <option value="">Phương thức</option>
                <option value="cash">Tiền mặt</option>
                <option value="bank">Chuyển khoản</option>
                <option value="card">Thẻ</option>
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
                    ) : receipts.length === 0 ? (
                        <tr><td colSpan="7" className="text-center py-10 text-gray-400 italic">Không tìm thấy hóa đơn nào.</td></tr>
                    ) : (
                        receipts.map(item => (
                            <tr key={item._id} className="hover:bg-gray-50 transition">
                                <td className="py-4 px-6 font-mono text-xs text-gray-500 font-bold">
                                    #{item._id.slice(-6).toUpperCase()}
                                </td>
                                <td className="py-4 px-6 font-bold text-gray-800">
                                    {item.booking_id?.customer_id?.full_name || "Khách vãng lai"}
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
                                    <StatusPill
                                        label={item.status === 'paid' ? 'Đã thu tiền' : item.status === 'pending' ? 'Chưa thu' : item.status}
                                        color={item.status === 'paid' ? 'emerald' : item.status === 'pending' ? 'orange' : 'gray'}
                                        iconType={item.status === 'paid' ? 'success' : 'neutral'}
                                    />
                                </td>
                                <td className="py-4 px-6 text-center text-gray-500 text-xs">
                                    {new Date(item.created_at).toLocaleDateString("vi-VN")}
                                </td>
                                <td className="py-4 px-6 text-right flex justify-end gap-2">
                                    {(item.status === 'pending' || item.status === 'half-paid') && (
                                        <button
                                            onClick={() => setPaymentModalData(item)}
                                            className="flex items-center gap-1 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-emerald-200 transition"
                                            title="Xác nhận thu tiền"
                                        >
                                            <FiDollarSign /> Thu tiền
                                        </button>
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