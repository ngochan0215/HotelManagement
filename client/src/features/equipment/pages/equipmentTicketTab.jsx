import React, { useEffect, useState } from "react";
import { equipmentApi } from "../../api/equipmentApi";
import { FiCheckCircle, FiPlus, FiClock, FiTruck } from "react-icons/fi";

import AddInstallTicketModal from "../components/AddInstallTicketModal";
import AddImportTicketModal from "../components/AddImportTicketModal";

export default function EquipmentTicketTab() {
  const [imports, setImports] = useState([]);
  const [installs, setInstalls] = useState([]);
  const [loading, setLoading] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const [resImport, resInstall] = await Promise.all([
        equipmentApi.getAllImportTickets(),
        equipmentApi.getAllInstallTickets()
      ]);

      setImports(resImport.tickets || []);
      setInstalls(resInstall.installs || []);
    } catch (error) {
      console.error("Lỗi tải dữ liệu phiếu:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTickets();
  }, []);

  const handleConfirmImport = async (id) => {
    if (!window.confirm("Xác nhận đã nhập hàng vào kho? Hệ thống sẽ cập nhật số lượng tồn kho.")) return;
    try {
      await equipmentApi.confirmImportTicket(id);
      alert("Đã nhập kho thành công!");
      fetchTickets();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  const handleConfirmInstall = async (id) => {
    if (!window.confirm("Xác nhận kỹ thuật viên đã hoàn tất lắp đặt? Thiết bị sẽ chuyển sang trạng thái 'Đang sử dụng'.")) return;
    try {
      await equipmentApi.confirmInstallTicket(id);
      alert("Xác nhận lắp đặt thành công!");
      fetchTickets();
    } catch (err) {
      alert("Lỗi: " + (err.response?.data?.message || err.message));
    }
  };

  const renderStatus = (status) => {
    const statusMap = {
      pending: {
          label: "Chờ đến hạn",
          className: "bg-gray-100 text-gray-600 border border-gray-200"
      },
      waiting_confirm: {
          label: "Cần xác nhận",
          className: "bg-yellow-100 text-yellow-800 font-bold border border-yellow-300 animate-pulse"
      },
      completed: {
          label: "Hoàn tất",
          className: "bg-green-100 text-green-700 border border-green-200"
      },
    };

    const s = statusMap[status] || { label: status, className: "bg-gray-100" };

    return (
      <span className={`px-2 py-1 rounded-md text-xs whitespace-nowrap ${s.className}`}>
        {s.label}
      </span>
    );
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in relative">

      {showInstallModal && (
        <AddInstallTicketModal
            onClose={() => setShowInstallModal(false)}
            onSuccess={fetchTickets}
        />
      )}
      {showImportModal && (
        <AddImportTicketModal
            onClose={() => setShowImportModal(false)}
            onSuccess={fetchTickets}
        />
      )}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FiClock className="text-orange-500" /> Phiếu Lắp Đặt & Điều Chuyển
                </h2>
            </div>
            <button
                onClick={() => setShowInstallModal(true)}
                className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all"
            >
                <FiPlus /> Tạo phiếu lắp
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3 min-w-[100px]">Phòng</th>
                        <th className="px-4 py-3 min-w-[120px]">Ngày lắp</th>
                        <th className="px-4 py-3 min-w-[150px]">Người tạo</th>
                        <th className="px-4 py-3 text-center min-w-[120px]">Trạng thái</th>
                        <th className="px-4 py-3 text-right min-w-[150px]">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {installs.length === 0 && !loading && (
                        <tr><td colSpan="5" className="text-center py-8 text-gray-400 italic">Chưa có phiếu lắp đặt nào</td></tr>
                    )}
                    {installs.map((item) => (
                        <tr key={item._id} className="hover:bg-orange-50 transition-colors group">
                            <td className="px-4 py-3 font-bold text-gray-800">
                                {item.room_id?.room_number ? `Phòng ${item.room_id.room_number}` : <span className="text-red-400">Chưa gán</span>}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-600">
                                {new Date(item.install_date).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                                {item.employee_id?.name || "Admin"}
                            </td>
                            <td className="px-4 py-3 text-center">
                                {renderStatus(item.status)}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {item.status === 'waiting_confirm' && (
                                    <button
                                        onClick={() => handleConfirmInstall(item._id)}
                                        className="inline-flex items-center gap-1 bg-white border border-green-500 text-green-600 px-3 py-1.5 rounded-md hover:bg-green-50 transition-all font-medium text-xs shadow-sm ml-auto"
                                        title="Xác nhận đã lắp xong"
                                    >
                                        <FiCheckCircle /> Hoàn tất
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
                <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <FiTruck className="text-blue-500" /> Phiếu Nhập Kho
                </h2>
            </div>
            <button
                 onClick={() => setShowImportModal(true)}
                 className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm transition-all"
            >
                <FiPlus /> Tạo phiếu nhập
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
                <thead className="bg-gray-50 text-gray-600 font-semibold uppercase text-xs border-b border-gray-200">
                    <tr>
                        <th className="px-4 py-3 min-w-[100px]">Mã phiếu</th>
                        <th className="px-4 py-3 min-w-[120px]">Ngày nhập</th>
                        <th className="px-4 py-3">Chi tiết hàng hóa</th>
                        <th className="px-4 py-3 text-center min-w-[120px]">Trạng thái</th>
                        <th className="px-4 py-3 text-right min-w-[150px]">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {imports.length === 0 && !loading && (
                        <tr><td colSpan="5" className="text-center py-8 text-gray-400 italic">Chưa có phiếu nhập hàng</td></tr>
                    )}
                    {imports.map((item) => (
                        <tr key={item._id} className="hover:bg-blue-50 transition-colors">
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">
                                #{item._id.slice(-6).toUpperCase()}
                            </td>
                            <td className="px-4 py-3 font-mono text-gray-600">
                                {new Date(item.import_date).toLocaleDateString('vi-VN')}
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-600 max-w-[300px]">
                                {item.import_details && item.import_details.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {item.import_details.map((detail, idx) => (
                                            <span key={idx} className="bg-gray-100 px-2 py-0.5 rounded border border-gray-200">
                                                {detail.category_id?.name || "Thiết bị"}
                                                <b className="ml-1 text-blue-600">x{detail.import_quantity}</b>
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="italic text-gray-400">Không có chi tiết</span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-center">
                                {renderStatus(item.status)}
                            </td>
                            <td className="px-4 py-3 text-right">
                                {item.status === 'waiting_confirm' && (
                                    <button
                                        onClick={() => handleConfirmImport(item._id)}
                                        className="inline-flex items-center gap-1 bg-white border border-blue-500 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-50 transition-all font-medium text-xs shadow-sm ml-auto"
                                        title="Xác nhận nhập kho"
                                    >
                                        <FiCheckCircle /> Nhập kho
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}