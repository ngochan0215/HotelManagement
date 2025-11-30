export default function Topbar() {
  return (
    <div className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
      <input
        type="text"
        placeholder="Tìm kiếm..."
        className="px-3 py-2 border rounded-lg w-80"
      />

      <div className="flex items-center gap-3">
        <span className="font-medium">Anh Thư</span>
        <div className="w-10 h-10 bg-yellow-400 rounded-full flex items-center justify-center font-bold">
          A
        </div>
      </div>
    </div>
  );
}
