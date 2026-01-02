import React, { useEffect, useState } from "react";
import { equipmentApi } from "../../api/equipmentApi";
import { FiCheckCircle, FiPlus, FiClock, FiTruck, FiAlertCircle } from "react-icons/fi";
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
      console.error(error);
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
    const config = {
      pending: { label: "Chờ đến ngày", class: "bg-gray-100 text-gray-500 border border-gray-200" },
      waiting_confirm: { label: "Cần duyệt", class: "bg-yellow-100 text-yellow-800 font-bold border border-yellow-300 animate-pulse" },
      completed: { label: "Đã hoàn thành", class: "bg-green-100 text-green-700 border border-green-200" },
    };
    const s = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded text-xs whitespace-nowrap ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in relative">

      {showInstallModal && <AddInstallTicketModal onClose={() => setShowInstallModal(false)} onSuccess={fetchTickets} />}
      {showImportModal && <AddImportTicketModal onClose={() => setShowImportModal(false)} onSuccess={fetchTickets} />}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <FiClock className="text-orange-500" /> Quản lý Lắp Đặt & Điều Chuyển
            </h2>
            <button onClick={() => setShowInstallModal(true)} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-orange-700">
                <FiPlus /> Tạo phiếu lắp
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 uppercase text-xs text-gray-600 border-b">
                    <tr>
                        <th className="px-4 py-3">Phòng</th>
                        <th className="px-4 py-3">Ngày dự kiến</th>
                        <th className="px-4 py-3">Người tạo</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {installs.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-bold">{item.room_id?.room_number || "---"}</td>
                            <td className="px-4 py-3">{new Date(item.install_date).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-3">{item.employee_id?.name || "System"}</td>
                            <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                            <td className="px-4 py-3 text-right">
                                {item.status === 'waiting_confirm' ? (
                                    <button
                                        onClick={() => handleConfirmInstall(item._id)}
                                        className="inline-flex items-center gap-1 bg-green-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-green-700 shadow-sm ml-auto"
                                    >
                                        <FiCheckCircle /> Xác nhận
                                    </button>
                                ) : (
                                    <span className="text-gray-300 text-xs italic">
                                        {item.status === 'completed' ? '---' : 'Chưa đến hạn'}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                    {installs.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-gray-400">Chưa có dữ liệu</td></tr>}
                </tbody>
            </table>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2 text-gray-800">
                <FiTruck className="text-blue-500" /> Quản lý Nhập Kho
            </h2>
            <button onClick={() => setShowImportModal(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-blue-700">
                <FiPlus /> Tạo phiếu nhập
            </button>
        </div>

        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
                <thead className="bg-gray-50 uppercase text-xs text-gray-600 border-b">
                    <tr>
                        <th className="px-4 py-3">Mã phiếu</th>
                        <th className="px-4 py-3">Ngày nhập</th>
                        <th className="px-4 py-3">Chi tiết</th>
                        <th className="px-4 py-3 text-center">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Hành động</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {imports.map((item) => (
                        <tr key={item._id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-mono text-xs">#{item._id.slice(-6).toUpperCase()}</td>
                            <td className="px-4 py-3">{new Date(item.import_date).toLocaleDateString('vi-VN')}</td>
                            <td className="px-4 py-3 text-xs max-w-[250px] truncate">
                                {item.import_details?.map(d => `${d.category_id?.name} (x${d.import_quantity})`).join(", ")}
                            </td>
                            <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                            <td className="px-4 py-3 text-right">
                                {item.status === 'waiting_confirm' ? (
                                    <button
                                        onClick={() => handleConfirmImport(item._id)}
                                        className="inline-flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-md text-xs font-bold hover:bg-blue-700 shadow-sm ml-auto"
                                    >
                                        <FiCheckCircle /> Nhập kho
                                    </button>
                                ) : (
                                    <span className="text-gray-300 text-xs italic">
                                        {item.status === 'completed' ? '---' : 'Chưa đến hạn'}
                                    </span>
                                )}
                            </td>
                        </tr>
                    ))}
                     {imports.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-gray-400">Chưa có dữ liệu</td></tr>}
                </tbody>
            </table>
        </div>
      </div>
    </div>
  );
}