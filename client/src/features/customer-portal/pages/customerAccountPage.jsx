import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Edit3, Lock, MessageCircle, Star } from "lucide-react";
import CustomerShell from "../components/customerShell.jsx";
import { customerPortalApi } from "../api/customerPortalApi.js";
import SharedAuthForm from "../components/sharedAuthForm.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { sendVerificationEmail } from "../../auth/api/authApi.js";
import { userApi } from "../../api/userApi.js";

function formatDate(value) {
  if (!value) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "--";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const LOYALTY_TIERS = {
  platinum: { label: "Bạch kim", bg: "bg-slate-900", border: "border-slate-300" },
  gold: { label: "Vàng", bg: "bg-amber-500", border: "border-amber-200" },
  silver: { label: "Bạc", bg: "bg-slate-300", border: "border-slate-200" },
  bronze: { label: "Đồng", bg: "bg-orange-500", border: "border-orange-200" },
};

function InfoRow({ label, value }) {
  return (
    <div className="rounded-3xl bg-stone-50 px-5 py-4">
      <p className="text-xs uppercase tracking-[0.24em] text-stone-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-stone-950">{value}</p>
    </div>
  );
}

function SupportCard() {
  return (
    <div className="rounded-[28px] border border-stone-200 bg-white px-5 py-6 shadow-sm">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-stone-950 text-amber-300">
          <MessageCircle size={18} />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-stone-950">Cần hỗ trợ?</h3>
          <p className="mt-2 text-sm leading-6 text-stone-600">Nếu bạn cần trợ giúp với tài khoản, xác thực email hoặc đặt phòng, đội hỗ trợ luôn sẵn sàng.</p>
        </div>
      </div>
      <div className="mt-5">
        <Link
          to="/chat"
          className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
        >
          Mở chat
        </Link>
      </div>
    </div>
  );
}

export default function CustomerAccountPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendVerificationLoading, setSendVerificationLoading] = useState(false);
  const [sendVerificationError, setSendVerificationError] = useState("");
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileForm, setEditProfileForm] = useState({ full_name: "", phone_number: "", CCCD: "", bank_shortName: "", account_number: "" });
  const [updateProfileLoading, setUpdateProfileLoading] = useState(false);
  const [updateProfileError, setUpdateProfileError] = useState("");
  const [updateProfileSuccess, setUpdateProfileSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "", confirm: "" });
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailChangeForm, setEmailChangeForm] = useState({ newEmail: "", otp: "", step: "input" });
  const [emailChangeLoading, setEmailChangeLoading] = useState(false);
  const [emailChangeError, setEmailChangeError] = useState("");
  const [emailChangeSuccess, setEmailChangeSuccess] = useState("");

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const fetchProfile = async () => {
      setLoading(true);
      setError("");
      try {
        const account = await customerPortalApi.getMyProfile();
        if (!cancelled) setProfile(account);
      } catch (err) {
        if (!cancelled) setError(err?.message || "Không thể tải dữ liệu tài khoản.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const displayEmail = profile?.email || user?.email || "";
  const displayName = useMemo(() => {
    const rawName = profile?.full_name || profile?.name || user?.full_name || user?.name || (displayEmail ? displayEmail.split("@")[0] : "");
    return String(rawName || "").trim() || "Khách hàng";
  }, [displayEmail, profile?.full_name, profile?.name, user?.full_name, user?.name]);

  const displayUserId = user?._id || user?.userId || user?.id || "";
  const emailVerified = Boolean(profile?.email_verified ?? profile?.is_email_verified ?? profile?.verified ?? user?.email_verified ?? user?.is_email_verified ?? user?.verified);
  const loyaltyKey = String(profile?.loyalty || profile?.tier || "bronze").toLowerCase();
  const loyaltyTier = LOYALTY_TIERS[loyaltyKey] || LOYALTY_TIERS.bronze;
  const loyaltyPoints = Number(profile?.points ?? profile?.loyalty_points ?? profile?.reward_points ?? 0);

  const handleSendVerification = async () => {
    if (!displayEmail) {
      setSendVerificationError("Không có email để gửi xác thực.");
      return;
    }

    setSendVerificationError("");
    setSendVerificationLoading(true);
    try {
      await sendVerificationEmail({ userId: displayUserId, email: displayEmail });
      window.location.href = `/verify-email?userId=${encodeURIComponent(displayUserId)}&email=${encodeURIComponent(displayEmail)}`;
    } catch (err) {
      setSendVerificationError(err?.message || "Không thể gửi email xác thực.");
    } finally {
      setSendVerificationLoading(false);
    }
  };

  const openEditProfile = () => {
    setEditProfileForm({
      full_name: profile?.full_name || profile?.name || "",
      phone_number: profile?.phone_number || "",
      CCCD: profile?.CCCD || "",
      bank_shortName: profile?.bank_shortName || "",
      account_number: profile?.account_number || "",
    });
    setUpdateProfileError("");
    setUpdateProfileSuccess("");
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setUpdateProfileError("");
    setUpdateProfileSuccess("");
    setUpdateProfileLoading(true);

    try {
      await customerPortalApi.updateMyProfile({
        full_name: editProfileForm.full_name,
        phone_number: editProfileForm.phone_number,
        CCCD: editProfileForm.CCCD,
        bank_shortName: editProfileForm.bank_shortName || null,
        account_number: editProfileForm.account_number || null,
      });
      setUpdateProfileSuccess("Cập nhật hồ sơ thành công.");
      setIsEditingProfile(false);
      setTimeout(() => setUpdateProfileSuccess(""), 3000);
      const refreshedProfile = await customerPortalApi.getMyProfile();
      setProfile(refreshedProfile);
    } catch (err) {
      setUpdateProfileError(err?.message || "Không thể cập nhật hồ sơ.");
    } finally {
      setUpdateProfileLoading(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingProfile(false);
    setUpdateProfileError("");
    setUpdateProfileSuccess("");
  };

  const handleChangePassword = async (event) => {
    event.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setPasswordError("Mật khẩu xác nhận không khớp.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    setPasswordError("");
    setPasswordSuccess("");
    setPasswordLoading(true);

    try {
      await userApi.changePassword({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword });
      setPasswordSuccess("Đổi mật khẩu thành công.");
      setPasswordForm({ oldPassword: "", newPassword: "", confirm: "" });
      setIsChangingPassword(false);
    } catch (err) {
      setPasswordError(err?.message || "Không thể đổi mật khẩu.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleStartChangeEmail = () => {
    setEmailChangeError("");
    setEmailChangeSuccess("");
    setEmailChangeForm({ newEmail: displayEmail, otp: "", step: "input" });
    setIsChangingEmail(true);
  };

  const handleSendChangeEmailOtp = async (event) => {
    event.preventDefault();
    if (!emailChangeForm.newEmail?.trim()) {
      setEmailChangeError("Vui lòng nhập email mới.");
      return;
    }

    setEmailChangeError("");
    setEmailChangeSuccess("");
    setEmailChangeLoading(true);

    try {
      await userApi.sendChangeEmailOtp(emailChangeForm.newEmail.trim());
      setEmailChangeForm((prev) => ({ ...prev, step: "otp" }));
      setEmailChangeSuccess("Mã OTP đã được gửi đến email mới.");
    } catch (err) {
      setEmailChangeError(err?.message || "Không thể gửi mã xác thực email mới.");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  const handleVerifyChangeEmailOtp = async (event) => {
    event.preventDefault();
    if (!emailChangeForm.otp?.trim()) {
      setEmailChangeError("Vui lòng nhập mã OTP.");
      return;
    }

    setEmailChangeError("");
    setEmailChangeSuccess("");
    setEmailChangeLoading(true);

    try {
      await userApi.verifyChangeEmail(emailChangeForm.otp.trim());
      setEmailChangeSuccess("Đổi email thành công.");
      setIsChangingEmail(false);
      const refreshedProfile = await customerPortalApi.getMyProfile();
      setProfile(refreshedProfile);
    } catch (err) {
      setEmailChangeError(err?.message || "Không thể xác thực email mới.");
    } finally {
      setEmailChangeLoading(false);
    }
  };

  if (!user) {
    return (
      <CustomerShell>
        <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
          <SharedAuthForm embedded />
        </section>
      </CustomerShell>
    );
  }

  return (
    <CustomerShell>
      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        {error ? (
          <div className="mb-6 rounded-[28px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <p>Không thể tải dữ liệu tài khoản. Vui lòng thử lại sau.</p>
              <button onClick={() => window.location.reload()} className="font-semibold underline decoration-amber-300 underline-offset-4">
                Tải lại
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-[32px] border border-stone-200 bg-stone-950 p-8 text-white shadow-sm">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-amber-300">Tài khoản khách hàng</p>
              <h1 className="mt-4 text-3xl font-semibold tracking-tight">Xin chào, {displayName}</h1>
              <p className="mt-3 text-sm leading-6 text-stone-300">Quản lý thông tin cá nhân và bảo mật của bạn tại đây.</p>
            </div>
            <Link to="/hotel/book" className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-100">
              Đặt phòng mới
              <ArrowRight size={16} />
            </Link>
          </div>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="relative h-16 w-16 overflow-hidden rounded-full border border-white/20 bg-white/10">
                <img
                  src={profile?.avatar || user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=random`}
                  alt="Avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="grid gap-1">
                <p className="text-sm uppercase tracking-[0.22em] text-amber-300">Hạng khách hàng</p>
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${loyaltyTier.bg} ${loyaltyTier.border} text-white shadow-sm`}>
                    <Star size={16} />
                  </div>
                  <div>
                    <p className="text-xl font-semibold">{loyaltyTier.label}</p>
                    <p className="text-sm text-stone-200">{loyaltyPoints.toLocaleString()} điểm</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_0.85fr]">
          <div className="space-y-6">
            <div className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-400">Hồ sơ của bạn</p>
                  <h2 className="mt-3 text-2xl font-semibold text-stone-950">Thông tin cá nhân</h2>
                </div>
                <button onClick={openEditProfile} className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-stone-100 px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-50">
                  <Edit3 size={16} /> Chỉnh sửa
                </button>
              </div>

              {isEditingProfile ? (
                <form onSubmit={handleSaveProfile} className="mt-6 space-y-6">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Họ và tên
                      <input
                        value={editProfileForm.full_name}
                        onChange={(e) => setEditProfileForm((prev) => ({ ...prev, full_name: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                        required
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Email
                      <input
                        value={displayEmail}
                        disabled
                        className="h-12 w-full rounded-2xl border border-stone-200 bg-stone-100 px-4 text-stone-500 outline-none"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Điện thoại
                      <input
                        value={editProfileForm.phone_number}
                        onChange={(e) => setEditProfileForm((prev) => ({ ...prev, phone_number: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      CCCD
                      <input
                        value={editProfileForm.CCCD}
                        onChange={(e) => setEditProfileForm((prev) => ({ ...prev, CCCD: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Ngân hàng
                      <input
                        value={editProfileForm.bank_shortName}
                        onChange={(e) => setEditProfileForm((prev) => ({ ...prev, bank_shortName: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                    </label>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      Số tài khoản
                      <input
                        value={editProfileForm.account_number}
                        onChange={(e) => setEditProfileForm((prev) => ({ ...prev, account_number: e.target.value }))}
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      />
                    </label>
                  </div>

                  {updateProfileError ? <p className="text-sm text-red-700">{updateProfileError}</p> : null}
                  {updateProfileSuccess ? <p className="text-sm text-emerald-700">{updateProfileSuccess}</p> : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <button type="submit" disabled={updateProfileLoading} className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">
                      Lưu thay đổi
                      <ArrowRight size={16} />
                    </button>
                    <button type="button" onClick={handleCancelEdit} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-50">
                      Hủy
                    </button>
                  </div>
                </form>
              ) : (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <InfoRow label="Họ và tên" value={profile?.full_name || "Chưa cập nhật"} />
                  <InfoRow label="Email" value={displayEmail || "Chưa cập nhật"} />
                  <InfoRow label="Điện thoại" value={profile?.phone_number || "Chưa cập nhật"} />
                  <InfoRow label="CCCD" value={profile?.CCCD || "Chưa cập nhật"} />
                  <InfoRow label="Ngày sinh" value={formatDate(profile?.date_birth)} />
                  <InfoRow label="Tài khoản ngân hàng" value={profile?.bank_shortName && profile?.account_number ? `${profile.bank_shortName} - ${profile.account_number}` : "Chưa cập nhật"} />
                </div>
              )}
            </div>

            < SupportCard />
          </div>

          <aside className="space-y-6">
            <div className="rounded-[32px] border border-stone-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3 text-stone-950">
                <Lock size={20} />
                <div>
                  <p className="text-sm font-semibold">Bảo mật tài khoản</p>
                  <p className="mt-1 text-sm text-stone-600">Đặt mật khẩu và email mới ngay trong khu vực bên phải.</p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-3xl bg-stone-50 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">Đổi mật khẩu</p>
                      <p className="mt-1 text-sm text-stone-600">Bảo vệ tài khoản của bạn bằng mật khẩu mới.</p>
                    </div>
                    <button onClick={() => setIsChangingPassword(true)} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-100">
                      Đổi mật khẩu
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl bg-stone-50 px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-stone-950">Đổi email</p>
                      <p className="mt-1 text-sm text-stone-600">Cập nhật email và nhận mã xác nhận.</p>
                    </div>
                    <button onClick={handleStartChangeEmail} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-950 transition hover:bg-stone-100">
                      Đổi email
                    </button>
                  </div>
                </div>

                {!emailVerified ? (
                  <div className="rounded-3xl bg-stone-50 px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-stone-950">Xác thực email</p>
                        <p className="mt-1 text-sm text-stone-600">Hoàn tất xác thực để bật toàn bộ trải nghiệm.</p>
                      </div>
                      <button onClick={handleSendVerification} disabled={sendVerificationLoading} className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-400 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60">
                        {sendVerificationLoading ? "Đang gửi..." : "Xác thực ngay"}
                      </button>
                    </div>
                    {sendVerificationError ? <p className="mt-3 text-sm text-red-700">{sendVerificationError}</p> : null}
                  </div>
                ) : null}

                {passwordError ? <p className="text-sm text-red-700">{passwordError}</p> : null}
                {passwordSuccess ? <p className="text-sm text-emerald-700">{passwordSuccess}</p> : null}
                {isChangingPassword ? (
                  <form onSubmit={handleChangePassword} className="space-y-4 rounded-3xl border border-stone-200 bg-white p-5">
                    <div className="grid gap-3">
                      <label className="grid gap-2 text-sm font-medium text-stone-700">
                        Mật khẩu cũ
                        <input
                          type="password"
                          value={passwordForm.oldPassword}
                          onChange={(e) => setPasswordForm((prev) => ({ ...prev, oldPassword: e.target.value }))}
                          className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                          required
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-stone-700">
                        Mật khẩu mới
                        <input
                          type="password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                          className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                          required
                        />
                      </label>
                      <label className="grid gap-2 text-sm font-medium text-stone-700">
                        Xác nhận mật khẩu
                        <input
                          type="password"
                          value={passwordForm.confirm}
                          onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))}
                          className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                          required
                        />
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" disabled={passwordLoading} className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">
                        Lưu mật khẩu
                      </button>
                      <button type="button" onClick={() => setIsChangingPassword(false)} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-50">
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : null}

                {emailChangeError ? <p className="text-sm text-red-700">{emailChangeError}</p> : null}
                {emailChangeSuccess ? <p className="text-sm text-emerald-700">{emailChangeSuccess}</p> : null}
                {isChangingEmail ? (
                  <form className="space-y-4 rounded-3xl border border-stone-200 bg-white p-5" onSubmit={emailChangeForm.step === "input" ? handleSendChangeEmailOtp : handleVerifyChangeEmailOtp}>
                    <label className="grid gap-2 text-sm font-medium text-stone-700">
                      {emailChangeForm.step === "input" ? "Email mới" : "Mã OTP"}
                      <input
                        type={emailChangeForm.step === "input" ? "email" : "text"}
                        value={emailChangeForm.step === "input" ? emailChangeForm.newEmail : emailChangeForm.otp}
                        onChange={(e) =>
                          setEmailChangeForm((prev) => ({
                            ...prev,
                            ...(emailChangeForm.step === "input"
                              ? { newEmail: e.target.value }
                              : { otp: e.target.value }),
                          }))
                        }
                        className="h-12 w-full rounded-2xl border border-stone-200 px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                        required
                      />
                    </label>

                    <div className="flex flex-wrap items-center gap-3">
                      <button type="submit" disabled={emailChangeLoading} className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60">
                        {emailChangeForm.step === "input" ? "Gửi mã OTP" : "Xác thực OTP"}
                      </button>
                      <button type="button" onClick={() => setIsChangingEmail(false)} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-950 transition hover:bg-stone-50">
                        Hủy
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </CustomerShell>
  );
}
