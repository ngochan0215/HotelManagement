import { X } from "lucide-react";
import { HotelImage, StatusBadge } from "./sitePrimitives.jsx";

const SERVICE_TYPE_LABELS = {
  product: "Sản phẩm",
  rental: "Cho thuê",
  experience: "Trải nghiệm",
};

function formatServiceUnit(unit, unitLabels) {
  return unitLabels[unit] || unit || "lần";
}

function formatSlotOption(slot) {
  const date = slot.date ? new Date(slot.date).toLocaleDateString("vi-VN") : "";
  const start = slot.start_time
    ? new Date(slot.start_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "";
  const end = slot.end_time
    ? new Date(slot.end_time).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
    : "";
  const remaining = Number(slot.max_capacity || 0) - Number(slot.booked_count || 0);
  return `${slot.label} | ${date} ${start}${end ? ` - ${end}` : ""} | Còn ${remaining} chỗ`;
}

export default function ServiceAddOnModal({
  open,
  service,
  draft,
  error,
  isEditing,
  serviceImage,
  unitLabels,
  onClose,
  onConfirm,
  onRemove,
  onDraftChange,
}) {
  if (!open || !service || !draft) return null;

  const lineTotal = Number(service.price || 0) * (Number(draft.quantity) || 0);
  const unitLabel = formatServiceUnit(service.unit, unitLabels);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-stone-950/45 px-4 py-6 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="service-addon-modal-title"
        className="flex max-h-[min(90vh,760px)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_28px_80px_rgba(28,25,23,0.22)]"
      >
        <div className="relative shrink-0">
          <HotelImage
            src={serviceImage}
            alt={service.name}
            ratio="wide"
            fallbackLabel={service.name}
            className="rounded-none"
            overlay={false}
          />
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-stone-700 shadow-sm transition hover:bg-white"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">Đặt dịch vụ thêm</p>
          <h3 id="service-addon-modal-title" className="mt-2 text-2xl font-semibold tracking-tight text-stone-950">
            {service.name}
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge tone="info">{SERVICE_TYPE_LABELS[service.service_type] || service.service_type}</StatusBadge>
            <StatusBadge tone="warning">{Number(service.price || 0).toLocaleString()} VNĐ / {unitLabel}</StatusBadge>
          </div>
          {service.description ? (
            <p className="mt-4 text-sm leading-6 text-stone-600">{service.description}</p>
          ) : null}

          <div className="mt-6 space-y-4">
            {draft.loadingExtra ? (
              <p className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                Đang tải thông tin dịch vụ...
              </p>
            ) : null}

            {service.service_type === "product" && !draft.loadingExtra ? (
              <label className="grid gap-2 text-sm font-medium text-stone-700">
                Số lượng ({unitLabel})
                <input
                  type="number"
                  min="1"
                  value={draft.quantity ?? 1}
                  onChange={(e) => onDraftChange({ quantity: e.target.value })}
                  className="h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                />
              </label>
            ) : null}

            {service.service_type === "rental" && !draft.loadingExtra ? (
              <div className="space-y-4">
                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  Tài sản ({unitLabel})
                  {draft.availableAssets?.length ? (
                    <select
                      value={draft.asset_id || ""}
                      onChange={(e) => onDraftChange({ asset_id: e.target.value })}
                      className="h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    >
                      <option value="">-- Chọn tài sản --</option>
                      {draft.availableAssets.map((asset) => (
                        <option key={asset._id} value={asset._id}>
                          {asset.identifier} ({asset.condition})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-normal text-red-600">Hiện chưa có tài sản khả dụng.</p>
                  )}
                </label>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    Bắt đầu thuê
                    <input
                      type="datetime-local"
                      value={draft.use_from || ""}
                      onChange={(e) => onDraftChange({ use_from: e.target.value })}
                      className="h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-medium text-stone-700">
                    Kết thúc thuê
                    <input
                      type="datetime-local"
                      value={draft.finish_at || ""}
                      min={draft.use_from || ""}
                      onChange={(e) => onDraftChange({ finish_at: e.target.value })}
                      className="h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    />
                  </label>
                </div>

                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  Số lượng
                  <input
                    type="number"
                    min="1"
                    value={draft.quantity ?? 1}
                    onChange={(e) => onDraftChange({ quantity: e.target.value })}
                    className="h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </label>
              </div>
            ) : null}

            {service.service_type === "experience" && !draft.loadingExtra ? (
              <div className="space-y-4">
                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  Khung giờ / slot
                  {draft.availableSlots?.length ? (
                    <select
                      value={draft.slot_id || ""}
                      onChange={(e) => onDraftChange({ slot_id: e.target.value })}
                      className="h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                    >
                      <option value="">-- Chọn slot --</option>
                      {draft.availableSlots.map((slot) => (
                        <option key={slot._id} value={slot._id}>
                          {formatSlotOption(slot)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-sm font-normal text-red-600">
                      Chưa có slot phù hợp trong thời gian lưu trú đã chọn.
                    </p>
                  )}
                </label>

                <label className="grid gap-2 text-sm font-medium text-stone-700">
                  Số {unitLabel}
                  <input
                    type="number"
                    min="1"
                    value={draft.quantity ?? 1}
                    onChange={(e) => onDraftChange({ quantity: e.target.value })}
                    className="h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 outline-none transition focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  />
                </label>
              </div>
            ) : null}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
              Tạm tính: {lineTotal.toLocaleString()} VNĐ
            </div>

            {error ? (
              <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            ) : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-stone-100 bg-stone-50 px-5 py-4 md:px-6">
          <div className="flex flex-wrap gap-3">
            {isEditing ? (
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
              >
                Bỏ chọn
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-stone-200 bg-white px-5 py-3 text-sm font-semibold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={draft.loadingExtra}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isEditing ? "Cập nhật" : "Thêm dịch vụ"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
