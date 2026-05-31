import React, { useEffect, useState, useCallback, useRef } from "react";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import { userApi } from "../../api/userApi.js";
import { useAuth } from "../hooks/authContext.jsx";
import { FiCamera, FiEdit3, FiUser, FiPhone, FiCreditCard, FiBriefcase, FiMail, FiCalendar, FiX, FiSave, FiShield, FiLock, FiKey, FiEye, FiEyeOff } from "react-icons/fi";
import Toast from "../../../components/toast.jsx";

export default function ProfilePage() {
  const { refreshUser, user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasFetched = useRef(false);

  const translateMap = {
    manager: "Quản lý",
    receptionist: "Lễ tân",
    technician: "Kỹ thuật",
    housekeeper: "Buồng phòng",
    accountant: "Kế toán",
    customer_service: "CSKH",
    it: "IT",
    working: "Đang làm việc",
    active: "Hoạt động",
    resign: "Đã nghỉ việc"
  };

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", cccd: "", dob: "", bank_shortName: "", account_number: "" });
  const [previewAvatar, setPreviewAvatar] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);

  // Password change
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ oldPassword: "", newPassword: "", confirm: "" });
  const [showPw, setShowPw] = useState({ old: false, new: false, confirm: false });
  const [pwLoading, setPwLoading] = useState(false);

  // Email change (OTP flow)
  const [emailModal, setEmailModal] = useState({ open: false, step: "input", newEmail: "", otp: "" });
  const [emailLoading, setEmailLoading] = useState(false);

  const fetchProfile = useCallback(async () => {
    if (hasFetched.current) return;

    try {
      setLoading(true);
      const profile = await userApi.getProfile();
      setProfile(profile);

      const isEmployee = !!profile.user_info;
      const newName = isEmployee ? profile.full_name : "Quản trị viên";
      const newAvatar = isEmployee ? profile.user_info.avatar : profile.avatar;

      if (user?.full_name !== newName || user?.avatar !== newAvatar) {
            refreshUser({ name: newName, avatar: newAvatar });
      }

      hasFetched.current = true;
    } catch (error) {
      console.error("Lỗi tải profile:", error);
    } finally {
      setLoading(false);
    }
  }, [refreshUser, user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setPreviewAvatar(URL.createObjectURL(file));
    const formData = new FormData();
    formData.append("avatar", file);
    setUploading(true);
    try {
      await userApi.updateAvatar(formData);
      setToast({ message: "Cập nhật ảnh thành công!", type: "success" });
      hasFetched.current = false;
      fetchProfile();
    } catch (error) {
      setToast({ message: "Lỗi upload ảnh", type: "error" });
    } finally { setUploading(false); }
  };

  const openEditModal = () => {
      const isEmployeeRecord = !!profile.user_info;
      setEditForm({
          name: isEmployeeRecord ? profile.full_name : "User System",
          phone: isEmployeeRecord ? profile.phone_number : "",
          cccd: isEmployeeRecord ? profile.CCCD : "",
          dob: isEmployeeRecord && profile.date_birth ? new Date(profile.date_birth).toISOString().split('T')[0] : "",
          bank_shortName: profile.bank_shortName || "",
          account_number: profile.account_number || "",
      });
      setIsEditing(true);
  };

  const handleSaveProfile = async (e) => {
      e.preventDefault();
      try {
          const updateData = {
              phone: editForm.phone,
              dob: editForm.dob,
              bank_shortName: editForm.bank_shortName || null,
              account_number: editForm.account_number || null,
          };
          await userApi.updateProfile(updateData);
          setToast({ message: "Cập nhật thông tin thành công!", type: "success" });
          setIsEditing(false);
          hasFetched.current = false;
          fetchProfile();
      } catch (error) {
          setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
      }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirm) {
      setToast({ message: "Mật khẩu xác nhận không khớp.", type: "error" });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setToast({ message: "Mật khẩu mới phải có ít nhất 6 ký tự.", type: "error" });
      return;
    }
    setPwLoading(true);
    try {
      await userApi.changePassword({ oldPassword: passwordForm.oldPassword, newPassword: passwordForm.newPassword });
      setToast({ message: "Đổi mật khẩu thành công!", type: "success" });
      setIsChangingPassword(false);
      setPasswordForm({ oldPassword: "", newPassword: "", confirm: "" });
    } catch (error) {
      setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSendEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailModal.newEmail) {
      setToast({ message: "Vui lòng nhập địa chỉ email mới.", type: "error" });
      return;
    }
    setEmailLoading(true);
    try {
      await userApi.sendChangeEmailOtp(emailModal.newEmail);
      setToast({ message: "Mã OTP đã được gửi đến email mới của bạn.", type: "success" });
      setEmailModal(prev => ({ ...prev, step: "otp" }));
    } catch (error) {
      setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleVerifyEmailOtp = async (e) => {
    e.preventDefault();
    if (!emailModal.otp) {
      setToast({ message: "Vui lòng nhập mã OTP.", type: "error" });
      return;
    }
    setEmailLoading(true);
    try {
      await userApi.verifyChangeEmail(emailModal.otp);
      setToast({ message: "Đổi email thành công!", type: "success" });
      setEmailModal({ open: false, step: "input", newEmail: "", otp: "" });
      hasFetched.current = false;
      fetchProfile();
    } catch (error) {
      setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
    } finally {
      setEmailLoading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50">Đang tải hồ sơ...</div>;
  if (!profile) return <div className="flex h-screen items-center justify-center bg-gray-50">Không tìm thấy thông tin.</div>;

  const isEmployeeRecord = !!profile.user_info;
  const displayData = {
    avatar: isEmployeeRecord ? profile.user_info.avatar : profile.avatar,
    email: isEmployeeRecord ? profile.user_info.email : profile.email,
    role: isEmployeeRecord ? profile.user_info.system_role : profile.system_role,
    fullName: isEmployeeRecord ? profile.full_name : "User System",
    position: translateMap[profile.position] || profile.position || "Admin",
    phone: isEmployeeRecord ? profile.phone_number : "---",
    cccd: isEmployeeRecord ? profile.CCCD : "---",
    dob: isEmployeeRecord && profile.date_birth ? new Date(profile.date_birth).toLocaleDateString('vi-VN') : "---",
    statusText: translateMap[profile.status] || "Đang hoạt động",
    salary: isEmployeeRecord ? profile.fixed_salary : 0,
    working_year: isEmployeeRecord ? profile.working_year : 0,
    start_date: profile.created_at || profile.createdAt || (isEmployeeRecord && profile.user_id.created_at) || null,
    bankAccount: (profile.bank_shortName && profile.account_number) ? `${profile.bank_shortName} - ${profile.account_number}` : "Chưa cập nhật"
  };

  return (
    <div className="flex bg-[#F3F4F6] min-h-screen font-sans text-gray-800">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      <Sidebar />
      <div className="flex-1 ml-[270px]">
        <Topbar />
        <div className="p-8 max-w-7xl mx-auto">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="flex items-center gap-6">
                    <div className="relative">
                        <img src={previewAvatar || displayData.avatar || "https://via.placeholder.com/150"} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-gray-50 shadow-sm" />
                        <label className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow border border-gray-200 cursor-pointer hover:bg-gray-100 transition">
                            <FiCamera className="text-gray-600" size={14} />
                            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarChange} />
                        </label>
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">{displayData.fullName}</h1>
                        <div className="flex items-center gap-3 mt-1">
                            <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-bold uppercase border border-indigo-100">{displayData.position}</span>
                            <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-0.5 rounded border ${(profile.status === 'active' || profile.status === 'working') ? 'bg-green-50 text-green-700 border-green-100' : 'bg-red-50 text-red-700 border-red-100'}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${(profile.status === 'active' || profile.status === 'working') ? 'bg-green-600' : 'bg-red-600'}`}></span>
                                {displayData.statusText}
                            </span>
                        </div>
                    </div>
                </div>
                <button onClick={openEditModal} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition flex items-center gap-2">
                    <FiEdit3 size={16} /> Chỉnh sửa
                </button>
            </div>

             <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 text-base mb-5 flex items-center gap-2 pb-3 border-b border-gray-50"><FiUser className="text-indigo-500"/> Thông tin cá nhân</h3>
                        <div className="space-y-5 text-sm">
                            <div className="flex justify-between items-start gap-4"><div className="flex items-center gap-3 text-gray-500 shrink-0"><FiMail/> <span>Email</span></div><span className="font-medium text-gray-900 break-all text-right">{displayData.email}</span></div>
                            <div className="flex justify-between items-center"><div className="flex items-center gap-3 text-gray-500"><FiPhone/> <span>Điện thoại</span></div><span className="font-medium text-gray-900">{displayData.phone}</span></div>
                            <div className="flex justify-between items-center"><div className="flex items-center gap-3 text-gray-500"><FiCalendar/> <span>Ngày sinh</span></div><span className="font-medium text-gray-900">{displayData.dob}</span></div>
                            <div className="flex justify-between items-center"><div className="flex items-center gap-3 text-gray-500"><FiCreditCard/> <span>CCCD</span></div><span className="font-medium text-gray-900">{displayData.cccd}</span></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="font-bold text-gray-800 text-base mb-5 flex items-center gap-2 pb-3 border-b border-gray-50"><FiShield className="text-indigo-500"/> Bảo mật tài khoản</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3 text-sm">
                                    <FiLock className="text-gray-400"/>
                                    <div>
                                        <p className="font-medium text-gray-800">Mật khẩu</p>
                                        <p className="text-xs text-gray-400">Đổi mật khẩu đăng nhập</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsChangingPassword(true)} className="px-3 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition">
                                    Đổi mật khẩu
                                </button>
                            </div>
                            <div className="border-t border-gray-50"/>
                            <div className="flex items-center justify-between py-2">
                                <div className="flex items-center gap-3 text-sm">
                                    <FiMail className="text-gray-400"/>
                                    <div>
                                        <p className="font-medium text-gray-800">Email đăng nhập</p>
                                        <p className="text-xs text-gray-400 break-all">{displayData.email}</p>
                                    </div>
                                </div>
                                <button onClick={() => setEmailModal({ open: true, step: "input", newEmail: "", otp: "" })} className="px-3 py-1.5 text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition">
                                    Đổi email
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 h-full">
                        <h3 className="font-bold text-gray-800 text-base mb-5 flex items-center gap-2 pb-3 border-b border-gray-50"><FiBriefcase className="text-indigo-500"/> Thông tin công việc</h3>
                        <div className="grid grid-cols-2 gap-4">
                             <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><p className="text-xs text-gray-400 uppercase font-bold mb-1">Lương cơ bản</p><p className="text-lg font-bold text-green-600">{displayData.salary?.toLocaleString()} ₫</p></div>
                             <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><p className="text-xs text-gray-400 uppercase font-bold mb-1">Thâm niên</p><p className="text-lg font-bold text-gray-800">{displayData.working_year} năm</p></div>
                             <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><p className="text-xs text-gray-400 uppercase font-bold mb-1">Ngày vào làm</p><p className="text-base font-semibold text-gray-800">{displayData.start_date ? new Date(displayData.start_date).toLocaleDateString('vi-VN') : "---"}</p></div>
                             <div className="p-4 bg-gray-50 rounded-xl border border-gray-100"><p className="text-xs text-gray-400 uppercase font-bold mb-1">Tài khoản lương</p><p className="text-base font-semibold text-gray-800 break-words">{displayData.bankAccount}</p></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {isEditing && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4 relative">
                    <button onClick={() => setIsEditing(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><FiX size={20}/></button>
                    <h2 className="text-lg font-bold text-gray-900 mb-5 border-b pb-3 text-center">Cập nhật hồ sơ</h2>
                    <form onSubmit={handleSaveProfile} className="space-y-4">
                        <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">Họ và tên <FiShield size={10}/></label><input type="text" disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed italic" value={editForm.name} /></div>
                        <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1 flex items-center gap-1">Số CCCD <FiShield size={10}/></label><input type="text" disabled className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed italic" value={editForm.cccd} /></div>
                        <div><label className="block text-xs font-bold text-gray-400 uppercase mb-1">Số điện thoại</label><input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value})} /></div>
                        <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Ngày sinh</label><input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" value={editForm.dob} onChange={e => setEditForm({...editForm, dob: e.target.value})} /></div>
                        <div className="border-t border-gray-100 pt-3">
                            <p className="text-xs font-bold text-gray-400 uppercase mb-3">Tài khoản ngân hàng</p>
                            <div className="space-y-3">
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mã ngân hàng <span className="text-gray-400 font-normal normal-case">(vd: VCB, TCB, MB)</span></label><input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="VCB" value={editForm.bank_shortName} onChange={e => setEditForm({...editForm, bank_shortName: e.target.value})} /></div>
                                <div><label className="block text-xs font-bold text-gray-500 uppercase mb-1">Số tài khoản</label><input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="0123456789" value={editForm.account_number} onChange={e => setEditForm({...editForm, account_number: e.target.value})} /></div>
                            </div>
                        </div>
                        <div className="pt-4 flex justify-end gap-3"><button type="button" onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Hủy</button><button type="submit" className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md flex items-center gap-2"><FiSave /> Lưu</button></div>
                    </form>
                </div>
            </div>
        )}

        {isChangingPassword && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4 relative">
                    <button onClick={() => { setIsChangingPassword(false); setPasswordForm({ oldPassword: "", newPassword: "", confirm: "" }); }} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><FiX size={20}/></button>
                    <div className="flex items-center gap-3 mb-5 border-b pb-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center"><FiKey className="text-indigo-600" size={18}/></div>
                        <h2 className="text-lg font-bold text-gray-900">Đổi mật khẩu</h2>
                    </div>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu hiện tại</label>
                            <div className="relative">
                                <input type={showPw.old ? "text" : "password"} required className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" value={passwordForm.oldPassword} onChange={e => setPasswordForm({...passwordForm, oldPassword: e.target.value})} />
                                <button type="button" onClick={() => setShowPw(s => ({...s, old: !s.old}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPw.old ? <FiEyeOff size={15}/> : <FiEye size={15}/>}</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mật khẩu mới</label>
                            <div className="relative">
                                <input type={showPw.new ? "text" : "password"} required minLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" value={passwordForm.newPassword} onChange={e => setPasswordForm({...passwordForm, newPassword: e.target.value})} />
                                <button type="button" onClick={() => setShowPw(s => ({...s, new: !s.new}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPw.new ? <FiEyeOff size={15}/> : <FiEye size={15}/>}</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Xác nhận mật khẩu mới</label>
                            <div className="relative">
                                <input type={showPw.confirm ? "text" : "password"} required className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" value={passwordForm.confirm} onChange={e => setPasswordForm({...passwordForm, confirm: e.target.value})} />
                                <button type="button" onClick={() => setShowPw(s => ({...s, confirm: !s.confirm}))} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPw.confirm ? <FiEyeOff size={15}/> : <FiEye size={15}/>}</button>
                            </div>
                            {passwordForm.confirm && passwordForm.newPassword !== passwordForm.confirm && (
                                <p className="text-xs text-red-500 mt-1">Mật khẩu xác nhận không khớp.</p>
                            )}
                        </div>
                        <div className="pt-2 flex justify-end gap-3">
                            <button type="button" onClick={() => { setIsChangingPassword(false); setPasswordForm({ oldPassword: "", newPassword: "", confirm: "" }); }} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Hủy</button>
                            <button type="submit" disabled={pwLoading} className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md flex items-center gap-2 disabled:opacity-60">
                                <FiSave /> {pwLoading ? "Đang lưu..." : "Xác nhận"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        )}

        {emailModal.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 m-4 relative">
                    <button onClick={() => setEmailModal({ open: false, step: "input", newEmail: "", otp: "" })} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><FiX size={20}/></button>
                    <div className="flex items-center gap-3 mb-5 border-b pb-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center"><FiMail className="text-indigo-600" size={18}/></div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-900">Đổi email đăng nhập</h2>
                            <p className="text-xs text-gray-400">{emailModal.step === "input" ? "Bước 1: Nhập email mới" : "Bước 2: Xác minh OTP"}</p>
                        </div>
                    </div>

                    {emailModal.step === "input" ? (
                        <form onSubmit={handleSendEmailOtp} className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email mới</label>
                                <input type="email" required className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none" placeholder="email@example.com" value={emailModal.newEmail} onChange={e => setEmailModal(prev => ({...prev, newEmail: e.target.value}))} />
                                <p className="text-xs text-gray-400 mt-1">Mã OTP sẽ được gửi đến địa chỉ email mới này.</p>
                            </div>
                            <div className="pt-2 flex justify-end gap-3">
                                <button type="button" onClick={() => setEmailModal({ open: false, step: "input", newEmail: "", otp: "" })} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Hủy</button>
                                <button type="submit" disabled={emailLoading} className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md flex items-center gap-2 disabled:opacity-60">
                                    {emailLoading ? "Đang gửi..." : "Gửi mã OTP"}
                                </button>
                            </div>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyEmailOtp} className="space-y-4">
                            <div className="p-3 bg-indigo-50 rounded-lg border border-indigo-100 text-sm text-indigo-700">
                                Mã OTP đã được gửi đến <span className="font-bold">{emailModal.newEmail}</span>. Kiểm tra hộp thư của bạn.
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mã OTP</label>
                                <input type="text" required maxLength={6} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-100 outline-none tracking-widest text-center text-lg font-bold" placeholder="------" value={emailModal.otp} onChange={e => setEmailModal(prev => ({...prev, otp: e.target.value}))} />
                            </div>
                            <div className="pt-2 flex justify-between items-center">
                                <button type="button" onClick={() => setEmailModal(prev => ({...prev, step: "input", otp: ""}))} className="text-xs text-gray-400 hover:text-gray-600 underline">Gửi lại / Đổi email</button>
                                <div className="flex gap-3">
                                    <button type="button" onClick={() => setEmailModal({ open: false, step: "input", newEmail: "", otp: "" })} className="px-4 py-2 text-sm font-bold text-gray-500 hover:text-gray-700">Hủy</button>
                                    <button type="submit" disabled={emailLoading} className="px-5 py-2 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md flex items-center gap-2 disabled:opacity-60">
                                        <FiSave /> {emailLoading ? "Đang xác minh..." : "Xác nhận"}
                                    </button>
                                </div>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
}