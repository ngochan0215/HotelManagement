import NotificationDropdown from "./notificationDropdown.jsx";

export default function Topbar() {
  return (
    <div className="topbar h-16 bg-white border-b border-gray-200 flex items-center px-6 justify-between">

      {/* Search */}
      <div className="flex-1 flex justify-center">
        <input
          type="text"
          placeholder="Tìm kiếm"
          className="w-[520px] px-4 py-2 bg-gray-100 rounded-xl text-sm placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
      </div>

      {/* Avatar + Bell */}
      <div className="flex items-center gap-6">
        <NotificationDropdown />

        <div className="flex items-center gap-3">
          <span className="font-medium text-gray-800">Anh Thư</span>

          <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center
          font-bold text-gray-900">
            A
          </div>
        </div>
      </div>
    </div>
  );
}
