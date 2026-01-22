import React, { useState } from "react";
import { FiX, FiDollarSign, FiCreditCard, FiSmartphone, FiCheckCircle, FiInfo } from "react-icons/fi";
import { receiptApi } from "../../api/receiptApi.js";

export default function ConfirmPaymentModal({ receipt, onClose, onSuccess }) {
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await receiptApi.updateReceipt(receipt._id, {
        status: "paid",
        payment: method
      });

      alert(`Đã xác nhận thu ${receipt.amount_due?.toLocaleString()}đ thành công!`);
      onSuccess?.();
      onClose();
    } catch (error) {
      alert("Lỗi: " + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const methods = [
    { id: "cash", label: "Tiền mặt", icon: <FiDollarSign size={20}/> },
    { id: "bank", label: "Chuyển khoản", icon: <FiCheckCircle size={20}/> },
    { id: "card", label: "Thẻ tín dụng", icon: <FiCreditCard size={20}/> },
    { id: "e-wallet", label: "Ví điện tử", icon: <FiSmartphone size={20}/> },
  ];

  const roomFee = receipt.total_fee || 0;
  const serviceFee = receipt.service_fee || 0;
  const compensateFee = receipt.compensate_fee || 0;
  const deposit = receipt.deposit_amount || 0;

  const discountAmount = 0;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">

        <div className="px-6 py-4 border-b border-gray-100 bg-emerald-50 flex justify-between items-center">
          <h3 className="font-bold text-lg text-emerald-800">Xác nhận Thu tiền</h3>
          <button onClick={onClose}><FiX className="text-gray-500 hover:text-emerald-700"/></button>
        </div>
        <div className="p-6 space-y-5 overflow-y-auto">
          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-sm space-y-2">
             <div className="flex items-center gap-2 text-gray-500 text-xs font-bold uppercase mb-2 border-b border-gray-200 pb-1">
                <FiInfo/> Chi tiết khoản thu
             </div>
             <div className="flex justify-between">
                <span className="text-gray-600">Tiền phòng:</span>
                <span className="font-medium">{roomFee.toLocaleString()} đ</span>
             </div>
             <div className="flex justify-between">
                <span className="text-gray-600">Dịch vụ sử dụng:</span>
                <span className={`font-medium ${serviceFee > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                    {serviceFee > 0 ? `+ ${serviceFee.toLocaleString()}` : "0"} đ
                </span>
             </div>
             <div className="flex justify-between">
                <span className="text-gray-600">Phụ phí:</span>
                <span className={`font-medium ${compensateFee > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>
                    {compensateFee > 0 ? `+ ${compensateFee.toLocaleString()}` : "0"} đ
                </span>
             </div>
             <div className="flex justify-between">
                <span className="text-gray-600">Khuyến mãi:</span>
                <span className={`font-medium ${discountAmount > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {discountAmount > 0 ? `- ${discountAmount.toLocaleString()}` : "0"} đ
                </span>
             </div>
             <div className="flex justify-between border-b border-gray-300 pb-2">
                <span className="text-gray-600">Đã đặt cọc:</span>
                <span className={`font-medium ${deposit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                    {deposit > 0 ? `- ${deposit.toLocaleString()}` : "0"} đ
                </span>
             </div>

             <div className="pt-2 flex justify-between items-center mt-2">
                <span className="font-bold text-gray-800 text-base">Cần thanh toán:</span>
                <span className="font-black text-xl text-emerald-600">
                    {receipt.amount_due?.toLocaleString()} đ
                </span>
             </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Hình thức thanh toán:</label>
            <div className="grid grid-cols-2 gap-3">
                {methods.map((m) => (
                    <button
                        key={m.id}
                        onClick={() => setMethod(m.id)}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition ${
                            method === m.id
                            ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                    >
                        {m.icon}
                        <span className="text-xs font-bold">{m.label}</span>
                    </button>
                ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3 bg-white">
             <button onClick={onClose} className="flex-1 py-2 rounded-lg border font-bold text-gray-600 hover:bg-gray-50">Hủy</button>
             <button
                onClick={handleConfirm}
                disabled={loading}
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition"
             >
                {loading ? "Đang xử lý..." : "Xác nhận Đã Thu"}
             </button>
        </div>
      </div>
    </div>
  );
}