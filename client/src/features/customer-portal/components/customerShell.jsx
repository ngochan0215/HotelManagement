import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { CalendarDays, ChevronDown, LogOut, Menu, Phone, UserRound, X } from "lucide-react";
import { useAuth } from "../../auth/hooks/authContext.jsx";
import Toast from "../../../components/toast.jsx";

const AUTH_FLASH_KEY = "auth_flash_message";

const navItems = [
  { label: "Trang chủ", to: "/hotel", type: "route" },
  { label: "Phòng", to: "/hotel/rooms", type: "route" },
  { label: "Tra cứu đặt phòng", to: "/hotel/bookings/lookup", type: "route" },
];

const navClass = ({ isActive }) =>
  `rounded-full px-4 py-2 text-sm font-medium transition ${
    isActive ? "bg-stone-950 text-white shadow-sm" : "text-stone-700 hover:bg-white hover:text-stone-950"
  }`;

function DesktopItem({ item }) {
  if (item.type === "anchor") {
    return (
      <a href={item.to} className="rounded-full px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-white hover:text-stone-950">
        {item.label}
      </a>
    );
  }

  return (
    <NavLink to={item.to} end={item.to === "/hotel"} className={navClass}>
      {item.label}
    </NavLink>
  );
}

export default function CustomerShell({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const accountMenuRef = useRef(null);
  const displayName = user?.full_name || user?.name || user?.email || "Khách hàng";
  const displayEmail = user?.email || "";
  const avatarLabel = displayName.trim().charAt(0).toUpperCase() || "K";

  useEffect(() => {
    const flash = sessionStorage.getItem(AUTH_FLASH_KEY);
    if (!flash) return;
    sessionStorage.removeItem(AUTH_FLASH_KEY);
    const timer = window.setTimeout(() => {
      setToast({ message: flash, type: "success" });
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleDocumentClick = (event) => {
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target)) {
        setAccountOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setAccountOpen(false);
    };

    if (accountOpen) {
      document.addEventListener("mousedown", handleDocumentClick);
      document.addEventListener("keydown", handleEscape);
    }

    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountOpen]);

  const handleLogout = () => {
    setAccountOpen(false);
    setMobileOpen(false);
    logout({ message: "Bạn đã đăng xuất." });
    navigate("/hotel", { replace: true });
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.12),transparent_28%),linear-gradient(180deg,#f8f5ef_0%,#f6f3ee_24%,#fcfbf9_100%)] text-stone-900">
      <header className="sticky top-0 z-30 border-b border-white/60 bg-[#f8f5ef]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <Link to="/hotel" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-stone-950 text-sm font-semibold tracking-[0.18em] text-amber-300 shadow-sm">
              SE
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold tracking-[0.08em] text-stone-950">SE Hotel</p>
              <p className="truncate text-xs uppercase tracking-[0.28em] text-stone-500">Trải nghiệm lưu trú cao cấp</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 rounded-full border border-white/80 bg-white/70 p-1.5 shadow-sm lg:flex">
            {navItems.map((item) => (
              <DesktopItem key={item.label} item={item} />
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-white/70 px-4 py-2 text-sm text-stone-700 shadow-sm">
              <Phone size={16} className="text-amber-700" />
              <span>1900 6868</span>
            </div>
            {user ? (
              <div ref={accountMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setAccountOpen((prev) => !prev)}
                  className="inline-flex items-center gap-3 rounded-full border border-stone-200 bg-white/90 px-3 py-2 text-left shadow-sm transition hover:border-amber-300 hover:bg-white"
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-stone-900">
                    {avatarLabel}
                  </div>
                  <div className="max-w-[190px]">
                    <p className="truncate text-sm font-semibold text-stone-950">{displayName}</p>
                    <p className="truncate text-xs text-stone-500">{displayEmail}</p>
                  </div>
                  <ChevronDown size={16} className={`text-stone-500 transition ${accountOpen ? "rotate-180" : ""}`} />
                </button>

                {accountOpen ? (
                  <div className="absolute right-0 top-full z-40 mt-3 w-80 overflow-hidden rounded-[28px] border border-stone-200 bg-white p-2 shadow-[0_24px_60px_rgba(28,25,23,0.16)]">
                    <div className="rounded-[22px] bg-stone-50 px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-stone-400">Tài khoản</p>
                      <p className="mt-2 break-words text-base font-semibold text-stone-950">{displayName}</p>
                      <p className="mt-1 break-words text-sm text-stone-500">{displayEmail}</p>
                    </div>

                    <div className="mt-2 grid gap-1">
                      <Link
                        to="/hotel/account"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-amber-50 hover:text-stone-950"
                      >
                        <UserRound size={16} />
                        Thông tin tài khoản
                      </Link>
                      <Link
                        to="/hotel/bookings"
                        onClick={() => setAccountOpen(false)}
                        className="flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-amber-50 hover:text-stone-950"
                      >
                        <CalendarDays size={16} />
                        Đơn đặt phòng của tôi
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="flex items-center gap-3 rounded-[18px] px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut size={16} />
                        Đăng xuất
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-white/80 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-white"
                >
                  Đăng nhập
                </Link>
                <Link
                  to="/login?tab=register"
                  className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
                >
                  Đăng ký
                </Link>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/80 text-stone-800 shadow-sm lg:hidden"
            aria-label="Mở menu"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {mobileOpen ? (
          <div className="border-t border-white/70 bg-white/90 px-4 py-4 shadow-sm lg:hidden">
            <div className="grid gap-2">
              {navItems.map((item) =>
                item.type === "anchor" ? (
                  <a
                    key={item.label}
                    href={item.to}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-amber-50"
                  >
                    {item.label}
                  </a>
                ) : (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    end={item.to === "/hotel"}
                    onClick={() => setMobileOpen(false)}
                    className={({ isActive }) =>
                      `rounded-2xl px-4 py-3 text-sm font-medium transition ${
                        isActive ? "bg-stone-950 text-white" : "text-stone-700 hover:bg-amber-50"
                      }`
                    }
                  >
                    {item.label}
                  </NavLink>
                ),
              )}
              {user ? (
                <div className="mt-2 rounded-[28px] border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-sm font-bold text-stone-900">
                      {avatarLabel}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-stone-950">{displayName}</p>
                      <p className="truncate text-xs text-stone-500">{displayEmail}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    <Link
                      to="/hotel/account"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-amber-50"
                    >
                      Thông tin tài khoản
                    </Link>
                    <Link
                      to="/hotel/bookings"
                      onClick={() => setMobileOpen(false)}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-medium text-stone-700 transition hover:bg-amber-50"
                    >
                      Đơn đặt phòng của tôi
                    </Link>
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800"
                    >
                      Đăng xuất
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <Link
                    to="/login"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-center text-sm font-semibold text-stone-800 transition hover:bg-amber-50"
                  >
                    Đăng nhập
                  </Link>
                  <Link
                    to="/login?tab=register"
                    onClick={() => setMobileOpen(false)}
                    className="rounded-2xl bg-stone-950 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-stone-800"
                  >
                    Đăng ký
                  </Link>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main className="min-w-0">{children}</main>

      {toast ? <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} /> : null}

      <footer className="mt-20 border-t border-stone-200 bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 md:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-lg font-semibold text-stone-950">SE Hotel</p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
              Không gian lưu trú hiện đại, dịch vụ tận tâm và trải nghiệm đặt phòng chỉn chu cho khách hàng.
            </p>
          </div>
          <div className="grid gap-2 text-sm text-stone-600">
            <p>Địa chỉ: 123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh</p>
            <p>Email: booking@sehotel.vn</p>
            <p>Hotline: 1900 6868</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
