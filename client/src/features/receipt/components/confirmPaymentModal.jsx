import React, { useState } from "react";
import { FiX, FiDollarSign, FiCheckCircle, FiInfo, FiExternalLink, FiTag } from "react-icons/fi";
import { jwtDecode } from "jwt-decode";
import { receiptApi } from "../../api/receiptApi.js";
import { paymentApi } from "../../api/paymentApi.js";
import { useAuth } from "../../auth/hooks/authContext.jsx";

export default function ConfirmPaymentModal({ receipt, onClose, onSuccess }) {
  const [method, setMethod] = useState("cash");
  const [loading, setLoading] = useState(false);
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);

  const { user } = useAuth();
  let userId = user?._id;
  if (!userId && user?.token) {
    try { userId = jwtDecode(user.token).userId; } catch (err) {}
  }
  if (!userId) return alert("Phiên làm việc hết hạn. Vui lòng đăng nhập lại!");

  const handleConfirm = async () => {
    // Nếu là chuyển khoản, tạo payment link PayOS
    if (method === "bank") {
      setCreatingPaymentLink(true);
      try {
        // Tạo payment link cho receipt
        const paymentData = {
          receipt_id: receipt._id,
          booking_id: receipt.booking_id?._id || receipt.booking_id,
          amount: receipt.amount_due,
          description: `Thanh toán hóa đơn #${receipt._id.toString().slice(-6)}`,
          items: [{
            name: `Thanh toán hóa đơn #${receipt._id.toString().slice(-6)}`,
            quantity: 1,
            price: receipt.amount_due
          }]
        };

        const paymentRes = await paymentApi.createPaymentLink(userId, paymentData);
        
        if (paymentRes?.success && paymentRes?.data?.checkoutUrl) {
          // Mở link thanh toán trong tab mới
          window.open(paymentRes.data.checkoutUrl, '_blank');
          alert("Đã tạo link thanh toán PayOS. Vui lòng thanh toán trong cửa sổ mới. Hệ thống sẽ tự động cập nhật khi thanh toán thành công.");
          onSuccess?.();
          onClose();
        } else {
          throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
        }
      } catch (error) {
        alert("Lỗi: " + (error.response?.data?.error || error.message));
      } finally {
        setCreatingPaymentLink(false);
      }
      return;
    }

    // Nếu là tiền mặt, xác nhận trực tiếp
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
    { id: "bank", label: "Chuyển khoản (PayOS)", icon: <FiCheckCircle size={20}/> },
  ];

  const baseRoomFee = receipt.base_room_fee || receipt.total_fee || 0;
  const roomFee = receipt.total_fee || 0;
  const serviceFee = receipt.service_fee || 0;
  const compensateFee = receipt.compensate_fee || 0;
  const deposit = receipt.deposit_amount || 0;
  const discountSnapshot = receipt.discount_snapshot;
  const discountAmount = discountSnapshot?.discount_amount || 0;

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
                <span className="text-gray-600">Tiền phòng gốc:</span>
                <span className="font-medium">{baseRoomFee.toLocaleString()} đ</span>
             </div>
             {discountSnapshot && discountAmount > 0 && (
                <div className="bg-emerald-50 p-2 rounded border border-emerald-200 -mx-2">
                  <div className="flex items-center gap-2 mb-1">
                    <FiTag className="text-emerald-600" size={12}/>
                    <span className="text-xs font-bold text-emerald-700">Khuyến mãi: {discountSnapshot.name || discountSnapshot.code}</span>
                  </div>
                  {discountSnapshot.description && (
                    <div className="text-xs text-emerald-600 italic mb-1">{discountSnapshot.description}</div>
                  )}
                  {discountSnapshot.code && (
                    <div className="text-xs text-emerald-500 font-mono">Mã: {discountSnapshot.code}</div>
                  )}
                </div>
             )}
             <div className="flex justify-between">
                <span className="text-gray-600">Tiền phòng (sau KM):</span>
                <span className="font-medium">{roomFee.toLocaleString()} đ</span>
             </div>
             {discountAmount > 0 && (
                <div className="flex justify-between text-emerald-700">
                    <span className="text-emerald-700">Giảm giá:</span>
                    <span className="font-bold">- {discountAmount.toLocaleString()} đ</span>
                </div>
             )}
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
                        disabled={loading || creatingPaymentLink}
                        className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition ${
                            method === m.id
                            ? "bg-emerald-100 border-emerald-500 text-emerald-800"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                        } ${loading || creatingPaymentLink ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                        {m.icon}
                        <span className="text-xs font-bold">{m.label}</span>
                        {m.id === "bank" && method === "bank" && (
                          <span className="text-[10px] text-gray-500 mt-0.5">(Mở link PayOS)</span>
                        )}
                    </button>
                ))}
            </div>
            {method === "bank" && (
              <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                <FiInfo className="inline mr-1" size={12}/>
                Khi chọn chuyển khoản, hệ thống sẽ tạo link thanh toán PayOS và mở trong tab mới.
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-3 bg-white">
             <button 
               onClick={onClose} 
               disabled={loading || creatingPaymentLink}
               className="flex-1 py-2 rounded-lg border font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
             >
               Hủy
             </button>
             <button
                onClick={handleConfirm}
                disabled={loading || creatingPaymentLink}
                className="flex-1 py-2 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition disabled:opacity-50 flex items-center justify-center gap-2"
             >
                {creatingPaymentLink ? (
                  <>
                    <span className="animate-spin">⏳</span> Đang tạo link thanh toán...
                  </>
                ) : loading ? (
                  "Đang xử lý..."
                ) : method === "bank" ? (
                  <>
                    <FiExternalLink size={16}/> Tạo Link Thanh Toán
                  </>
                ) : (
                  "Xác nhận Đã Thu"
                )}
             </button>
        </div>
      </div>
    </div>
  );
}