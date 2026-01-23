import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FiCheckCircle, FiXCircle, FiLoader, FiArrowLeft } from "react-icons/fi";
import { paymentApi } from "../../api/paymentApi.js";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  
  const orderCode = searchParams.get("orderCode");
  const type = searchParams.get("type") || "success"; // success hoặc cancel

  useEffect(() => {
    const handlePaymentResult = async () => {
      if (!orderCode) {
        setError("Không tìm thấy mã đơn hàng.");
        setLoading(false);
        return;
      }

      try {
        if (type === "success") {
          // Cập nhật transaction thành công
          const res = await paymentApi.updateSuccessfulTransaction(orderCode);
          if (res?.success) {
            setResult({
              success: true,
              message: "Thanh toán thành công!",
              description: "Tiền cọc đã được xác nhận. Đơn đặt phòng của bạn đã được giữ chỗ.",
              data: res.data
            });
          } else {
            throw new Error(res?.error || "Không thể cập nhật trạng thái thanh toán.");
          }
        } else if (type === "cancel") {
          // Người dùng hủy thanh toán
          setResult({
            success: false,
            message: "Thanh toán đã bị hủy",
            description: "Bạn đã hủy quá trình thanh toán. Đơn đặt phòng vẫn được giữ nhưng chưa được xác nhận.",
            isCancel: true
          });
        }
      } catch (err) {
        console.error("Error handling payment result:", err);
        setError(err.response?.data?.error || err.message || "Có lỗi xảy ra khi xử lý kết quả thanh toán.");
      } finally {
        setLoading(false);
      }
    };

    handlePaymentResult();
  }, [orderCode, type]);

  if (loading) {
    return (
      <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
        <Sidebar />
        <div className="flex-1 ml-[270px]">
          <Topbar />
          <div className="p-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <FiLoader className="inline-block animate-spin text-6xl text-indigo-600 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Đang xử lý...</h2>
              <p className="text-gray-500">Vui lòng đợi trong giây lát.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
        <Sidebar />
        <div className="flex-1 ml-[270px]">
          <Topbar />
          <div className="p-8 max-w-4xl mx-auto">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
              <FiXCircle className="inline-block text-6xl text-red-500 mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Có lỗi xảy ra</h2>
              <p className="text-gray-500 mb-6">{error}</p>
              <button
                onClick={() => navigate("/booking-management")}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
              >
                <FiArrowLeft /> Quay lại danh sách đặt phòng
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12">
            <div className="text-center mb-8">
              {result?.success ? (
                <FiCheckCircle className="inline-block text-6xl text-green-500 mb-4" />
              ) : (
                <FiXCircle className="inline-block text-6xl text-orange-500 mb-4" />
              )}
              <h2 className={`text-3xl font-bold mb-2 ${result?.success ? 'text-green-600' : 'text-orange-600'}`}>
                {result?.message}
              </h2>
              <p className="text-gray-600 text-lg mt-4">{result?.description}</p>
            </div>

            {result?.data && (
              <div className="bg-gray-50 rounded-lg p-6 mb-6 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-4">Thông tin giao dịch</h3>
                <div className="space-y-2 text-sm">
                  {result.data.transaction && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Mã giao dịch:</span>
                        <span className="font-medium">{result.data.transaction.booking_code || orderCode}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Số tiền:</span>
                        <span className="font-medium text-green-600">
                          {result.data.transaction.amount?.toLocaleString('vi-VN')} VNĐ
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Trạng thái:</span>
                        <span className="font-medium text-green-600">Đã thanh toán</span>
                      </div>
                    </>
                  )}
                  {result.data.receipt && (
                    <div className="flex justify-between mt-4 pt-4 border-t border-gray-200">
                      <span className="text-gray-500">Hóa đơn:</span>
                      <span className="font-medium">Đã được tạo</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {result?.isCancel && (
              <div className="bg-orange-50 rounded-lg p-6 mb-6 border border-orange-200">
                <p className="text-orange-800 text-sm">
                  <strong>Lưu ý:</strong> Đơn đặt phòng của bạn vẫn được lưu nhưng chưa được xác nhận. 
                  Vui lòng thanh toán tiền cọc trong thời gian quy định để giữ chỗ.
                </p>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate("/booking-management")}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
              >
                <FiArrowLeft /> Quay lại danh sách đặt phòng
              </button>
              {result?.success && (
                <button
                  onClick={() => navigate("/dashboard")}
                  className="inline-flex items-center gap-2 bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-200 transition"
                >
                  Về trang chủ
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
