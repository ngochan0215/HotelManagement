export default function ConfirmModal({
  open = false,
  title = "Xác nhận",
  message = "",
  onConfirm = () => {},
  onCancel = () => {}
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[400px]">
        <h3 className="text-lg font-bold mb-3">{title}</h3>
        <p className="text-gray-600 mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 text-white"
          >
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}
