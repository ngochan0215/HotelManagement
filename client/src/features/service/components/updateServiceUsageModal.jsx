import React, { useState, useEffect, useMemo } from "react";
import { FiX, FiPlus, FiTrash2, FiSave, FiChevronDown, FiDollarSign } from "react-icons/fi";
import { serviceApi } from "../../api/serviceApi.js";
import Toast from "../../../components/toast.jsx";

export default function UpdateServiceUsageModal({ usageId, onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [usageData, setUsageData] = useState(null);
  const [toast, setToast] = useState(null);

  const [usageList, setUsageList] = useState([
    { service_id: "", quantity: 1 }
  ]);

  useEffect(() => {
    const loadData = async () => {
      setInitialLoading(true);
      try {
        const [srvRes, usageRes] = await Promise.all([
          serviceApi.getAllServices(),
          serviceApi.getServiceUsageById(usageId)
        ]);

        setServices(srvRes.services || []);
        
        if (usageRes.success && usageRes.data) {
          setUsageData(usageRes.data);
          // Map usage_details thành format cho form
          const details = usageRes.data.usage_details || [];
          if (details.length > 0) {
            setUsageList(details.map(d => ({
              service_id: d.service_id?._id || d.service_id,
              quantity: d.quantity || 1
            })));
          }
        }
      } catch (err) {
        console.error(err);
        setToast({ message: "Lỗi khi tải dữ liệu: " + (err.response?.data?.message || err.message), type: "error" });
      } finally {
        setInitialLoading(false);
      }
    };
    loadData();
  }, [usageId]);

  const handleAddRow = () => setUsageList([...usageList, { service_id: "", quantity: 1 }]);
  const handleRemoveRow = (idx) => {
    const newList = [...usageList];
    newList.splice(idx, 1);
    setUsageList(newList);
  };
  const handleChangeRow = (idx, field, val) => {
    const newList = [...usageList];
    newList[idx][field] = val;
    setUsageList(newList);
  };

  // Tính tổng tiền
  const totalAmount = useMemo(() => {
    return usageList.reduce((sum, item) => {
      if (!item.service_id || !item.quantity) return sum;
      const service = services.find(s => s._id === item.service_id);
      if (!service) return sum;
      return sum + (service.price * Number(item.quantity || 0));
    }, 0);
  }, [usageList, services]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (usageList.some(i => !i.service_id || i.quantity <= 0)) {
      setToast({ message: "Vui lòng chọn dịch vụ và số lượng > 0", type: "error" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        services: usageList.map(i => ({
          service_id: i.service_id,
          quantity: Number(i.quantity),
          use_from: new Date().toISOString()
        }))
      };

      await serviceApi.updateServiceUsage(usageId, payload);
      setToast({ message: "Cập nhật phiếu sử dụng dịch vụ thành công!", type: "success" });
      onSuccess();
      onClose();
    } catch (error) {
      setToast({ message: "Lỗi: " + (error.response?.data?.message || error.message), type: "error" });
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 text-center">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  return (
    <>
    {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b flex justify-between items-center bg-indigo-50 rounded-t-xl">
            <div>
                <h2 className="text-xl font-bold text-gray-800">Cập nhật Dịch Vụ Sử Dụng</h2>
                <p className="text-sm text-gray-500">Chỉnh sửa danh sách dịch vụ (chỉ áp dụng cho phiếu pending)</p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors"><FiX size={20}/></button>
        </div>

        {usageData && (
          <div className="px-6 py-3 bg-gray-50 border-b">
            <div className="text-sm text-gray-600">
              <p><span className="font-semibold">Khách hàng:</span> {usageData.service_usage?.customer_id?.full_name || "N/A"}</p>
              <p className="mt-1"><span className="font-semibold">Booking:</span> #{usageData.service_usage?.booking_id?._id?.slice(-6) || "N/A"}</p>
            </div>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
            <form id="update-usage-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-sm font-bold text-gray-700">Danh sách dịch vụ</label>
                        <button type="button" onClick={handleAddRow} className="text-sm text-indigo-600 font-semibold hover:bg-indigo-50 px-3 py-1 rounded transition-colors flex items-center gap-1">
                            <FiPlus /> Thêm dịch vụ
                        </button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 text-gray-600 font-semibold">
                                <tr>
                                    <th className="px-4 py-3 w-[60%]">Tên dịch vụ</th>
                                    <th className="px-4 py-3 w-[25%]">Số lượng</th>
                                    <th className="px-4 py-3 w-[15%] text-center">Xóa</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {usageList.map((item, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-4 py-2 relative">
                                            <div className="relative w-full">
                                                <select
                                                    className="w-full appearance-none border rounded p-2 pr-8 focus:ring-2 focus:ring-indigo-500 outline-none bg-white cursor-pointer"
                                                    value={item.service_id}
                                                    onChange={(e) => handleChangeRow(index, 'service_id', e.target.value)}
                                                    required
                                                >
                                                    <option value="">-- Chọn dịch vụ --</option>
                                                    {services.map(s => (
                                                        <option key={s._id} value={s._id}>{s.name} ({s.price.toLocaleString()}đ)</option>
                                                    ))}
                                                </select>
                                                <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={14}/>
                                            </div>
                                        </td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number" min="1" placeholder="1"
                                                className="w-full border rounded p-2 text-center font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                                                value={item.quantity}
                                                onChange={(e) => handleChangeRow(index, 'quantity', e.target.value)}
                                                required
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button type="button" onClick={() => handleRemoveRow(index)} className="text-red-400 hover:text-red-600 p-2">
                                                <FiTrash2 size={16}/>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Hiển thị tổng tiền */}
                <div className="bg-indigo-50 p-4 rounded-lg border-2 border-indigo-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <FiDollarSign className="text-indigo-600" size={20} />
                            <span className="font-bold text-gray-800 text-lg">Tổng tiền:</span>
                        </div>
                        <span className="font-bold text-indigo-600 text-2xl">
                            {totalAmount.toLocaleString()} đ
                        </span>
                    </div>
                </div>
            </form>
        </div>

        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <button onClick={onClose} className="px-5 py-2 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition-colors">Hủy bỏ</button>
            <button
                type="submit" form="update-usage-form" disabled={loading}
                className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
            >
                {loading ? "Đang xử lý..." : <><FiSave /> Cập nhật</>}
            </button>
        </div>
      </div>
    </div>
    </>
  );
}
