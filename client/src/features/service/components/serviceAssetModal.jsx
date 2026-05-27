import React, { useState, useEffect } from "react";
import { FiX, FiPlus, FiTrash2, FiSave, FiChevronDown } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import Toast from "../../../components/toast.jsx";

const CONDITION_LABEL = { new: "Mới", good: "Tốt", maintenance: "Bảo trì", broken: "Hỏng" };
const STATUS_LABEL = { "in-stock": "Sẵn sàng", "in-use": "Đang thuê", maintenance: "Bảo trì", disposed: "Đã loại" };
const STATUS_COLOR = {
  "in-stock": "bg-green-100 text-green-700",
  "in-use": "bg-blue-100 text-blue-700",
  maintenance: "bg-yellow-100 text-yellow-700",
  disposed: "bg-red-100 text-red-700",
};

const EMPTY_FORM = { identifier: "", condition: "new", notes: "", purchase_price: "", purchased_at: "" };

export default function ServiceAssetModal({ service, onClose }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      const data = await serviceApi.getAssets({ service_id: service._id });
      setAssets(data);
    } catch (e) {
      setToast({ type: "error", message: "Lỗi tải tài sản: " + e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.identifier.trim()) {
      setToast({ type: "error", message: "Vui lòng nhập tên định danh tài sản." });
      return;
    }
    setSubmitting(true);
    try {
      await serviceApi.createAsset({
        service_id: service._id,
        identifier: form.identifier.trim(),
        condition: form.condition,
        notes: form.notes,
        purchase_price: form.purchase_price ? Number(form.purchase_price) : 0,
        purchased_at: form.purchased_at || undefined,
      });
      setToast({ type: "success", message: "Thêm tài sản thành công!" });
      setForm(EMPTY_FORM);
      setShowAddForm(false);
      fetchAssets();
    } catch (e) {
      setToast({ type: "error", message: "Lỗi: " + (e.response?.data?.message || e.message) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (asset) => {
    if (asset.status === "in-use") {
      setToast({ type: "error", message: "Không thể xóa tài sản đang được thuê." });
      return;
    }
    if (!window.confirm(`Xóa tài sản "${asset.identifier}"?`)) return;
    try {
      await serviceApi.deleteAsset(asset._id);
      setToast({ type: "success", message: "Đã xóa tài sản." });
      fetchAssets();
    } catch (e) {
      setToast({ type: "error", message: "Lỗi: " + (e.response?.data?.message || e.message) });
    }
  };

  const handleUpdateCondition = async (asset, condition) => {
    try {
      await serviceApi.updateAsset(asset._id, { condition });
      fetchAssets();
    } catch (e) {
      setToast({ type: "error", message: "Lỗi cập nhật: " + (e.response?.data?.message || e.message) });
    }
  };

  return (
    <>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">

          <div className="px-6 py-4 border-b flex justify-between items-center bg-purple-50 rounded-t-xl">
            <div>
              <h2 className="text-lg font-bold text-gray-800">Quản lý Tài sản — {service.name}</h2>
              <p className="text-xs text-gray-500">Dịch vụ cho thuê · {assets.length} tài sản</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><FiX size={20} /></button>
          </div>

          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {/* Add form */}
            {showAddForm ? (
              <form onSubmit={handleAdd} className="border border-purple-200 rounded-lg p-4 bg-purple-50 space-y-3">
                <h3 className="text-sm font-bold text-gray-700">Thêm tài sản mới</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tên định danh <span className="text-red-500">*</span></label>
                    <input
                      type="text" required placeholder="VD: Xe đạp #01"
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      value={form.identifier}
                      onChange={e => setForm(f => ({ ...f, identifier: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Tình trạng</label>
                    <div className="relative">
                      <select
                        className="w-full appearance-none border rounded-lg p-2 pr-8 text-sm outline-none focus:ring-2 focus:ring-purple-500 bg-white cursor-pointer"
                        value={form.condition}
                        onChange={e => setForm(f => ({ ...f, condition: e.target.value }))}
                      >
                        <option value="new">Mới</option>
                        <option value="good">Tốt</option>
                      </select>
                      <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={13} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Giá mua (VNĐ)</label>
                    <input
                      type="number" min="0" placeholder="0"
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      value={form.purchase_price}
                      onChange={e => setForm(f => ({ ...f, purchase_price: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Ngày mua</label>
                    <input
                      type="date"
                      className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                      value={form.purchased_at}
                      onChange={e => setForm(f => ({ ...f, purchased_at: e.target.value }))}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ghi chú</label>
                  <input
                    type="text" placeholder="Ghi chú thêm..."
                    className="w-full border rounded-lg p-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                    value={form.notes}
                    onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button type="button" onClick={() => { setShowAddForm(false); setForm(EMPTY_FORM); }}
                    className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-200 rounded-lg transition">Hủy</button>
                  <button type="submit" disabled={submitting}
                    className="px-4 py-2 text-sm bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition flex items-center gap-1.5 disabled:opacity-60">
                    <FiSave size={14} />{submitting ? "Đang lưu..." : "Lưu tài sản"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 text-sm text-purple-600 font-semibold hover:bg-purple-50 px-4 py-2 rounded-lg border border-purple-200 transition w-full justify-center"
              >
                <FiPlus /> Thêm tài sản mới
              </button>
            )}

            {/* Asset list */}
            {loading ? (
              <p className="text-sm text-gray-400 text-center py-6">Đang tải...</p>
            ) : assets.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6 italic">Chưa có tài sản nào. Hãy thêm để bắt đầu cho thuê.</p>
            ) : (
              <div className="space-y-2">
                {assets.map(asset => (
                  <div key={asset._id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-white hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-800 text-sm">{asset.identifier}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{asset.notes || "—"}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4 shrink-0">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[asset.status] || "bg-gray-100 text-gray-600"}`}>
                        {STATUS_LABEL[asset.status] || asset.status}
                      </span>
                      <div className="relative">
                        <select
                          className="text-xs border rounded p-1 pr-6 bg-white cursor-pointer outline-none appearance-none"
                          value={asset.condition}
                          onChange={e => handleUpdateCondition(asset, e.target.value)}
                          disabled={asset.status === "in-use"}
                        >
                          {Object.entries(CONDITION_LABEL).map(([v, l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        <FiChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={11} />
                      </div>
                      <button
                        onClick={() => handleDelete(asset)}
                        disabled={asset.status === "in-use"}
                        className="text-red-400 hover:text-red-600 disabled:opacity-30 disabled:cursor-not-allowed p-1"
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t bg-gray-50 flex justify-end rounded-b-xl">
            <button onClick={onClose} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">Đóng</button>
          </div>
        </div>
      </div>
    </>
  );
}
