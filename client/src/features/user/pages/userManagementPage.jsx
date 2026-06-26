import React, { useEffect, useMemo, useState } from "react";
import {
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiEye,
  FiEyeOff,
  FiFilter,
  FiList,
  FiKey,
  FiLoader,
  FiLock,
  FiMoreVertical,
  FiRefreshCw,
  FiSearch,
  FiUser,
  FiX,
} from "react-icons/fi";
import Sidebar from "../../../components/sidebar.jsx";
import Topbar from "../../../components/topbar.jsx";
import Toast from "../../../components/toast.jsx";
import ConfirmModal from "../../../components/confirmModal.jsx";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import { customerApi } from "../../api/customerApi.js";
import { employeeApi } from "../../api/employeeApi.js";
import { userApi } from "../../api/userApi.js";
import { StatusPill } from "../../../components/ui/label.jsx";

const ROLE_META = {
  customer: { label: "Khách hàng", color: "green" },
  employee: { label: "Nhân viên", color: "blue" },
  manager: { label: "Quản lý", color: "purple" },
  admin: { label: "Quản trị", color: "orange" },
};

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getUserLabel(user) {
  const role = normalizeRole(user?.system_role || user?.role);
  if (role === "admin") return { label: "Quản trị nội bộ", color: "orange" };
  return ROLE_META[role] || { label: role || "Không rõ", color: "gray" };
}

function getUserStatus(user) {
  return user?.isBanned
    ? { label: "Đã khóa", color: "red", iconType: "error" }
    : { label: "Đang hoạt động", color: "emerald", iconType: "success" };
}

function getInitial(email) {
  return String(email || "U").trim().charAt(0).toUpperCase() || "U";
}

export default function UserManagementPage() {
  const { user: currentUser } = useAuth();
  const currentUserId = currentUser?._id || currentUser?.userId || currentUser?.id || "";

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterBan, setFilterBan] = useState("all");
  const [sortOrder, setSortOrder] = useState("a-z");
  const [currentPage, setCurrentPage] = useState(1);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [profileCache, setProfileCache] = useState({});
  const [toast, setToast] = useState(null);
  const [confirmState, setConfirmState] = useState({
    open: false,
    title: "",
    message: "",
    type: "danger",
    confirmText: "Xác nhận",
    cancelText: "Hủy",
    onConfirm: null,
  });
  const [actionModal, setActionModal] = useState({ open: false, type: null, user: null });
  const [actionForm, setActionForm] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  const itemsPerPage = 8;

  const showToast = (message, type = "success") => {
    setToast({ message, type });
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await userApi.getAllUsers();
      setUsers(res.users || []);
    } catch (error) {
      showToast(error.response?.data?.message || error.message || "Không thể tải danh sách tài khoản.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole, filterBan, sortOrder]);

  const isSelfUser = (user) => String(user?._id || "") === String(currentUserId || "");

  const openActionMenu = (userId) => {
    setMenuOpenId((prev) => (prev === userId ? null : userId));
  };

  const openPasswordModal = (user) => {
    setMenuOpenId(null);
    if (isSelfUser(user)) {
      showToast("Không thể đặt lại mật khẩu cho tài khoản hiện tại từ trang này.", "error");
      return;
    }

    setActionForm((prev) => ({
      ...prev,
      newPassword: "",
      confirmPassword: "",
    }));
    setShowPassword(false);
    setActionModal({ open: true, type: "password", user });
  };

  const closeActionModal = () => {
    if (submitting) return;
    setActionModal({ open: false, type: null, user: null });
    setActionForm({ newPassword: "", confirmPassword: "" });
    setShowPassword(false);
  };

  const resolveLinkedProfile = async (user) => {
    const cached = profileCache[user._id];
    if (cached) return cached;

    const res = await userApi.getUserProfile(user._id);
    const profile = res.userProfile || res.user || res.data?.userProfile || res.data?.user || res;
    if (!profile) {
      throw new Error("Không lấy được hồ sơ liên kết.");
    }

    setProfileCache((prev) => ({ ...prev, [user._id]: profile }));
    return profile;
  };

  const handleBanToggle = (user) => {
    setMenuOpenId(null);
    if (isSelfUser(user)) {
      showToast("Không thể khóa/mở khóa tài khoản hiện tại.", "error");
      return;
    }

    const actionLabel = user.isBanned ? "Mở khóa" : "Khóa";
    setConfirmState({
      open: true,
      title: `${actionLabel} tài khoản?`,
      message: `Bạn có chắc muốn ${actionLabel.toLowerCase()} tài khoản ${user.email || "này"} không?`,
      type: user.isBanned ? "success" : "warning",
      confirmText: actionLabel,
      cancelText: "Hủy",
      onConfirm: async () => {
        setConfirmState((prev) => ({ ...prev, open: false }));
        setSubmitting(true);
        try {
          const profile = await resolveLinkedProfile(user);

          if (normalizeRole(user.system_role) === "customer") {
            if (user.isBanned) {
              await customerApi.unbanCustomer(profile._id);
            } else {
              await customerApi.banCustomer(profile._id);
            }
          } else if (normalizeRole(user.system_role) === "employee" || normalizeRole(user.system_role) === "manager") {
            await employeeApi.toggleBanUser(profile._id, !user.isBanned);
          } else {
            throw new Error("Loại tài khoản này chưa hỗ trợ khóa/mở khóa từ giao diện.");
          }

          showToast(`${actionLabel} tài khoản thành công.`, "success");
          await fetchUsers();
        } catch (error) {
          showToast(error.response?.data?.message || error.message || "Không thể cập nhật trạng thái tài khoản.", "error");
        } finally {
          setSubmitting(false);
        }
      },
    });
  };

  const submitActionModal = async (e) => {
    e.preventDefault();
    if (submitting || !actionModal.user) return;

    if (actionModal.type === "password") {
      if (!actionForm.newPassword || !actionForm.confirmPassword) {
        showToast("Vui lòng nhập mật khẩu mới và xác nhận.", "error");
        return;
      }
      if (actionForm.newPassword !== actionForm.confirmPassword) {
        showToast("Mật khẩu xác nhận không khớp.", "error");
        return;
      }
      if (actionForm.newPassword.length < 8) {
        showToast("Mật khẩu mới phải có ít nhất 8 ký tự.", "error");
        return;
      }

      setSubmitting(true);
      try {
        await userApi.adminResetPassword({
          userId: actionModal.user._id,
          newPassword: actionForm.newPassword,
        });
        showToast("Đã đặt lại mật khẩu thành công.", "success");
        closeActionModal();
      } catch (error) {
        showToast(error.response?.data?.message || error.message || "Không thể đặt lại mật khẩu.", "error");
      } finally {
        setSubmitting(false);
      }
    }
  };

  const filteredUsers = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    let result = users.filter((user) => {
      const role = normalizeRole(user.system_role || user.role);
      const banned = user.isBanned ? "banned" : "active";

      const matchRole = filterRole === "all" || role === filterRole;
      const matchBan = filterBan === "all" || banned === filterBan;
      const matchSearch =
        !normalizedSearch ||
        user.email?.toLowerCase().includes(normalizedSearch) ||
        String(user._id || "").toLowerCase().includes(normalizedSearch) ||
        role.includes(normalizedSearch);

      return matchRole && matchBan && matchSearch;
    });

    result.sort((a, b) => {
      const valueA = (a.email || "").toLowerCase();
      const valueB = (b.email || "").toLowerCase();
      return sortOrder === "a-z" ? valueA.localeCompare(valueB, "vi") : valueB.localeCompare(valueA, "vi");
    });

    return result;
  }, [users, searchTerm, filterRole, filterBan, sortOrder]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);

  const renderPaginationButtons = () => {
    if (totalPages <= 1) return null;

    const delta = 2;
    const left = currentPage - delta;
    const right = currentPage + delta;
    const range = [];
    const rangeWithDots = [];

    for (let i = 1; i <= totalPages; i += 1) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        range.push(i);
      }
    }

    let previous;
    for (const page of range) {
      if (previous) {
        if (page - previous === 2) {
          rangeWithDots.push(previous + 1);
        } else if (page - previous !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(page);
      previous = page;
    }

    return (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
          disabled={currentPage === 1}
          className="rounded-lg border p-2 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiChevronLeft />
        </button>
        {rangeWithDots.map((page, index) =>
          page === "..." ? (
            <span key={`dots-${index}`} className="self-center px-2 py-1 text-gray-400">
              ...
            </span>
          ) : (
            <button
              type="button"
              key={page}
              onClick={() => setCurrentPage(page)}
              className={`h-8 w-8 rounded-lg text-sm font-bold transition ${
                currentPage === page
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-200"
                  : "border text-gray-600 hover:bg-gray-50"
              }`}
            >
              {page}
            </button>
          )
        )}
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage === totalPages}
          className="rounded-lg border p-2 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FiChevronRight />
        </button>
      </div>
    );
  };

  const totalCount = users.length;
  const lockedCount = users.filter((u) => u.isBanned).length;
  const employeeCount = users.filter((u) => normalizeRole(u.system_role) === "employee" || normalizeRole(u.system_role) === "manager").length;
  const customerCount = users.filter((u) => normalizeRole(u.system_role) === "customer").length;

  return (
    <div className="flex min-h-screen bg-[#F3F4F6] font-sans text-gray-800">
      <Sidebar />
      <div className="ml-[270px] flex-1">
        <Topbar />
        <div className="mx-auto max-w-7xl space-y-6 p-8">
          <div className="flex items-end justify-between border-b border-gray-200 pb-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
                <FiUser /> Tài khoản quản trị nội bộ
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Quản lý tài khoản nội bộ bằng các thao tác an toàn: đặt lại mật khẩu, khóa hoặc mở khóa.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchUsers}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 font-bold text-white shadow-sm transition hover:bg-indigo-700"
            >
              <FiRefreshCw size={18} />
              Tải lại
            </button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Tổng tài khoản</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{totalCount}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Khách hàng</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{customerCount}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Nhân viên</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{employeeCount}</p>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Tài khoản bị khóa</p>
              <p className="mt-2 text-2xl font-bold text-gray-900">{lockedCount}</p>
            </div>
          </div>

          <div className="flex min-h-[560px] flex-col rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-col gap-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-md">
                  <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tìm theo email, ID, vai trò..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-500"
                  />
                </div>

                <div className="flex gap-3 overflow-x-auto pb-1">
                  <div className="relative min-w-[180px]">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FiFilter className="text-gray-500" size={16} />
                    </div>
                    <select
                      value={filterRole}
                      onChange={(e) => setFilterRole(e.target.value)}
                      className="h-12 w-full appearance-none rounded-2xl border border-gray-200 bg-white pl-10 pr-10 text-sm font-medium text-gray-700 shadow-sm outline-none transition hover:border-indigo-300 focus:border-indigo-500"
                    >
                      <option value="all">Tất cả vai trò</option>
                      {Object.entries(ROLE_META).map(([value, meta]) => (
                        <option key={value} value={value}>
                          {meta.label}
                        </option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <FiChevronDown className="text-gray-400" size={16} />
                    </div>
                  </div>

                  <div className="relative min-w-[180px]">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <FiLock className="text-gray-500" size={16} />
                    </div>
                    <select
                      value={filterBan}
                      onChange={(e) => setFilterBan(e.target.value)}
                      className="h-12 w-full appearance-none rounded-2xl border border-gray-200 bg-white pl-10 pr-10 text-sm font-medium text-gray-700 shadow-sm outline-none transition hover:border-indigo-300 focus:border-indigo-500"
                    >
                      <option value="all">Tất cả trạng thái</option>
                      <option value="active">Hoạt động</option>
                      <option value="banned">Đã khóa</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <FiChevronDown className="text-gray-400" size={16} />
                    </div>
                  </div>

                <div className="relative min-w-[160px]">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <FiList className="text-gray-500" size={16} />
                  </div>
                  <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="h-12 w-full appearance-none rounded-2xl border border-gray-200 bg-white pl-10 pr-10 text-sm font-medium text-gray-700 shadow-sm outline-none transition hover:border-indigo-300 focus:border-indigo-500"
                  >
                      <option value="a-z">Email: A-Z</option>
                      <option value="z-a">Email: Z-A</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                    <FiChevronDown className="text-gray-400" size={16} />
                  </div>
                </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/70 text-xs font-semibold uppercase text-gray-500">
                    <th className="py-3 pl-4">Tài khoản</th>
                    <th className="py-3">Vai trò</th>
                    <th className="py-3">Khóa</th>
                    <th className="py-3 text-right pr-4">Hành động</th>
                  </tr>
                </thead>
                <tbody className="text-sm text-gray-700">
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="py-10 text-center text-gray-500">
                        Đang tải dữ liệu...
                      </td>
                    </tr>
                  ) : currentUsers.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-10 text-center italic text-gray-400">
                        Không tìm thấy tài khoản phù hợp.
                      </td>
                    </tr>
                  ) : (
                    currentUsers.map((user) => {
                      const roleMeta = getUserLabel(user);
                      const statusMeta = getUserStatus(user);
                      const isSelf = isSelfUser(user);
                      const roleName = normalizeRole(user.system_role || user.role);
                      const isCustomer = roleName === "customer";

                      return (
                        <tr key={user._id} className={`group border-b border-gray-50 align-top transition hover:bg-gray-50/70 ${isSelf ? "bg-indigo-50/40" : ""}`}>
                          <td className="py-4 pl-4">
                            <div className="flex items-center gap-3">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${user.isBanned ? "bg-gray-200 text-gray-500" : "bg-indigo-50 text-indigo-600"}`}>
                                {getInitial(user.email)}
                              </div>
                              <div>
                                <div className="font-bold text-gray-900">{user.email}</div>
                                <div className="text-xs text-gray-500">{user._id}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-4">
                            <StatusPill label={roleMeta.label} color={roleMeta.color} iconType="info" />
                          </td>

                          <td className="py-4">
                            <StatusPill {...statusMeta} />
                          </td>

                          <td className="py-4 pr-4 text-right">
                            <div className="relative inline-flex">
                              <button
                                type="button"
                                onClick={() => openActionMenu(user._id)}
                                className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-gray-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                              >
                                <FiMoreVertical size={18} />
                              </button>

                              {menuOpenId === user._id && (
                                <div className="absolute right-0 top-11 z-20 w-56 overflow-hidden rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                                  {!isCustomer && (
                                    <button
                                      type="button"
                                      onClick={() => openPasswordModal(user)}
                                      disabled={isSelf}
                                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      <FiKey size={15} />
                                      Đặt lại mật khẩu
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleBanToggle(user)}
                                    disabled={isSelf || !["customer", "employee", "manager"].includes(roleName)}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <FiLock size={15} />
                                    {user.isBanned ? "Mở khóa" : "Khóa"}
                                  </button>
                                </div>
                              )}
                            </div>

                            {isSelf ? (
                              <p className="mt-2 text-xs text-gray-400">Không thao tác trên tài khoản hiện tại.</p>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {filteredUsers.length > 0 && (
              <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
                <div className="text-sm text-gray-500">
                  Hiển thị <b>{indexOfFirstItem + 1}</b> - <b>{Math.min(indexOfLastItem, filteredUsers.length)}</b> trong tổng <b>{filteredUsers.length}</b>
                </div>
                {renderPaginationButtons()}
              </div>
            )}
          </div>
        </div>
      </div>

      {actionModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-2">
              <h3 className="text-lg font-bold text-gray-800">
                Đặt lại mật khẩu
              </h3>
              <button type="button" onClick={closeActionModal} className="rounded-full p-1 hover:bg-gray-100">
                <FiX size={24} />
              </button>
            </div>

            <form onSubmit={submitActionModal} className="space-y-4">
              <p className="text-sm text-gray-600">
                Tài khoản: <span className="font-semibold text-gray-900">{actionModal.user?.email}</span>
              </p>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Mật khẩu mới</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={actionForm.newPassword}
                    onChange={(e) => setActionForm((prev) => ({ ...prev, newPassword: e.target.value }))}
                    className="h-12 w-full rounded-xl border border-gray-300 px-3 pr-11 text-sm outline-none transition focus:border-indigo-500"
                    placeholder="Ít nhất 8 ký tự, có chữ hoa, thường, số và ký tự đặc biệt"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Xác nhận mật khẩu</label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={actionForm.confirmPassword}
                  onChange={(e) => setActionForm((prev) => ({ ...prev, confirmPassword: e.target.value }))}
                  className="h-12 w-full rounded-xl border border-gray-300 px-3 text-sm outline-none transition focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeActionModal}
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? (
                    <span className="inline-flex items-center gap-2">
                      <FiLoader className="animate-spin" />
                      Đang xử lý...
                    </span>
                  ) : (
                    "Xác nhận"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmState.open && (
        <ConfirmModal
          open={confirmState.open}
          title={confirmState.title}
          message={confirmState.message}
          type={confirmState.type}
          confirmText={confirmState.confirmText}
          cancelText={confirmState.cancelText}
          onConfirm={confirmState.onConfirm}
          onCancel={() => !submitting && setConfirmState((prev) => ({ ...prev, open: false }))}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
