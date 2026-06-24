import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, KeyRound, Mail, ShieldCheck, CheckCircle2, Sparkles } from "lucide-react";
import { resetPassword } from "../api/authApi.js";

const PASSWORD_RULE_TEXT = "Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.";

function isValidPassword(password) {
  return /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/.test(String(password || ""));
}

function getErrorMessage(error) {
  const rawMessage = error?.message || error?.msg || (typeof error === "string" ? error : "");
  const message = String(rawMessage || "").toLowerCase();
  if (message.includes("otp không hợp lệ") || message.includes("otp khong hop le") || message.includes("hết hạn") || message.includes("het han")) {
    return "Mã xác thực hoặc liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.";
  }
  return String(rawMessage || "").trim() || "Không thể kết nối đến máy chủ. Vui lòng thử lại.";
}

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form, setForm] = useState({
    email: "",
    otp: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const canSubmit =
    !loading &&
    form.email.trim() &&
    form.otp.trim() &&
    form.newPassword &&
    form.confirmPassword &&
    form.newPassword === form.confirmPassword &&
    isValidPassword(form.newPassword);

  useEffect(() => {
    const queryEmail = searchParams.get("email") || "";
    if (queryEmail) {
      setForm((prev) => ({ ...prev, email: prev.email || queryEmail }));
    }
  }, [searchParams]);

  const validate = () => {
    const nextErrors = {};
    if (!form.email.trim()) nextErrors.email = "Vui lòng nhập email.";
    if (!form.otp.trim()) nextErrors.otp = "Vui lòng nhập mã xác thực.";
    if (!form.newPassword) nextErrors.newPassword = "Vui lòng nhập mật khẩu mới.";
    else if (!isValidPassword(form.newPassword)) nextErrors.newPassword = PASSWORD_RULE_TEXT;
    if (!form.confirmPassword) nextErrors.confirmPassword = "Vui lòng xác nhận mật khẩu mới.";
    else if (form.confirmPassword !== form.newPassword) nextErrors.confirmPassword = "Mật khẩu xác nhận không khớp.";

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    if (!validate()) return;

    setLoading(true);
    setError("");

    try {
      await resetPassword({
        email: form.email.trim(),
        otp: form.otp.trim(),
        newPassword: form.newPassword,
      });
      setSuccess(true);
      setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(form.email.trim())}`, { replace: true });
      }, 2200);
    } catch (err) {
      setSuccess(false);
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
            <ShieldCheck size={14} />
            Đặt lại mật khẩu
          </div>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">Tạo mật khẩu mới cho tài khoản</h1>
          <p className="mt-4 text-sm leading-7 text-stone-300">
            Nhập email, mã OTP trong email và mật khẩu mới để hoàn tất quá trình đặt lại mật khẩu.
          </p>
        </div>

        <div className="p-6 md:p-10">
          <div className="mb-6">
            <Link to="/forgot-password" className="inline-flex items-center gap-2 text-sm font-semibold text-stone-600 transition hover:text-stone-950">
              <ArrowLeft size={16} />
              Quay lại quên mật khẩu
            </Link>
          </div>

          <div className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-6 md:p-8">
            {!success ? (
              <>
                <h2 className="text-3xl font-semibold text-stone-950">Đặt lại mật khẩu</h2>
                <p className="mt-3 text-sm leading-7 text-stone-600">
                  Nhập email, mã xác thực và mật khẩu mới để hoàn tất quá trình đặt lại mật khẩu.
                </p>

                <form onSubmit={handleSubmit} className="mt-7 grid gap-4">
                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    <span>Email</span>
                    <div className="relative">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, email: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, email: "" }));
                        }}
                        placeholder="you@example.com"
                        className="w-full rounded-2xl border border-stone-200 bg-white px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                    </div>
                    {fieldErrors.email ? <span className="text-xs font-medium text-red-600">{fieldErrors.email}</span> : null}
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    <span>Mã xác thực</span>
                    <div className="relative">
                      <KeyRound size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" />
                      <input
                        value={form.otp}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, otp: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, otp: "" }));
                        }}
                        placeholder="Nhập mã xác thực"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="w-full rounded-2xl border border-stone-200 bg-white px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                    </div>
                    {fieldErrors.otp ? <span className="text-xs font-medium text-red-600">{fieldErrors.otp}</span> : null}
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    <span>Mật khẩu mới</span>
                    <div className="relative">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        value={form.newPassword}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, newPassword: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, newPassword: "" }));
                        }}
                        placeholder="Nhập mật khẩu mới"
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 pr-12 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                        aria-label={showNewPassword ? "Ẩn mật khẩu mới" : "Hiện mật khẩu mới"}
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <span className="text-xs text-stone-500">{PASSWORD_RULE_TEXT}</span>
                    {fieldErrors.newPassword ? <span className="text-xs font-medium text-red-600">{fieldErrors.newPassword}</span> : null}
                  </label>

                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    <span>Xác nhận mật khẩu mới</span>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={form.confirmPassword}
                        onChange={(e) => {
                          setForm((prev) => ({ ...prev, confirmPassword: e.target.value }));
                          setFieldErrors((prev) => ({ ...prev, confirmPassword: "" }));
                        }}
                        placeholder="Nhập lại mật khẩu mới"
                        className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 pr-12 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900"
                        aria-label={showConfirmPassword ? "Ẩn xác nhận mật khẩu" : "Hiện xác nhận mật khẩu"}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {fieldErrors.confirmPassword ? <span className="text-xs font-medium text-red-600">{fieldErrors.confirmPassword}</span> : null}
                  </label>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {loading ? "Đang cập nhật..." : "Đặt lại mật khẩu"}
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
                  <h2 className="text-3xl font-semibold text-stone-950">Đặt lại mật khẩu thành công</h2>
                  <p className="mt-3 text-sm leading-7 text-stone-600">
                    Bạn có thể đăng nhập bằng mật khẩu mới.
                  </p>
                  <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700">
                    <Sparkles size={16} className="text-amber-600" />
                    {form.email.trim()}
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => navigate(`/login?email=${encodeURIComponent(form.email.trim())}`, { replace: true })}
                    className="inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Đăng nhập ngay
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate(`/forgot-password?email=${encodeURIComponent(form.email.trim())}`, { replace: true })}
                    className="inline-flex items-center justify-center rounded-2xl border border-stone-200 bg-white px-5 py-4 text-sm font-semibold text-stone-800 transition hover:bg-stone-50"
                  >
                    Gửi lại hướng dẫn
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
