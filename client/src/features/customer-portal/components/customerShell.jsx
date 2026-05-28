import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Menu, Phone, UserRound, X } from "lucide-react";
import { useAuth } from "../../auth/hooks/authContext.jsx";

const navItems = [
  { label: "Trang chủ", to: "/hotel", type: "route" },
  { label: "Phòng", to: "/hotel/rooms", type: "route" },
  { label: "Tra cứu đặt phòng", to: "/hotel/bookings", type: "route" },
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
  const { user } = useAuth();
  const role = (user?.role || user?.system_role || localStorage.getItem("role") || "").toLowerCase();
  const isCustomer = role === "customer" || role === "guest";

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
            <Link
              to={isCustomer ? "/hotel/account" : "/login"}
              className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              <UserRound size={16} />
              {user ? "Tài khoản" : "Đăng nhập"}
            </Link>
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
              <Link
                to={isCustomer ? "/hotel/account" : "/login"}
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white"
              >
                {user ? "Tài khoản" : "Đăng nhập"}
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main className="min-w-0">{children}</main>

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
