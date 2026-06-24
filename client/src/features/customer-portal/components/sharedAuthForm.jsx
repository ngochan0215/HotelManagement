import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { KeyRound, Mail, Phone, UserRound } from "lucide-react";
import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { customerApi } from "../../api/customerApi.js";
import { employeeApi } from "../../api/employeeApi.js";
import { getAuthIdentity, getRoleRedirectPath } from "../../auth/utils/roleRedirect.js";
import { HOTEL_IMAGE_SETS } from "./imageCatalog.js";
import { HotelImage, SectionHeader, StatusBadge } from "./sitePrimitives.jsx";

function getErrorMessage(error) {
  const rawMessage = error?.response?.data?.message || error?.message || error?.msg || (typeof error === "string" ? error : "");
  const message = String(rawMessage || "").toLowerCase();
  if (message.includes("verify") || message.includes("verified") || message.includes("verification") || message.includes("chưa được xác thực") || message.includes("chua duoc xac thuc")) {
    return "Tài khoản chưa được xác thực email. Vui lòng kiểm tra email hoặc liên hệ SE Hotel để được hỗ trợ.";
  }
  return rawMessage || "Đăng nhập thất bại. Vui lòng kiểm tra email và mật khẩu.";
}

function getLoginIdentity(response) {
  const user = response?.theUser || {};
  return getAuthIdentity({
    role: user.role || user.system_role || response?.role,
    position: user.position || response?.position,
  });
}

const PASSWORD_RULE_TEXT = "Ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.";
const VERIFICATION_STORAGE_KEY = "pending-email-verification";

function getVerificationPayload() {
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

function buildVerifyEmailPath(payload = {}) {
  const params = new URLSearchParams();
  if (payload.userId) params.set("userId", payload.userId);
  if (payload.email) params.set("email", payload.email);
  const query = params.toString();
  return `/verify-email${query ? `?${query}` : ""}`;
}

function isVerificationError(error) {
  const rawMessage = error?.response?.data?.message || error?.message || error?.msg || (typeof error === "string" ? error : "");
  const message = String(rawMessage || "").toLowerCase();
  return (
    message.includes("verify") ||
    message.includes("verified") ||
    message.includes("verification") ||
    message.includes("chưa được xác thực") ||
    message.includes("chua duoc xac thuc")
  );
}

function Field({ label, icon: Icon, children, required = false, hint = "", error = "", optional = false }) {
  return (
    <label className="grid gap-2 text-sm font-medium text-stone-700">
      <span>
        {label}{" "}
        {required ? <span className="font-semibold text-red-600">*</span> : null}
        {!required && optional ? <span className="text-stone-500">(không bắt buộc)</span> : null}
      </span>
      <div className="relative">
        {Icon ? <Icon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" /> : null}
        {children}
      </div>
      {hint ? <span className="text-xs text-stone-500">{hint}</span> : null}
      {error ? <span className="text-xs font-medium text-red-600">{error}</span> : null}
    </label>
  );
}

export default function SharedAuthForm({ embedded = false }) {
  const { login, loginGoogle } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState("login");
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [verificationHelp, setVerificationHelp] = useState(null);
  const [credentials, setCredentials] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    full_name: "",
    email: "",
    password: "",
    phone_number: "",
    nationality: "Vietnam",
    CCCD: "",
    date_birth: "",
  });
  const [registerErrors, setRegisterErrors] = useState({});

  // Google new-user completion state
  const [googlePendingToken, setGooglePendingToken] = useState(null);
  const [googleNewUserData, setGoogleNewUserData] = useState(null); // { email, name, picture }
  const [googleCompletion, setGoogleCompletion] = useState({
    phone_number: "",
    CCCD: "",
    date_birth: "",
    nationality: "Vietnam",
  });
  const [googleCompletionErrors, setGoogleCompletionErrors] = useState({});

  const loginInFlightRef = useRef(false);
  const registerInFlightRef = useRef(false);
  const googleInFlightRef = useRef(false);

  useEffect(() => {
    const queryEmail = searchParams.get("email");
    if (!queryEmail) return;
    setCredentials((prev) => ({ ...prev, email: prev.email || queryEmail }));
    setRegisterForm((prev) => ({ ...prev, email: prev.email || queryEmail }));
  }, [searchParams]);

  useEffect(() => {
    const queryTab = searchParams.get("tab");
    if (queryTab === "register" || queryTab === "login") {
      setTab(queryTab);
    }
  }, [searchParams]);

  const validateRegisterForm = () => {
    const errors = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[@$!%*#?&]).{8,}$/;

    if (!registerForm.full_name.trim()) errors.full_name = "Vui lòng nhập họ và tên.";
    if (!registerForm.email.trim()) {
      errors.email = "Vui lòng nhập email.";
    } else if (!emailRegex.test(registerForm.email.trim())) {
      errors.email = "Email không đúng định dạng.";
    }
    if (!registerForm.password) {
      errors.password = "Vui lòng nhập mật khẩu.";
    } else if (!passwordRegex.test(registerForm.password)) {
      errors.password = PASSWORD_RULE_TEXT;
    }
    if (!registerForm.phone_number.trim()) errors.phone_number = "Vui lòng nhập số điện thoại.";
    if (!registerForm.CCCD.trim()) errors.CCCD = "Vui lòng nhập CCCD.";
    if (!registerForm.date_birth) errors.date_birth = "Vui lòng chọn ngày sinh.";

    setRegisterErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateGoogleCompletion = () => {
    const errors = {};
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    const cccdRegex = /^[0-9]{12}$/;

    if (!googleCompletion.phone_number.trim()) {
      errors.phone_number = "Vui lòng nhập số điện thoại.";
    } else if (!phoneRegex.test(googleCompletion.phone_number.trim())) {
      errors.phone_number = "Số điện thoại không hợp lệ.";
    }

    if (!googleCompletion.CCCD.trim()) {
      errors.CCCD = "Vui lòng nhập CCCD.";
    } else if (!cccdRegex.test(googleCompletion.CCCD.trim())) {
      errors.CCCD = "CCCD phải gồm đúng 12 chữ số.";
    }

    if (!googleCompletion.date_birth) {
      errors.date_birth = "Vui lòng chọn ngày sinh.";
    } else {
      const dob = new Date(googleCompletion.date_birth);
      let age = new Date().getFullYear() - dob.getFullYear();
      const m = new Date().getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && new Date().getDate() < dob.getDate())) age--;
      if (age < 18) errors.date_birth = "Bạn phải đủ 18 tuổi để đăng ký tài khoản.";
    }

    setGoogleCompletionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const redirectAfterLogin = async (response) => {
    const { role, position } = getLoginIdentity(response);
    if (role) localStorage.setItem("role", role);
    if (position) localStorage.setItem("position", position);

    if (position || role !== "employee") {
      navigate(getRoleRedirectPath({ role, position }));
      return;
    }

    try {
      const res = await employeeApi.getProfile();
      const employee = res.employee || res.data || res;
      const { position: pos } = getAuthIdentity({ role, position: employee?.position });
      if (pos) localStorage.setItem("position", pos);

      navigate(getRoleRedirectPath({ role, position: pos }));
    } catch {
      navigate("/dashboard");
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loginLoading || loginInFlightRef.current) return;
    loginInFlightRef.current = true;
    setLoginLoading(true);
    setMessage("");
    setVerificationHelp(null);
    try {
      const response = await login(credentials);
      await redirectAfterLogin(response);
    } catch (error) {
      const pendingVerification = getVerificationPayload();
      const errorMessage = getErrorMessage(error);
      setMessage(errorMessage);
      if (isVerificationError(error)) {
        setVerificationHelp({
          email: credentials.email.trim() || pendingVerification?.email || "",
          userId: pendingVerification?.userId || "",
        });
      }
    } finally {
      setLoginLoading(false);
      loginInFlightRef.current = false;
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (registerLoading || registerInFlightRef.current) return;
    registerInFlightRef.current = true;
    setRegisterError("");
    if (!validateRegisterForm()) {
      setRegisterError("Vui lòng kiểm tra lại các trường bắt buộc.");
      registerInFlightRef.current = false;
      return;
    }
    setRegisterLoading(true);
    setMessage("");
    setVerificationHelp(null);
    try {
      const response = await customerApi.registerCustomer(registerForm);
      const verificationPayload = {
        userId: response?.userID || response?.userId || response?.user?._id || "",
        email: registerForm.email.trim(),
      };
      sessionStorage.setItem(VERIFICATION_STORAGE_KEY, JSON.stringify(verificationPayload));
      navigate(buildVerifyEmailPath(verificationPayload), { replace: true });
    } catch (error) {
      if (error?.isTimeout) {
        setRegisterError(error.message);
      } else {
        setRegisterError(error?.message || "Đăng ký thất bại.");
      }
    } finally {
      setRegisterLoading(false);
      registerInFlightRef.current = false;
    }
  };

  // Step 1: Google button clicked → verify token, check if user exists
  const handleGoogleLogin = async (credential) => {
    if (googleLoading || googleInFlightRef.current) return;
    googleInFlightRef.current = true;
    setGoogleLoading(true);
    setMessage("");
    try {
      const response = await loginGoogle({ googleToken: credential });
      if (response?.isNewUser) {
        setGooglePendingToken(credential);
        setGoogleNewUserData(response.googleData);
      } else {
        await redirectAfterLogin(response);
      }
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setGoogleLoading(false);
      googleInFlightRef.current = false;
    }
  };

  // Step 2: new Google user submits their missing profile fields
  const handleGoogleComplete = async (e) => {
    e.preventDefault();
    if (!validateGoogleCompletion()) return;
    if (googleLoading || googleInFlightRef.current) return;
    googleInFlightRef.current = true;
    setGoogleLoading(true);
    setMessage("");
    try {
      const response = await loginGoogle({
        googleToken: googlePendingToken,
        profileData: googleCompletion,
      });
      await redirectAfterLogin(response);
    } catch (error) {
      setMessage(getErrorMessage(error));
    } finally {
      setGoogleLoading(false);
      googleInFlightRef.current = false;
    }
  };

  const cancelGoogleCompletion = () => {
    setGoogleNewUserData(null);
    setGooglePendingToken(null);
    setGoogleCompletion({ phone_number: "", CCCD: "", date_birth: "", nationality: "Vietnam" });
    setGoogleCompletionErrors({});
    setMessage("");
  };

  const openVerificationPage = () => {
    const pendingVerification = getVerificationPayload();
    navigate(
      buildVerifyEmailPath({
        userId: verificationHelp?.userId || pendingVerification?.userId || "",
        email: verificationHelp?.email || pendingVerification?.email || credentials.email.trim() || registerForm.email.trim() || "",
      })
    );
  };

  return (
    <div className={`${embedded ? "" : "min-h-screen"} bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#f6f2eb_0%,#fcfbf8_100%)] px-4 py-10`}>
      <div className="mx-auto grid w-full max-w-6xl overflow-hidden rounded-[36px] border border-stone-200 bg-white shadow-[0_30px_80px_rgba(28,25,23,0.12)] lg:grid-cols-[0.9fr,1.1fr]">
        {/* Left panel */}
        <div className="bg-stone-950 p-7 text-white md:p-10">
          <StatusBadge tone="warning">Tài khoản SE Hotel</StatusBadge>
          <h1 className="mt-6 text-4xl font-semibold leading-tight">Chào mừng đến với SE Hotel</h1>
          <p className="mt-4 text-sm leading-7 text-stone-300">
            Đăng nhập để tiếp tục đặt phòng, quản lý thông tin lưu trú và nhận hỗ trợ từ khách sạn.
          </p>
          <div className="mt-8">
            <HotelImage src={HOTEL_IMAGE_SETS.hero[1]} alt="Sảnh tiếp đón và khu nghỉ sang trọng của SE Hotel" ratio="wide" fallbackLabel="Không gian SE Hotel" />
          </div>
          <div className="mt-8 space-y-3 text-sm leading-7 text-stone-200">
            <p>Thông tin tài khoản giúp SE Hotel phục vụ bạn nhanh chóng và chính xác hơn.</p>
            <p>Đội ngũ khách sạn luôn sẵn sàng hỗ trợ trước và trong kỳ lưu trú.</p>
          </div>
        </div>

        {/* Right panel */}
        <div className="p-6 md:p-10">
          {googleNewUserData ? (
            /* ── Google new-user completion form ── */
            <>
              <SectionHeader
                eyebrow="Đăng ký qua Google"
                title="Hoàn tất tài khoản"
                description="Tài khoản Google của bạn chưa được liên kết. Vui lòng điền thêm thông tin để hoàn tất đăng ký."
              />

              {/* Google account info card */}
              <div className="mt-6 flex items-center gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-5 py-4">
                {googleNewUserData.picture ? (
                  <img src={googleNewUserData.picture} alt="avatar" className="h-12 w-12 rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-stone-200 text-stone-600">
                    <UserRound size={22} />
                  </div>
                )}
                <div>
                  <p className="text-sm font-semibold text-stone-900">{googleNewUserData.name}</p>
                  <p className="text-xs text-stone-500">{googleNewUserData.email}</p>
                </div>
              </div>

              <form onSubmit={handleGoogleComplete} className="mt-6 grid gap-4 md:grid-cols-2">
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:col-span-2">
                  Các trường có dấu <span className="font-semibold text-red-600">*</span> là bắt buộc.
                </p>

                <Field label="Số điện thoại" icon={Phone} required hint="Ví dụ: 09xxxxxxxx hoặc +84xxxxxxxxx" error={googleCompletionErrors.phone_number}>
                  <input
                    value={googleCompletion.phone_number}
                    onChange={(e) => {
                      setGoogleCompletion((prev) => ({ ...prev, phone_number: e.target.value }));
                      setGoogleCompletionErrors((prev) => ({ ...prev, phone_number: "" }));
                    }}
                    placeholder="Ví dụ: 0912345678"
                    className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    required
                  />
                </Field>

                <Field label="CCCD" required hint="CCCD gồm 12 chữ số." error={googleCompletionErrors.CCCD}>
                  <input
                    value={googleCompletion.CCCD}
                    onChange={(e) => {
                      setGoogleCompletion((prev) => ({ ...prev, CCCD: e.target.value }));
                      setGoogleCompletionErrors((prev) => ({ ...prev, CCCD: "" }));
                    }}
                    placeholder="Ví dụ: 012345678901"
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    required
                  />
                </Field>

                <Field label="Ngày sinh" required hint="Bạn phải từ 18 tuổi trở lên." error={googleCompletionErrors.date_birth}>
                  <input
                    type="date"
                    value={googleCompletion.date_birth}
                    onChange={(e) => {
                      setGoogleCompletion((prev) => ({ ...prev, date_birth: e.target.value }));
                      setGoogleCompletionErrors((prev) => ({ ...prev, date_birth: "" }));
                    }}
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    required
                  />
                </Field>

                <Field label="Quốc tịch" optional>
                  <input
                    value={googleCompletion.nationality}
                    onChange={(e) => setGoogleCompletion((prev) => ({ ...prev, nationality: e.target.value }))}
                    placeholder="Ví dụ: Vietnam"
                    className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </Field>

                <div className="flex gap-3 md:col-span-2">
                  <button
                    type="button"
                    onClick={cancelGoogleCompletion}
                    className="flex-1 rounded-2xl border border-stone-200 px-5 py-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={googleLoading}
                    className="flex-[2] inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {googleLoading ? "Đang xử lý..." : "Hoàn tất đăng ký"}
                  </button>
                </div>
              </form>

              {message ? (
                <p className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {message}
                </p>
              ) : null}
            </>
          ) : (
            /* ── Normal login / register tabs ── */
            <>
              <SectionHeader
                eyebrow="Tài khoản"
                title="Chào mừng đến với SE Hotel"
                description="Nhập thông tin tài khoản để tiếp tục trải nghiệm cùng SE Hotel."
              />

              <div className="mt-6 flex gap-2 rounded-[22px] bg-stone-100 p-1.5">
                <button type="button" onClick={() => setTab("login")} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${tab === "login" ? "bg-stone-950 text-white shadow-sm" : "text-stone-600"}`}>
                  Đăng nhập
                </button>
                <button type="button" onClick={() => setTab("register")} className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold transition ${tab === "register" ? "bg-stone-950 text-white shadow-sm" : "text-stone-600"}`}>
                  Đăng ký
                </button>
              </div>

              {tab === "login" ? (
                <form onSubmit={handleLogin} className="mt-7 grid gap-4">
                  <Field label="Email" icon={Mail}>
                    <input type="email" value={credentials.email} onChange={(e) => setCredentials((prev) => ({ ...prev, email: e.target.value }))} placeholder="ban@email.com" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                  </Field>
                  <Field label="Mật khẩu" icon={KeyRound}>
                    <input type="password" value={credentials.password} onChange={(e) => setCredentials((prev) => ({ ...prev, password: e.target.value }))} placeholder="Nhập mật khẩu" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                  </Field>
                  <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600">
                    <label className="inline-flex items-center gap-2">
                      <input type="checkbox" className="h-4 w-4 rounded border-stone-300 text-stone-950 focus:ring-amber-300" />
                      <span>Ghi nhớ đăng nhập</span>
                    </label>
                    <span className="font-medium text-stone-800">Quên mật khẩu</span>
                  </div>
                  <button type="submit" disabled={loginLoading} className="mt-2 inline-flex items-center justify-center rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">
                    {loginLoading ? "Đang xử lý..." : "Đăng nhập"}
                  </button>

                  {/* Google login */}
                  <div className="relative flex items-center">
                    <div className="flex-grow border-t border-stone-200" />
                    <span className="mx-4 flex-shrink text-xs text-stone-400">hoặc tiếp tục với</span>
                    <div className="flex-grow border-t border-stone-200" />
                  </div>

                  <div className={`flex justify-center transition ${googleLoading ? "pointer-events-none opacity-60" : ""}`}>
                    <GoogleLogin
                      onSuccess={(res) => handleGoogleLogin(res.credential)}
                      onError={() => setMessage("Đăng nhập với Google thất bại. Vui lòng thử lại.")}
                      text="signin_with"
                      shape="rectangular"
                      theme="outline"
                      size="large"
                      width="400"
                      locale="vi"
                    />
                  </div>

                  <p className="text-center text-sm text-stone-600">
                    Chưa có tài khoản?{" "}
                    <button type="button" onClick={() => setTab("register")} className="font-semibold text-stone-950">
                      Tạo tài khoản
                    </button>
                  </p>
                </form>
              ) : (
                <form onSubmit={handleRegister} className="mt-7 grid gap-4 md:grid-cols-2">
                  <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 md:col-span-2">
                    Các trường có dấu <span className="font-semibold text-red-600">*</span> là bắt buộc.
                  </p>
                  <Field label="Họ và tên" icon={UserRound} required error={registerErrors.full_name}>
                    <input value={registerForm.full_name} onChange={(e) => {
                      setRegisterForm((prev) => ({ ...prev, full_name: e.target.value }));
                      setRegisterErrors((prev) => ({ ...prev, full_name: "" }));
                    }} placeholder="Ví dụ: Nguyễn Văn A" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                  </Field>
                  <Field label="Email" icon={Mail} required error={registerErrors.email}>
                    <input type="email" value={registerForm.email} onChange={(e) => {
                      setRegisterForm((prev) => ({ ...prev, email: e.target.value }));
                      setRegisterErrors((prev) => ({ ...prev, email: "" }));
                    }} placeholder="Ví dụ: ban@email.com" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                  </Field>
                  <Field label="Mật khẩu" icon={KeyRound} required hint={PASSWORD_RULE_TEXT} error={registerErrors.password}>
                    <input type="password" value={registerForm.password} onChange={(e) => {
                      setRegisterForm((prev) => ({ ...prev, password: e.target.value }));
                      setRegisterErrors((prev) => ({ ...prev, password: "" }));
                    }} placeholder="Nhập mật khẩu mạnh" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                  </Field>
                  <Field label="Số điện thoại" icon={Phone} required hint="Ví dụ: 09xxxxxxxx hoặc +84xxxxxxxxx" error={registerErrors.phone_number}>
                    <input value={registerForm.phone_number} onChange={(e) => {
                      setRegisterForm((prev) => ({ ...prev, phone_number: e.target.value }));
                      setRegisterErrors((prev) => ({ ...prev, phone_number: "" }));
                    }} placeholder="Ví dụ: 0912345678" className="w-full rounded-2xl border border-stone-200 px-11 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                  </Field>
                  <Field label="CCCD" required hint="CCCD gồm 12 chữ số." error={registerErrors.CCCD}>
                    <input value={registerForm.CCCD} onChange={(e) => {
                      setRegisterForm((prev) => ({ ...prev, CCCD: e.target.value }));
                      setRegisterErrors((prev) => ({ ...prev, CCCD: "" }));
                    }} placeholder="Ví dụ: 012345678901" className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                  </Field>
                  <Field label="Ngày sinh" required hint="Bạn phải từ 18 tuổi trở lên." error={registerErrors.date_birth}>
                    <input type="date" value={registerForm.date_birth} onChange={(e) => {
                      setRegisterForm((prev) => ({ ...prev, date_birth: e.target.value }));
                      setRegisterErrors((prev) => ({ ...prev, date_birth: "" }));
                    }} className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" required />
                  </Field>
                  <Field label="Quốc tịch" optional>
                    <input value={registerForm.nationality} onChange={(e) => setRegisterForm((prev) => ({ ...prev, nationality: e.target.value }))} placeholder="Ví dụ: Vietnam" className="w-full rounded-2xl border border-stone-200 px-4 py-3 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100" />
                  </Field>
                  <div className="md:col-span-2">
                    <button type="submit" disabled={registerLoading} className="inline-flex w-full items-center justify-center rounded-2xl bg-stone-950 px-5 py-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">
                      {registerLoading ? "Đang xử lý..." : "Tạo tài khoản khách hàng"}
                    </button>
                  </div>
                  {registerError ? (
                    <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2">
                      {registerError}
                    </p>
                  ) : null}
                </form>
              )}

              {message ? (
                <p className={`mt-5 rounded-2xl px-4 py-3 text-sm ${message.toLowerCase().includes("thành công") ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-red-200 bg-red-50 text-red-700"}`}>
                  {message}
                </p>
              ) : null}

              {tab === "login" && verificationHelp ? (
                <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
                  <p className="font-semibold">Tài khoản này cần xác thực email trước khi đăng nhập.</p>
                  <p className="mt-1 text-amber-800">
                    {verificationHelp.email
                      ? `Mở trang xác thực cho ${verificationHelp.email} để nhập mã OTP.`
                      : "Mở trang xác thực để nhập mã OTP đã gửi trong email."}
                  </p>
                  <button
                    type="button"
                    onClick={openVerificationPage}
                    className="mt-4 inline-flex items-center justify-center rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Đi tới xác thực email
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
