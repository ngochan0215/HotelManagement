import React, { useEffect, useState } from "react";
import { equipmentApi } from "../../api/equipmentApi.js";
import { FiCheckCircle, FiPlus, FiArrowRight, FiArrowLeft } from "react-icons/fi";
import AddInstallTicketModal from "../components/addInstallTicketModal.jsx";
import AddImportTicketModal from "../components/addImportTicketModal.jsx";

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
    } catch (error) { console.error(error); } finally { setLoading(false); }
  };

  useEffect(() => { fetchTickets(); }, []);

  const handleConfirmImport = async (id) => {
    if (!window.confirm("Xác nhận nhập kho?")) return;
    try {
      await equipmentApi.confirmImportTicket(id);
      alert("Thành công!"); fetchTickets();
    } catch (err) { alert("Lỗi: " + err.message); }
  };

  const handleConfirmInstall = async (id) => {
    if (!window.confirm("Xác nhận hoàn tất phiếu này?")) return;
    try {
      await equipmentApi.confirmInstallTicket(id);
      alert("Thành công!"); fetchTickets();
    } catch (err) { alert("Lỗi: " + err.message); }
  };

  const isInstallType = (ticket) => {
      if (ticket.type === 'install') return true;
      if (ticket.type === 'uninstall') return false;
      return !!ticket.room_id;
  };

  const renderStatus = (status) => {
    const config = {
      pending: { label: "Chờ xử lý", class: "bg-gray-100 text-gray-500" },
      waiting_confirm: { label: "Cần duyệt", class: "bg-yellow-100 text-yellow-800 animate-pulse border border-yellow-300" },
      completed: { label: "Hoàn tất", class: "bg-green-100 text-green-700" },
    };
    const s = config[status] || config.pending;
    return <span className={`px-2 py-1 rounded text-xs font-medium ${s.class}`}>{s.label}</span>;
  };

  return (
    <div className="space-y-8 pb-10 animate-fade-in relative">
      {showInstallModal && <AddInstallTicketModal onClose={() => setShowInstallModal(false)} onSuccess={fetchTickets} />}
      {showImportModal && <AddImportTicketModal onClose={() => setShowImportModal(false)} onSuccess={fetchTickets} />}

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Quản lý Lắp Đặt & Tháo Dỡ</h2>
              <button onClick={() => setShowInstallModal(true)} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 hover:bg-indigo-700">
                  <FiPlus /> Tạo phiếu
              </button>
          </div>
          <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 uppercase text-xs text-gray-600 border-b">
                      <tr>
                          <th className="px-4 py-3">Loại phiếu</th>
                          <th className="px-4 py-3">Phòng</th>
                          <th className="px-4 py-3">Ngày dự kiến</th>
                          <th className="px-4 py-3 text-center">Trạng thái</th>
                          <th className="px-4 py-3 text-right">Hành động</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                      {installs.map((item) => {
                          const isInstall = isInstallType(item);
                          const roomDisplay = item.room_id ? `P.${item.room_id.room_number}` : "---";

                          return (
                          <tr key={item._id} className="hover:bg-gray-50">
                              <td className="px-4 py-3">
                                  {isInstall ? (
                                      <span className="inline-flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded text-xs font-bold border border-indigo-100">
                                          <FiArrowRight/> Lắp đặt
                                      </span>
                                  ) : (
                                      <span className="inline-flex items-center gap-1 text-orange-600 bg-orange-50 px-2 py-1 rounded text-xs font-bold border border-orange-100">
                                          <FiArrowLeft/> Tháo dỡ
                                      </span>
                                  )}
                              </td>

                              <td className="px-4 py-3 text-base">
                                  <span className={`font-bold ${isInstall ? 'text-indigo-700' : 'text-orange-700'}`}>
                                      {roomDisplay}
                                  </span>
                              </td>

                              <td className="px-4 py-3">{new Date(item.install_date).toLocaleDateString('vi-VN')}</td>
                              <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                              <td className="px-4 py-3 text-right">
                                  {item.status === 'waiting_confirm' && (
                                      <button onClick={() => handleConfirmInstall(item._id)} className="text-green-600 hover:text-green-800 font-bold text-xs border border-green-200 px-2 py-1 rounded hover:bg-green-50 transition">
                                          Xác nhận
                                      </button>
                                  )}
                              </td>
                          </tr>
                      )})}
                      {installs.length === 0 && <tr><td colSpan="5" className="text-center py-6 text-gray-400">Chưa có dữ liệu</td></tr>}
                  </tbody>
              </table>
          </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-gray-800">Lịch sử Nhập Kho</h2>
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
                            <td className="px-4 py-3 text-xs max-w-[200px] truncate">
                                {item.import_details?.map(d => `${d.category_id?.name} (x${d.import_quantity})`).join(", ")}
                            </td>
                            <td className="px-4 py-3 text-center">{renderStatus(item.status)}</td>
                            <td className="px-4 py-3 text-right">
                                {item.status === 'waiting_confirm' && (
                                    <button onClick={() => handleConfirmImport(item._id)} className="text-blue-600 hover:text-blue-800 font-bold text-xs border border-blue-200 px-2 py-1 rounded hover:bg-blue-50">
                                        Nhập kho
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