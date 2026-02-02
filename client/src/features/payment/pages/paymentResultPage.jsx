import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { FiCheckCircle, FiXCircle, FiLoader, FiArrowLeft } from "react-icons/fi";
import { paymentApi } from "../../api/paymentApi.js";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";

// Nội dung theo loại thanh toán (receipt = thanh toán hóa đơn, booking = đặt cọc phòng)
const COPY = {
  receipt: {
    success: {
      message: "Thanh toán thành công!",
      description: "Hóa đơn đã được thanh toán. Cảm ơn bạn."
    },
    cancelled: {
      message: "Thanh toán chưa hoàn tất",
      description: "Quá trình thanh toán đã hủy. Hóa đơn vẫn ở trạng thái chờ thanh toán."
    }
  },
  booking: {
    success: {
      message: "Thanh toán thành công!",
      description: "Tiền cọc đã được xác nhận. Đơn đặt phòng của bạn đã được giữ chỗ."
    },
    cancelled: {
      message: "Thanh toán thất bại",
      description: "Quá trình thanh toán đã không hoàn tất. Đơn đặt phòng vẫn được giữ nhưng chưa được xác nhận đã đặt cọc."
    }
  }
};

export default function PaymentResultPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const orderCode = searchParams.get("orderCode");
  const source = searchParams.get("source") || "booking"; // receipt | booking
  const isSuccess = pathname.includes("success");
  const type = isSuccess ? "PAID" : "CANCELLED";

  useEffect(() => {
    const handlePaymentResult = async () => {
      if (!orderCode) {
        setError("Không tìm thấy mã đơn hàng.");
        setLoading(false);
        return;
      }

      const copyBySource = COPY[source] || COPY.booking;
      const copy = isSuccess ? copyBySource.success : copyBySource.cancelled;

      try {
        if (type === "PAID") {
          const res = await paymentApi.updateSuccessfulTransaction(orderCode);
          if (res?.success) {
            setResult({
              success: true,
              message: copy.message,
              description: copy.description,
              data: res.data,
              source
            });
          } else {
            throw new Error(res?.error || "Không thể cập nhật trạng thái thanh toán.");
          }
        } else if (type === "CANCELLED") {
          const res = await paymentApi.updateFailedTransaction(orderCode);
          if (res?.success) {
            setResult({
              success: false,
              message: copy.message,
              description: copy.description,
              data: res.data,
              source,
              isCancel: true
            });
          } else {
            setResult({
              success: false,
              message: copy.message,
              description: copy.description,
              data: res?.data,
              source,
              isCancel: true
            });
          }
        }
      } catch (err) {
        console.error("Error handling payment result:", err);
        setError(err.response?.data?.error || err.message || "Có lỗi xảy ra khi xử lý kết quả thanh toán.");
      } finally {
        setLoading(false);
      }
    };

    handlePaymentResult();
  }, [orderCode, type, isSuccess, source]);

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
    const errorSource = searchParams.get("source") || "booking";
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
              <div className="flex flex-wrap gap-3 justify-center">
                <button
                  onClick={() => navigate(errorSource === "receipt" ? "/invoices" : "/booking-management")}
                  className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
                >
                  <FiArrowLeft />
                  {errorSource === "receipt" ? "Quay lại danh sách hóa đơn" : "Quay lại danh sách đặt phòng"}
                </button>
                {errorSource === "receipt" && (
                  <button
                    onClick={() => navigate("/booking-management")}
                    className="inline-flex items-center gap-2 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-300 transition"
                  >
                    Danh sách đặt phòng
                  </button>
                )}
                {errorSource === "booking" && (
                  <button
                    onClick={() => navigate("/invoices")}
                    className="inline-flex items-center gap-2 bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-bold hover:bg-gray-300 transition"
                  >
                    Danh sách hóa đơn
                  </button>
                )}
              </div>
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
                        <span className={`font-medium ${
                          result.data.transaction.status === "completed" 
                            ? "text-green-600" 
                            : result.data.transaction.status === "failed"
                            ? "text-red-600"
                            : "text-gray-600"
                        }`}>
                          {result.data.transaction.status === "completed" 
                            ? "Đã thanh toán" 
                            : result.data.transaction.status === "failed"
                            ? "Chưa thanh toán"
                            : "Đang xử lý"}
                        </span>
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
                  {result?.source === "receipt" ? (
                    <>
                      <strong>Lưu ý:</strong> Hóa đơn vẫn ở trạng thái chờ thanh toán.
                      Bạn có thể thanh toán lại từ danh sách hóa đơn.
                    </>
                  ) : (
                    <>
                      <strong>Lưu ý:</strong> Đơn đặt phòng của bạn vẫn được lưu nhưng chưa được xác nhận.
                      Vui lòng thanh toán tiền cọc trong thời gian quy định để giữ chỗ.
                    </>
                  )}
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 justify-center">
              <button
                onClick={() => navigate(result?.source === "receipt" ? "/invoices" : "/booking-management")}
                className="inline-flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg font-bold hover:bg-indigo-700 transition"
              >
                <FiArrowLeft />
                {result?.source === "receipt" ? "Quay lại danh sách hóa đơn" : "Quay lại danh sách đặt phòng"}
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
