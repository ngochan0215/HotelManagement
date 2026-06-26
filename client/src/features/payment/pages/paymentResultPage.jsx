import React, { useEffect, useState } from "react";
import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { FiCheckCircle, FiXCircle, FiLoader, FiArrowLeft } from "react-icons/fi";
import { paymentApi } from "../../api/paymentApi.js";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import CustomerShell from "../../customer-portal/components/customerShell.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryError, setRetryError] = useState("");

  const orderCode = searchParams.get("orderCode");
  const source = searchParams.get("source") || "booking"; // receipt | booking
  const isCustomerBookingFlow = source === "booking";
  const isSuccess = pathname.includes("success");
  const type = isSuccess ? "PAID" : "CANCELLED";

  useEffect(() => {
    const handlePaymentResult = async () => {
      try {
        if (!orderCode) {
          if (isCustomerBookingFlow && !isSuccess) {
            setResult({
              success: false,
              message: "Thanh toán đã hủy",
              description: "Đặt phòng của bạn vẫn đang chờ thanh toán cọc.",
              data: null,
              source,
              isCancel: true,
            });
            return;
          }

          throw new Error("Không tìm thấy mã đơn hàng.");
        }

        const copyBySource = COPY[source] || COPY.booking;
        const copy = isSuccess ? copyBySource.success : copyBySource.cancelled;

        if (type === "PAID") {
          const res = await paymentApi.updateSuccessfulTransaction(orderCode);
          if (!res?.success) {
            throw new Error(res?.error || "Không thể cập nhật trạng thái thanh toán.");
          }

          setResult({
            success: true,
            message: copy.message,
            description: copy.description,
            data: res.data,
            source
          });
          return;
        }

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
          return;
        }

        throw new Error(res?.error || "Không thể cập nhật trạng thái thanh toán.");
      } catch (err) {
        console.error("Error handling payment result:", err);

        if (isCustomerBookingFlow && !isSuccess) {
          try {
            const detailRes = await paymentApi.getPaymentTransactionDetail(orderCode);
            setResult({
              success: false,
              message: "Thanh toán đã hủy",
              description: "Đặt phòng của bạn vẫn đang chờ thanh toán cọc.",
              data: detailRes?.data || null,
              source,
              isCancel: true,
              fallback: true,
            });
            return;
          } catch (fallbackErr) {
            setResult({
              success: false,
              message: "Thanh toán đã hủy",
              description: "Đặt phòng của bạn vẫn đang chờ thanh toán cọc.",
              data: null,
              source,
              isCancel: true,
              fallback: true,
            });
            console.error("Fallback payment detail error:", fallbackErr);
            return;
          }
        }

        setError(err.response?.data?.error || err.message || "Có lỗi xảy ra khi xử lý kết quả thanh toán.");
      } finally {
        setLoading(false);
      }
    };

    handlePaymentResult();
  }, [orderCode, type, isSuccess, source]);

  if (isCustomerBookingFlow) {
    const transaction = result?.data?.transaction || null;
    const receipt = result?.data?.receipt || null;
    const booking = transaction?.booking || receipt?.booking || null;
    const bookingId = booking?._id || receipt?.booking_id || transaction?.booking_id || "";
    const bookingCode = transaction?.booking_code || orderCode || "";
    const bookingStatus = String(booking?.status || "").toLowerCase();
    const isCancelState = Boolean(result?.isCancel);
    const canRetryPayment = !result?.success && (bookingStatus === "pending" || !bookingStatus) && Boolean(bookingId);
    const retryAmount = Number(receipt?.deposit_amount || transaction?.amount || 0);
    const statusLabel = result?.success
      ? "Đã thanh toán cọc"
      : isCancelState
        ? "Đã hủy thanh toán"
        : "Đang chờ thanh toán";
    const header = result?.success
      ? {
          title: "Thanh toán cọc thành công",
          description: "Tiền cọc đã được xác nhận. Đơn đặt phòng của bạn đã được giữ chỗ.",
        }
      : isCancelState
        ? {
            title: "Bạn đã hủy thanh toán cọc",
            description: "Đơn đặt phòng chưa được xác nhận. Bạn có thể thanh toán lại nếu vẫn muốn giữ chỗ.",
          }
        : {
            title: "Thanh toán chưa hoàn tất",
            description: "Giao dịch chưa được ghi nhận. Vui lòng thử lại hoặc quay lại đơn đặt phòng.",
          };

    const handleRetryPayment = async () => {
      const paymentUserId = user?._id || user?.userId || user?.id;
      if (!paymentUserId) {
        setRetryError("Vui lòng đăng nhập lại để thanh toán.");
        return;
      }

      if (!bookingId || !retryAmount) {
        setRetryError("Không thể tạo lại link thanh toán cho đơn này.");
        return;
      }

      setRetryError("");
      setRetryLoading(true);
      try {
        const paymentRes = await paymentApi.createPaymentLink(paymentUserId, {
          booking_id: bookingId,
          amount: retryAmount,
          description: `Tiền cọc đặt phòng #${String(bookingId).slice(-6)}`,
          items: [
            {
              name: "Tiền cọc đặt phòng",
              quantity: 1,
              price: retryAmount,
            },
          ],
        });

        const checkoutUrl = paymentRes?.data?.checkoutUrl;
        if (!checkoutUrl) {
          throw new Error("Không thể tạo link thanh toán. Vui lòng thử lại.");
        }

        window.location.assign(checkoutUrl);
      } catch (err) {
        setRetryError(err.response?.data?.message || err.message || "Không thể tạo lại thanh toán.");
      } finally {
        setRetryLoading(false);
      }
    };

    if (loading) {
      return (
        <CustomerShell>
          <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
            <div className="rounded-[32px] border border-stone-200 bg-white p-10 text-center shadow-sm">
              <FiLoader className="mx-auto mb-4 animate-spin text-5xl text-stone-950" />
              <h2 className="text-2xl font-semibold text-stone-950">Đang xử lý thanh toán...</h2>
              <p className="mt-3 text-sm leading-7 text-stone-600">Vui lòng chờ trong giây lát.</p>
            </div>
          </section>
        </CustomerShell>
      );
    }

    if (error) {
      return (
        <CustomerShell>
          <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
            <div className="rounded-[32px] border border-red-200 bg-red-50 p-8 text-center shadow-sm">
              <FiXCircle className="mx-auto mb-4 text-5xl text-red-600" />
              <h2 className="text-2xl font-semibold text-stone-950">Có lỗi xảy ra</h2>
              <p className="mt-3 text-sm leading-7 text-stone-700">{error}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => navigate("/hotel/bookings")}
                  className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                >
                  Xem đặt phòng của tôi
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/hotel/rooms")}
                  className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
                >
                  Xem phòng
                </button>
              </div>
            </div>
          </section>
        </CustomerShell>
      );
    }

    return (
      <CustomerShell>
        <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
          <div className="overflow-hidden rounded-[32px] border border-stone-200 bg-white shadow-sm">
            <div className={`px-6 py-8 md:px-8 ${result?.success ? "bg-emerald-50" : "bg-amber-50"}`}>
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${result?.success ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {result?.success ? <FiCheckCircle size={28} /> : <FiXCircle size={28} />}
                </div>
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.22em] text-stone-500">Thanh toán cọc</p>
                  <h1 className="mt-2 text-3xl font-semibold tracking-tight text-stone-950">{header.title}</h1>
                  <p className="mt-3 text-sm leading-7 text-stone-700">{header.description}</p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Mã giao dịch</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{bookingCode || "--"}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Trạng thái</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{statusLabel}</p>
                </div>
                <div className="rounded-2xl bg-stone-50 p-5">
                  <p className="text-sm text-stone-500">Mã đặt phòng</p>
                  <p className="mt-2 break-words text-lg font-semibold text-stone-900">{bookingId || "--"}</p>
                </div>
                <div className="rounded-2xl bg-amber-50 p-5">
                  <p className="text-sm text-amber-800">Số tiền</p>
                  <p className="mt-2 break-words text-lg font-semibold text-amber-900">
                    {transaction?.amount?.toLocaleString("vi-VN") || receipt?.deposit_amount?.toLocaleString("vi-VN") || "--"} VNĐ
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-4 text-sm leading-6 text-stone-600">
                {result?.success ? (
                  <p>Bạn có thể xem chi tiết đơn trong mục Đặt phòng của tôi.</p>
                ) : isCancelState ? (
                  <p>Đơn đặt phòng chưa được xác nhận. Bạn có thể thanh toán lại nếu vẫn muốn giữ chỗ.</p>
                ) : (
                  <p>Giao dịch chưa được ghi nhận. Vui lòng thử lại hoặc quay lại đơn đặt phòng.</p>
                )}
              </div>

              {retryError ? (
                <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{retryError}</p>
              ) : null}

              <div className="mt-8 flex flex-wrap gap-3">
                {result?.success ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(bookingId ? `/hotel/bookings?bookingCode=${encodeURIComponent(bookingId)}` : "/hotel/bookings")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                    >
                      Xem đặt phòng của tôi
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/hotel/rooms")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
                    >
                      Xem phòng
                    </button>
                  </>
                ) : isCancelState ? (
                  <>
                    <button
                      type="button"
                      onClick={() => navigate(bookingId ? `/hotel/bookings?bookingCode=${encodeURIComponent(bookingId)}` : "/hotel/bookings")}
                      className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                    >
                      Quay lại đơn đặt phòng
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/hotel/rooms")}
                      className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
                    >
                      Xem phòng
                    </button>
                  </>
                ) : canRetryPayment ? (
                  <button
                    type="button"
                    onClick={handleRetryPayment}
                    disabled={retryLoading}
                    className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {retryLoading ? "Đang tạo lại thanh toán..." : "Thanh toán lại"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate("/hotel/rooms")}
                    className="inline-flex items-center gap-2 rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Đặt phòng lại
                  </button>
                )}
                {result?.success ? null : !isCancelState ? (
                  <button
                    type="button"
                    onClick={() => navigate(bookingId ? `/hotel/bookings?bookingCode=${encodeURIComponent(bookingId)}` : "/hotel/bookings")}
                    className="inline-flex items-center gap-2 rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
                  >
                    Xem đặt phòng của tôi
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </section>
      </CustomerShell>
    );
  }

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
