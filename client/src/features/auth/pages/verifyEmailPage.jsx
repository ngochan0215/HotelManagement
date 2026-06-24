import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CircleAlert, KeyRound, Mail, ShieldCheck } from "lucide-react";
import { verifyEmail } from "../api/authApi.js";

const VERIFICATION_STORAGE_KEY = "pending-email-verification";

function readPendingVerification() {
  try {
    const raw = sessionStorage.getItem(VERIFICATION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      userId: parsed.userId || parsed.userID || "",
      email: parsed.email || "",
    };
  } catch {
    return null;
  }
}

export default function VerifyEmailPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState({ userId: "", email: "" });

  useEffect(() => {
    const pending = readPendingVerification();
    const userId = searchParams.get("userId") || pending?.userId || "";
    const email = searchParams.get("email") || pending?.email || "";

    setVerificationInfo({ userId, email });
    setMessage(email ? `Mã OTP đã được gửi tới ${email}.` : "Vui lòng nhập mã OTP được gửi đến email của bạn.");
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    if (!verificationInfo.userId) {
      setError("Thiếu userId để xác thực email. Hãy mở lại từ màn đăng ký hoặc đăng ký lại.");
      return;
    }

    if (!otp.trim()) {
      setError("Vui lòng nhập mã OTP.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await verifyEmail({ userId: verificationInfo.userId, otp: otp.trim() });
      setSuccess(true);
      setMessage("Xác thực email thành công. Bạn có thể đăng nhập ngay bây giờ.");
      sessionStorage.removeItem(VERIFICATION_STORAGE_KEY);

      setTimeout(() => {
        navigate(`/login${verificationInfo.email ? `?email=${encodeURIComponent(verificationInfo.email)}` : ""}`, { replace: true });
      }, 1800);
    } catch (err) {
      setSuccess(false);
      setError(err?.message || "Xác thực email thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#f6f2eb_0%,#fcfbf8_100%)] px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-stone-200 bg-white shadow-[0_30px_80px_rgba(28,25,23,0.12)] lg:grid-cols-[0.9fr,1.1fr]">
        <div className="bg-stone-950 p-7 text-white md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
            <ShieldCheck size={14} />
            Xác thực tài khoản
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">Nhập mã OTP để kích hoạt tài khoản</h1>
          <p className="mt-4 text-sm leading-7 text-stone-300">
            Sau khi xác thực email, bạn sẽ đăng nhập được vào hệ thống đặt phòng và sử dụng đầy đủ chức năng của SE Hotel.
          </p>

          <div className="mt-8 space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-5 text-sm text-stone-200">
            <p className="flex items-start gap-3">
              <Mail size={16} className="mt-0.5 text-amber-300" />
              <span>{verificationInfo.email ? `OTP đã được gửi đến ${verificationInfo.email}.` : "OTP được gửi đến email bạn vừa đăng ký."}</span>
            </p>
            <p className="flex items-start gap-3">
              <KeyRound size={16} className="mt-0.5 text-amber-300" />
              <span>Nhập đúng mã OTP trong email để hoàn tất xác thực.</span>
            </p>
            <p className="flex items-start gap-3">
              <CircleAlert size={16} className="mt-0.5 text-amber-300" />
              <span>Nếu không thấy email, hãy kiểm tra cả thư mục spam hoặc quảng cáo.</span>
            </p>
          </div>
        </div>

        <div className="p-6 md:p-10">
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-stone-950">
              <ArrowLeft size={16} />
              Quay lại đăng nhập
            </Link>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-6 md:p-8">
            <h2 className="text-3xl font-semibold text-stone-950">Xác thực email</h2>
            <p className="mt-3 text-sm leading-7 text-stone-600">
              Nhập mã OTP từ email để hoàn tất tạo tài khoản. Sau khi xác thực xong, bạn sẽ được chuyển về màn đăng nhập.
            </p>

            <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
              <label className="grid gap-2 text-sm font-medium text-stone-700">
                <span>Mã OTP</span>
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Nhập mã OTP"
                  className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </label>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Đang xác thực..." : "Xác thực email"}
              </button>
            </form>

            {message ? (
              <div
                className={`mt-5 rounded-2xl px-4 py-3 text-sm ${
                  success ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-amber-200 bg-amber-50 text-amber-900"
                }`}
              >
                {message}
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
              Hiện giao diện chưa có chức năng gửi lại OTP vì backend chưa mở endpoint resend.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
