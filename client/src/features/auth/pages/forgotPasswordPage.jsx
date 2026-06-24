import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Mail, ShieldAlert, Sparkles } from "lucide-react";
import { forgotPassword } from "../api/authApi.js";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function getErrorMessage(error) {
  const rawMessage = error?.message || error?.msg || (typeof error === "string" ? error : "");
  const message = String(rawMessage || "").toLowerCase();
  if (message.includes("không tìm thấy email") || message.includes("khong tim thay email")) {
    return "Nếu email này tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.";
  }
  return String(rawMessage || "").trim() || "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
}

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const hasSuccess = Boolean(message);

  useEffect(() => {
    const queryEmail = searchParams.get("email") || "";
    if (queryEmail) setEmail(queryEmail);
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

      const normalizedEmail = email.trim();
      if (!normalizedEmail) {
      setError("Vui lòng nhập email.");
      setMessage("");
      return;
    }
    if (!isValidEmail(normalizedEmail)) {
      setError("Email không hợp lệ.");
      setMessage("");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");

    try {
      await forgotPassword(normalizedEmail);
      setSubmittedEmail(normalizedEmail);
      setMessage("Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#f6f2eb_0%,#fcfbf8_100%)] px-4 py-10">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-[36px] border border-stone-200 bg-white shadow-[0_30px_80px_rgba(28,25,23,0.12)] lg:grid-cols-[0.9fr,1.1fr]">
        <div className="bg-stone-950 p-7 text-white md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200">
            <ShieldAlert size={14} />
            Quên mật khẩu
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">Lấy lại quyền truy cập tài khoản</h1>
          <p className="mt-4 text-sm leading-7 text-stone-300">
            Nhập email đã đăng ký để SE Hotel gửi mã OTP đặt lại mật khẩu. Sau đó bạn có thể chuyển sang màn đặt lại mật khẩu để tạo mật khẩu mới.
          </p>
        </div>

        <div className="p-6 md:p-10">
          <div className="mb-6">
            <Link to="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-stone-950">
              <ArrowLeft size={16} />
              Quay lại đăng nhập
            </Link>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-6 md:p-8">
            {!hasSuccess ? (
              <>
                <h2 className="text-3xl font-semibold text-stone-950">Quên mật khẩu</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  Nhập email đã đăng ký, chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu.
                </p>

                <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    <span>Email</span>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-2xl border border-stone-200 bg-white px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                    </div>
                  </label>

                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Đang gửi..." : "Gửi hướng dẫn"}
                  </button>
                </form>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="grid gap-5 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 size={30} />
                </div>
                <div>
                  <h2 className="text-3xl font-semibold text-stone-950">Kiểm tra email của bạn</h2>
                  <p className="mt-3 text-sm leading-7 text-stone-600">
                    Nếu email này tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu đã được gửi.
                  </p>
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700">
                    <Sparkles size={16} className="text-amber-600" />
                    {submittedEmail || email.trim()}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => navigate("/login", { replace: true })}
                    className="inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Quay lại đăng nhập
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/reset-password?email=${encodeURIComponent(submittedEmail || email.trim())}`)}
                    className="inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
                  >
                    Nhập mã xác thực
                  </button>
                </div>

                <div className="rounded-2xl border border-dashed border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
                  Bạn sẽ cần mã OTP trong email để đặt lại mật khẩu.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
